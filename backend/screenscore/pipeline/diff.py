"""Cross-draft diff pass.

The scoring pipeline is blind: it never reads prior reports, so each draft's
scores are independent (see docs/DECISIONS.md). This module is the one place
allowed to see two reports side by side. It produces:

- a MECHANICAL layer (authoritative): per-dimension score movements, verdict
  change, size changes — pure computation, no model;
- a NARRATIVE layer (one reasoning-model call): what improved, what
  persisted, what's new, and — explicitly demanded — what regressed.
"""

import json
import re
import sqlite3
import traceback

from .. import config
from ..db import repository
from ..parsing import PARSER_VERSION
from ..runtime.base import ModelRuntime
from . import prompts
from .llmjson import StageOutputError, generate_json
from .progress import ProgressBus
from .stages import REASONING_OPTS

SCORE_RANK = {None: None, "weak": 0, "fair": 1, "good": 2, "excellent": 3}

# Above this dialogue-overlap, two "drafts" are the same text (e.g. the same
# script uploaded as PDF and Fountain): score differences are model/parse
# variance, and the narrative must not invent revision stories for them.
NEAR_IDENTICAL_JACCARD = 0.9


def dialogue_jaccard(parse_a: dict, parse_b: dict) -> float | None:
    """Format-stable content similarity: overlap of normalized dialogue lines.
    (Raw text is too lossy across PDF extraction; dialogue survives.)"""
    def lines(parse: dict) -> set[str]:
        out = set()
        for scene in parse.get("scenes", []):
            for element in scene["elements"]:
                if element["type"] == "dialogue" and len(element.get("text") or "") > 10:
                    out.add(re.sub(r"\s+", " ", element["text"].lower()).strip())
        return out

    a, b = lines(parse_a), lines(parse_b)
    if not a or not b:
        return None
    return len(a & b) / len(a | b)


def dimension_changes(from_rubric: list[dict], to_rubric: list[dict]) -> list[dict]:
    """Mechanical score movement per dimension. Authoritative — the narrative
    layer is instructed not to contradict it."""
    from_by_id = {d["id"]: d for d in from_rubric}
    changes = []
    for to_dim in to_rubric:
        from_dim = from_by_id.get(to_dim["id"])
        from_score = from_dim.get("score") if from_dim else None
        to_score = to_dim.get("score")
        from_rank, to_rank = SCORE_RANK.get(from_score), SCORE_RANK.get(to_score)
        if from_dim is None:
            direction = "new_dimension"
        elif from_rank is None and to_rank is None:
            direction = "unchanged"
        elif from_rank is None:
            direction = "newly_scored"
        elif to_rank is None:
            direction = "newly_unscored"
        elif to_rank > from_rank:
            direction = "improved"
        elif to_rank < from_rank:
            direction = "declined"
        else:
            direction = "unchanged"
        changes.append({
            "id": to_dim["id"],
            "name": to_dim["name"],
            "from_score": from_score,
            "to_score": to_score,
            "direction": direction,
        })
    return changes


def _report_summary(report: dict) -> str:
    lines = [f"Verdict: {report['recommendation']['verdict'].upper()} — {report['recommendation']['rationale'][:300]}"]
    for dim in report["rubric"]:
        score = dim["score"] or "insufficient evidence"
        lines.append(f"- {dim['name']}: {score.upper()}. {dim['rationale'][:280]}")
    return "\n".join(lines)


def _notes_summary(report: dict) -> str:
    notes = report.get("scene_notes") or []
    if not notes:
        return "(no scene notes)"
    return "\n".join(f"- scene {n['scene_number']} [{n['kind']}]: {n['note'][:200]}" for n in notes)


def _score_changes_text(changes: list[dict]) -> str:
    lines = []
    for c in changes:
        lines.append(
            f"- {c['name']}: {(c['from_score'] or 'insufficient').upper()} → "
            f"{(c['to_score'] or 'insufficient').upper()} ({c['direction'].replace('_', ' ')})"
        )
    return "\n".join(lines)


def _load_report(row) -> dict:
    return json.loads((config.library_dir() / row["json_path"]).read_text())


def _draft_similarity(conn: sqlite3.Connection, from_row, to_row) -> float | None:
    """Dialogue-overlap similarity of the two underlying drafts, from their
    cached parses. None when either parse is unavailable."""
    parses = []
    for report_row in (from_row, to_row):
        draft = repository.get_draft(conn, report_row["draft_id"])
        raw = repository.cache_get(conn, draft["content_hash"], "parse", "-", PARSER_VERSION)
        if raw is None:
            return None
        parses.append(json.loads(raw))
    return dialogue_jaccard(parses[0], parses[1])


def _enforce_narrative_consistency(changes: list[dict], narrative: dict) -> None:
    """The mechanical score table is authoritative: any dimension that
    measurably declined must appear in regressions (and improved likewise),
    even if the model's narrative glossed over it. Entries added here are
    labeled as computed so the UI/user can tell them apart."""
    def mentioned(dim: dict, items: list[str]) -> bool:
        needles = (dim["id"], dim["name"].lower())
        return any(n in item.lower() for item in items for n in needles)

    for change in changes:
        line = (
            f"{change['name']}: score moved "
            f"{(change['from_score'] or 'insufficient')} → {(change['to_score'] or 'insufficient')} "
            "(added from the computed score table)"
        )
        if change["direction"] == "declined" and not mentioned(change, narrative["regressions"]):
            narrative["regressions"].append(line)
        if change["direction"] == "improved" and not mentioned(change, narrative["improved"]):
            narrative["improved"].append(line)


async def run_diff(diff_id: str, conn: sqlite3.Connection, bus: ProgressBus, runtime: ModelRuntime) -> None:
    """Owns `conn` for the duration of the run and closes it on exit."""
    try:
        row = repository.get_diff(conn, diff_id)
        repository.mark_diff_running(conn, diff_id)
        bus.publish(diff_id, {"type": "stage", "stage": "diff", "label": "Comparing drafts", "status": "started"})

        from_row = repository.get_report(conn, row["from_report_id"])
        to_row = repository.get_report(conn, row["to_report_id"])
        from_report = _load_report(from_row)
        to_report = _load_report(to_row)
        project = repository.get_project(conn, row["project_id"])

        changes = dimension_changes(from_report["rubric"], to_report["rubric"])
        similarity = _draft_similarity(conn, from_row, to_row)
        mechanical = {
            "dimensions": changes,
            "verdict": {
                "from": from_report["recommendation"]["verdict"],
                "to": to_report["recommendation"]["verdict"],
            },
            "size": {
                "from_pages": from_report["header"]["page_count"],
                "to_pages": to_report["header"]["page_count"],
                "from_scenes": from_report["header"]["scene_count"],
                "to_scenes": to_report["header"]["scene_count"],
            },
            "content_similarity": round(similarity, 3) if similarity is not None else None,
        }

        from_label = from_report["header"].get("draft_label") or f"draft of {from_row['created_at'][:10]}"
        to_label = to_report["header"].get("draft_label") or f"draft of {to_row['created_at'][:10]}"
        prompt = prompts.render(
            "diff",
            title=project["title"],
            from_label=from_label,
            to_label=to_label,
            from_summary=_report_summary(from_report),
            to_summary=_report_summary(to_report),
            score_changes=_score_changes_text(changes),
            from_notes=_notes_summary(from_report),
            to_notes=_notes_summary(to_report),
        )
        try:
            narrative = await generate_json(runtime, row["model"], prompt, options=REASONING_OPTS)
        except StageOutputError as exc:
            narrative = {
                "overall": f"(The comparison model did not produce a usable narrative: {exc})",
                "dimension_comments": [], "improved": [], "persisted": [],
                "new_issues": [], "regressions": [],
            }

        known_ids = {c["id"] for c in changes}
        narrative_block = {
            "overall": str(narrative.get("overall") or "").strip(),
            "dimension_comments": [
                {"id": c["id"], "comment": str(c.get("comment") or "")}
                for c in (narrative.get("dimension_comments") or [])
                if isinstance(c, dict) and c.get("id") in known_ids
            ],
            "improved": [str(x) for x in narrative.get("improved") or []],
            "persisted": [str(x) for x in narrative.get("persisted") or []],
            "new_issues": [str(x) for x in narrative.get("new_issues") or []],
            "regressions": [str(x) for x in narrative.get("regressions") or []],
        }
        _enforce_narrative_consistency(changes, narrative_block)
        if similarity is not None and similarity >= NEAR_IDENTICAL_JACCARD:
            narrative_block["overall"] = (
                f"Note: these two drafts are textually near-identical "
                f"({similarity:.0%} dialogue overlap). Any score differences below "
                "reflect run-to-run model variance, not actual revisions. "
                + narrative_block["overall"]
            )
        payload = {
            "mechanical": mechanical,
            "narrative": narrative_block,
            "from_report_id": row["from_report_id"],
            "to_report_id": row["to_report_id"],
        }
        repository.mark_diff_complete(conn, diff_id, json.dumps(payload))
        bus.publish(diff_id, {"type": "done", "report_id": diff_id})
    except Exception as exc:
        traceback.print_exc()
        try:
            repository.mark_diff_failed(conn, diff_id, str(exc))
        except Exception:
            pass
        bus.publish(diff_id, {"type": "failed", "error": str(exc)})
    finally:
        conn.close()
