"""Stub pipeline for Phase 1.

Walks the real stage sequence (ingest → segment → map → score → synthesize →
assemble), streams progress events, and lands a schema-valid *fake* report in
SQLite + the library folder. It exists so the report contract, persistence,
SSE progress, and UI are exercised before any real analysis lands in Phase 3.
Every stub report is marked meta.stub = true and the UI labels it.
"""

import asyncio
import json
import sqlite3
import traceback
from datetime import datetime, timezone

from .. import ENGINE_VERSION, config
from ..db import repository
from ..parsing import PARSER_VERSION
from ..schemas import validate_report
from .progress import ProgressBus

STAGES = [
    ("ingest", "Reading and normalizing the script"),
    ("segment", "Deriving scenes, sequences and act structure"),
    ("map", "Extracting per-scene and per-character digests"),
    ("score", "Scoring rubric dimensions against evidence"),
    ("synthesize", "Synthesizing logline, comps and recommendation"),
    ("assemble", "Assembling and validating the report"),
]

FALLBACK_SCENE_COUNT = 42  # only when no parse is available


async def run(
    report_id: str,
    conn: sqlite3.Connection,
    bus: ProgressBus,
) -> None:
    """Run the stub pipeline for an existing queued report row."""
    delay = config.stub_stage_delay()
    try:
        report_row = repository.get_report(conn, report_id)
        draft = repository.get_draft(conn, report_row["draft_id"])
        project = repository.get_project(conn, draft["project_id"])
        repository.mark_report_running(conn, report_id)

        cached_parse = repository.cache_get(
            conn, draft["content_hash"], "parse", "-", PARSER_VERSION
        )
        parsed = json.loads(cached_parse) if cached_parse else None
        scene_total = len(parsed["scenes"]) if parsed and parsed["scenes"] else FALLBACK_SCENE_COUNT

        for index, (stage_id, label) in enumerate(STAGES):
            bus.publish(report_id, {
                "type": "stage",
                "stage": stage_id,
                "label": label,
                "status": "started",
                "stage_index": index,
                "stage_count": len(STAGES),
            })
            if stage_id == "map":
                # The map pass is the long, per-scene part of a real run;
                # simulate its granular ticks so the UI proves it can render them.
                step = max(1, scene_total // 6)
                for scene_number in range(1, scene_total + 1, step):
                    bus.publish(report_id, {
                        "type": "tick",
                        "stage": "map",
                        "detail": f"scene {min(scene_number + step - 1, scene_total)}/{scene_total}",
                    })
                    await asyncio.sleep(delay / 6 if delay else 0)
            else:
                await asyncio.sleep(delay)
            bus.publish(report_id, {
                "type": "stage",
                "stage": stage_id,
                "label": label,
                "status": "completed",
                "stage_index": index,
                "stage_count": len(STAGES),
            })

        report = build_stub_report(
            report_id=report_id,
            draft_id=draft["id"],
            script_hash=draft["content_hash"],
            title=project["title"],
            source_format=draft["source_format"],
            draft_label=draft["label"],
            parsed=parsed,
        )
        validate_report(report)

        json_rel_path = f"reports/{report_id}.json"
        json_abs_path = config.library_dir() / json_rel_path
        json_abs_path.parent.mkdir(parents=True, exist_ok=True)
        json_abs_path.write_text(json.dumps(report, indent=2))
        repository.mark_report_complete(conn, report_id, json_rel_path)
        bus.publish(report_id, {"type": "done", "report_id": report_id})
    except Exception as exc:  # pragma: no cover - defensive
        traceback.print_exc()
        try:
            repository.mark_report_failed(conn, report_id, str(exc))
        except Exception:
            pass
        bus.publish(report_id, {"type": "failed", "error": str(exc)})


def _character_section(parsed: dict | None, placeholder: str) -> dict:
    """Real character stats from the parse; placeholder prose around them."""
    if not parsed or not parsed.get("scenes"):
        return {
            "principals": [
                {
                    "name": "PROTAGONIST",
                    "description": placeholder,
                    "dialogue_share": 0.34,
                    "scene_numbers": [1, 3, 7, 12],
                    "arc_summary": placeholder,
                },
            ],
            "graph": {"edges": []},
        }

    line_counts: dict[str, int] = {}
    scene_presence: dict[str, list[int]] = {}
    pair_counts: dict[tuple[str, str], int] = {}
    for scene in parsed["scenes"]:
        present: list[str] = []
        for element in scene["elements"]:
            if element["type"] == "dialogue" and element["character"]:
                name = element["character"]
                line_counts[name] = line_counts.get(name, 0) + 1
                if name not in present:
                    present.append(name)
                    scene_presence.setdefault(name, []).append(scene["number"])
        for i, a in enumerate(present):
            for b in present[i + 1:]:
                pair_counts[tuple(sorted((a, b)))] = pair_counts.get(tuple(sorted((a, b))), 0) + 1

    total_lines = sum(line_counts.values()) or 1
    principals = [
        {
            "name": name,
            "description": placeholder,
            "dialogue_share": round(line_counts[name] / total_lines, 3),
            "scene_numbers": scene_presence[name],
            "arc_summary": placeholder,
        }
        for name in sorted(line_counts, key=lambda n: -line_counts[n])[:8]
    ]
    edges = [
        {"a": a, "b": b, "shared_scenes": count}
        for (a, b), count in sorted(pair_counts.items(), key=lambda kv: -kv[1])
    ]
    return {"principals": principals, "graph": {"edges": edges}}


def _real_quote(parsed: dict | None, scene_number: int) -> str | None:
    """First dialogue (else action) line of a scene — a genuinely verifiable quote."""
    if not parsed:
        return None
    for scene in parsed.get("scenes", []):
        if scene["number"] != scene_number:
            continue
        for wanted in ("dialogue", "action"):
            for element in scene["elements"]:
                if element["type"] == wanted and element["text"].strip():
                    return element["text"].strip()
    return None


def build_stub_report(
    *,
    report_id: str,
    draft_id: str,
    script_hash: str,
    title: str,
    source_format: str,
    draft_label: str | None,
    parsed: dict | None = None,
) -> dict:
    """A schema-valid report: real structure (header counts, characters,
    scene anchors, quotes) from the parse, placeholder judgment. Clearly
    marked stub throughout."""
    placeholder = "[stub] Placeholder produced by the Phase 1 pipeline — no analysis was performed."

    scenes = (parsed or {}).get("scenes") or []
    scene_count = len(scenes) or None
    page_count = (parsed or {}).get("page_count") or (parsed or {}).get("estimated_page_count")
    first_scene = scenes[0]["number"] if scenes else 3
    last_scene = scenes[-1]["number"] if scenes else 23
    writers = (parsed or {}).get("authors") or []

    def ev(scene: int, fallback: str) -> dict:
        quote = _real_quote(parsed, scene) or fallback
        note = None if quote != fallback else "[stub] no parsed line available"
        return {"scene_number": scene, "quote": quote, "note": note}

    return {
        "schema_version": "1.0",
        "meta": {
            "report_id": report_id,
            "draft_id": draft_id,
            "script_hash": script_hash,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
            "prompt_version": config.PROMPT_VERSION,
            "models": {"worker": None, "reasoning": None},
            "stub": True,
        },
        "header": {
            "title": title,
            "writers": writers,
            "page_count": page_count,
            "estimated_runtime_minutes": page_count,
            "scene_count": scene_count,
            "genres": [{"name": "Drama", "confidence": 0.5}],
            "source_format": source_format,
            "draft_label": draft_label,
        },
        "logline": f"[stub] A placeholder logline for “{title}” — the real pipeline arrives in Phase 3.",
        "synopsis": {
            "overview": placeholder,
            "acts": [
                {"act": "Act One", "summary": placeholder},
                {"act": "Act Two", "summary": placeholder},
                {"act": "Act Three", "summary": placeholder},
            ],
        },
        "rubric": [
            {
                "id": dim_id,
                "name": dim_name,
                "score": "fair",
                "insufficient_evidence": False,
                "rationale": placeholder,
                "evidence": [ev(first_scene, "[stub] A quoted line would appear here, verified against the script.")],
            }
            for dim_id, dim_name in [
                ("premise_originality", "Premise / Concept / Originality"),
                ("structure_pacing", "Structure & Pacing"),
                ("characterization", "Characterization"),
                ("dialogue", "Dialogue"),
                ("theme_resonance", "Theme & Emotional Resonance"),
                ("marketability", "Marketability / Commercial Potential"),
                ("production_complexity", "Production Complexity"),
                ("representation_content", "Representation & Content"),
            ]
        ],
        "characters": _character_section(parsed, placeholder),
        "comps": {
            "disclaimer": "Comparable titles are model-suggested from its own knowledge and are not verified against any external source.",
            "items": [{"title": "[stub] Comparable Title", "year": 2020, "medium": "film", "reason": placeholder}],
        },
        "budget_tier": {"tier": "mid", "drivers": [placeholder]},
        "content_rating": {
            "estimated": "PG-13",
            "drivers": [
                {
                    "category": "language",
                    "detail": placeholder,
                    "evidence": [ev(first_scene, "[stub] A rating-driving quote would appear here.")],
                }
            ],
        },
        "scene_notes": [
            {"scene_number": first_scene, "kind": "standout", "note": placeholder, "evidence": [ev(first_scene, "[stub] Standout beat quote.")]},
            {"scene_number": last_scene, "kind": "problem", "note": placeholder, "evidence": [ev(last_scene, "[stub] Problem spot quote.")]},
        ],
        "recommendation": {"verdict": "consider", "rationale": placeholder},
    }
