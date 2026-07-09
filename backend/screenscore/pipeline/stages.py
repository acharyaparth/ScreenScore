"""The analysis pipeline: parse → segment → map → characters → dimension
specialists → scene notes → synthesis → verify → assemble.

Every model-produced stage result is cached in pipeline_cache keyed by
(script_hash, stage, model, prompt_version): re-running a draft is nearly
free, a crashed run resumes where it stopped, and the cache doubles as the
durable per-draft analysis history.

Failure policy:
- one map scene fails → minimal fallback digest entry (run continues);
- a specialist fails → that dimension reports insufficient_evidence;
- synthesis fails → the run fails (a report without logline/verdict is not
  a report);
- every completed report is schema-validated before it is persisted.
"""

import asyncio
import json
import os
import re
import sqlite3
import traceback
from datetime import datetime, timezone

from .. import ENGINE_VERSION, config
from ..db import repository
from ..parsing import PARSER_VERSION, parse_bytes
from ..runtime.base import ModelRuntime
from ..schemas import validate_report
from . import digest as dg
from . import prompts, retrieval
from .llmjson import StageOutputError, generate_json
from .progress import ProgressBus
from .verify import EvidenceVerifier, consistent_verdict

DIMENSIONS = [
    ("premise_originality", "Premise / Concept / Originality"),
    ("structure_pacing", "Structure & Pacing"),
    ("characterization", "Characterization"),
    ("dialogue", "Dialogue"),
    ("theme_resonance", "Theme & Emotional Resonance"),
    ("marketability", "Marketability / Commercial Potential"),
    ("production_complexity", "Production Complexity"),
    ("representation_content", "Representation & Content"),
]

SCORES = {"weak", "fair", "good", "excellent"}
BUDGET_TIERS = {"micro", "low", "mid", "studio", "tentpole"}
RATING_CATEGORIES = {"language", "violence", "sexual_content", "substances", "thematic"}
VERDICTS = {"pass", "consider", "recommend"}

SCENE_TEXT_MAX_CHARS = 6000

WORKER_OPTS = {"temperature": 0.2, "num_ctx": 4096}
REASONING_OPTS = {"temperature": 0.2, "num_ctx": int(os.environ.get("SCREENSCORE_NUM_CTX", "8192"))}

COMPS_DISCLAIMER = (
    "Comparable titles are model-suggested from its own knowledge and are not "
    "verified against any external source."
)


def _options_tag(options: dict | None) -> str:
    if not options:
        return ""
    import hashlib

    blob = json.dumps(options, sort_keys=True)
    return "@" + hashlib.md5(blob.encode()).hexdigest()[:8]


class PipelineContext:
    def __init__(self, report_id: str, conn: sqlite3.Connection, bus: ProgressBus, runtime: ModelRuntime):
        self.report_id = report_id
        self.conn = conn
        self.bus = bus
        self.runtime = runtime
        report = repository.get_report(conn, report_id)
        self.draft = repository.get_draft(conn, report["draft_id"])
        self.project = repository.get_project(conn, self.draft["project_id"])
        self.worker_model = report["worker_model"]
        self.reasoning_model = report["reasoning_model"]
        self.script_hash = self.draft["content_hash"]

    # -- cache ------------------------------------------------------------
    # Generation options are part of cache identity (audit finding): the same
    # prompt at a different num_ctx/temperature is a different computation.
    def cache_get(self, stage: str, model: str, options: dict | None = None) -> dict | None:
        raw = repository.cache_get(
            self.conn, self.script_hash, stage, model + _options_tag(options), prompts.PROMPT_VERSION
        )
        return json.loads(raw) if raw is not None else None

    def cache_put(self, stage: str, model: str, payload: dict, options: dict | None = None) -> None:
        repository.cache_put(
            self.conn, self.script_hash, stage, model + _options_tag(options),
            prompts.PROMPT_VERSION, json.dumps(payload),
        )

    # -- progress ----------------------------------------------------------
    def stage(self, stage_id: str, label: str, status: str, **extra) -> None:
        self.bus.publish(self.report_id, {
            "type": "stage", "stage": stage_id, "label": label, "status": status, **extra,
        })

    def tick(self, stage_id: str, detail: str) -> None:
        self.bus.publish(self.report_id, {"type": "tick", "stage": stage_id, "detail": detail})


async def run_pipeline(report_id: str, conn: sqlite3.Connection, bus: ProgressBus, runtime: ModelRuntime) -> None:
    """Owns `conn` for the duration of the run and closes it on exit."""
    try:
        ctx = PipelineContext(report_id, conn, bus, runtime)
        repository.mark_report_running(conn, report_id)
        report = await _run(ctx)
        json_rel_path = f"reports/{report_id}.json"
        json_abs_path = config.library_dir() / json_rel_path
        json_abs_path.parent.mkdir(parents=True, exist_ok=True)
        json_abs_path.write_text(json.dumps(report, indent=2))
        repository.mark_report_complete(conn, report_id, json_rel_path)
        bus.publish(report_id, {"type": "done", "report_id": report_id})
    except Exception as exc:
        traceback.print_exc()
        try:
            repository.mark_report_failed(conn, report_id, str(exc))
        except Exception:
            pass
        bus.publish(report_id, {"type": "failed", "error": str(exc)})
    finally:
        conn.close()


async def _run(ctx: PipelineContext) -> dict:
    # 1. parse (cached at upload; regenerate if the cache was cleared).
    # NB: the parse cache is keyed by PARSER_VERSION, not PROMPT_VERSION —
    # the same key the upload path writes — so a parser upgrade re-parses
    # and a prompt bump does not. (Audit finding: these were once mismatched,
    # which duplicated parses and would have served stale ones after a
    # parser upgrade.)
    ctx.stage("parse", "Reading the parsed script", "started")
    raw_parse = repository.cache_get(ctx.conn, ctx.script_hash, "parse", "-", PARSER_VERSION)
    parsed = json.loads(raw_parse) if raw_parse is not None else None
    if parsed is None:
        data = (config.library_dir() / ctx.draft["file_path"]).read_bytes()
        parsed_obj = parse_bytes(data, ctx.draft["source_format"])
        parsed = parsed_obj.as_dict()
        parsed["estimated_page_count"] = parsed_obj.estimated_page_count()
        repository.cache_put(
            ctx.conn, ctx.script_hash, "parse", "-", PARSER_VERSION, json.dumps(parsed)
        )
    if not parsed["scenes"]:
        raise RuntimeError(
            "The script could not be segmented into scenes, so there is nothing to "
            "analyze. Check the file format (parser warnings: "
            + "; ".join(parsed.get("warnings") or ["none"]) + ")"
        )
    ctx.stage("parse", "Reading the parsed script", "completed")

    # 2. deterministic structure
    ctx.stage("segment", "Locating act structure", "started")
    structure = dg.build_structure(parsed)
    ctx.stage("segment", "Locating act structure", "completed")

    # readiness gate — fail fast with an actionable message
    await _check_models(ctx)

    # 3. map pass (worker model, per scene, cached per scene)
    ctx.stage("map", "Summarizing scenes", "started")
    scene_maps = await _map_pass(ctx, parsed)
    ctx.stage("map", "Summarizing scenes", "completed")

    # Character budgets derived from the actual context window so prompts
    # never overflow (the runtime front-truncates silently, which would eat
    # the instructions — worse than a shorter digest).
    budget = retrieval.char_budget(REASONING_OPTS["num_ctx"])
    digest = dg.digest_text(parsed, scene_maps, int(budget * 0.5))
    character_data = dg.character_data_text(parsed, int(budget * 0.12))
    excerpts = dg.excerpts_text(parsed, structure, per_excerpt_chars=max(600, int(budget * 0.15) // 4))
    dim_context_budget = int(budget * 0.2)

    # 4. character breakdowns
    ctx.stage("characters", "Writing character breakdowns", "started")
    characters_section = await _characters(ctx, parsed, digest, character_data)
    ctx.stage("characters", "Writing character breakdowns", "completed")

    # 5. dimension specialists
    ctx.stage("score", "Scoring rubric dimensions", "started")
    rubric = await _specialists(
        ctx, parsed, structure, digest, character_data, excerpts, dim_context_budget
    )
    ctx.stage("score", "Scoring rubric dimensions", "completed")

    # 6. scene notes
    ctx.stage("notes", "Selecting scene notes", "started")
    scene_notes = await _scene_notes(ctx, structure, digest)
    ctx.stage("notes", "Selecting scene notes", "completed")

    # 7. synthesis
    ctx.stage("synthesize", "Synthesizing logline, synopsis and verdict", "started")
    narrative = await _cached_json(ctx, "syn:narrative", ctx.reasoning_model, prompts.render(
        "synthesis_narrative",
        title=ctx.project["title"],
        structure_line=structure.line(),
        digest=digest,
    ))
    commercial = await _cached_json(ctx, "syn:commercial", ctx.reasoning_model, prompts.render(
        "synthesis_commercial",
        title=ctx.project["title"],
        structure_line=structure.line(),
        story_summary=(narrative.get("synopsis") or {}).get("overview") or narrative.get("logline", ""),
        rubric_summary=_rubric_summary(rubric),
        production_signals=dg.production_signals_text(parsed),
    ))
    ctx.stage("synthesize", "Synthesizing logline, synopsis and verdict", "completed")

    # 8. verification — enforce traceability mechanically
    ctx.stage("verify", "Verifying citations against the script", "started")
    verifier = EvidenceVerifier(parsed)
    rubric = verifier.verify_rubric(rubric)
    scene_notes = verifier.verify_scene_notes(scene_notes)
    rating_drivers = verifier.verify_rating_drivers(
        _rating_drivers(commercial, retrieval.content_scan(parsed))
    )
    verdict = consistent_verdict(_verdict(commercial), rubric, verifier.stats)
    ctx.stage("verify", "Verifying citations against the script", "completed",
              detail=verifier.stats.summary())

    # 9. assemble + validate
    ctx.stage("assemble", "Assembling and validating the report", "started")
    info = await ctx.runtime.info()
    report = _assemble(
        ctx, parsed, structure, characters_section, rubric, scene_notes,
        narrative, commercial, rating_drivers, verdict, stub=(info.backend == "fake"),
    )
    validate_report(report)
    ctx.stage("assemble", "Assembling and validating the report", "completed")
    return report


# -- stage implementations -----------------------------------------------------

async def _check_models(ctx: PipelineContext) -> None:
    info = await ctx.runtime.info()
    if not info.available:
        raise RuntimeError(
            "No model runtime is reachable. Install and start Ollama "
            "(https://ollama.com), then re-run the analysis. " + (info.detail or "")
        )
    if info.backend == "fake":
        return
    installed = set(await ctx.runtime.list_models())

    def missing(tag: str) -> bool:
        return tag not in installed and f"{tag}:latest" not in installed

    absent = [m for m in {ctx.worker_model, ctx.reasoning_model} if missing(m)]
    if absent:
        pulls = "  ".join(f"`ollama pull {m}`" for m in absent)
        raise RuntimeError(
            f"Model(s) not installed: {', '.join(absent)}. Pull them first ({pulls}) "
            "or pick installed models on the Analyze page."
        )


async def _map_pass(ctx: PipelineContext, parsed: dict) -> dict[int, dict]:
    scenes = parsed["scenes"]
    concurrency = int(os.environ.get("SCREENSCORE_MAP_CONCURRENCY", "1"))
    semaphore = asyncio.Semaphore(max(1, concurrency))
    results: dict[int, dict] = {}
    done_count = 0

    async def one(scene: dict) -> None:
        nonlocal done_count
        stage_key = f"map:{scene['number']:04d}"
        cached = ctx.cache_get(stage_key, ctx.worker_model, options=WORKER_OPTS)
        if cached is None:
            prompt = prompts.render(
                "map",
                scene_number=str(scene["number"]),
                slugline=scene["slugline"],
                scene_text=(scene.get("raw_text") or "")[:SCENE_TEXT_MAX_CHARS],
            )
            try:
                async with semaphore:
                    cached = await generate_json(ctx.runtime, ctx.worker_model, prompt, options=WORKER_OPTS)
            except StageOutputError:
                # Fallback: a degraded but usable digest entry; never kill a
                # long run over one scene.
                cached = {"summary": _fallback_summary(scene), "tone": [], "notable_lines": []}
            ctx.cache_put(stage_key, ctx.worker_model, cached, options=WORKER_OPTS)
        results[scene["number"]] = cached
        done_count += 1
        ctx.tick("map", f"scene {done_count}/{len(scenes)}")

    await asyncio.gather(*(one(scene) for scene in scenes))
    return results


def _fallback_summary(scene: dict) -> str:
    for element in scene["elements"]:
        if element["type"] == "action" and element["text"].strip():
            return element["text"].strip()[:200]
    return scene["slugline"]


async def _characters(ctx: PipelineContext, parsed: dict, digest: str, character_data: str) -> dict:
    stats = _character_stats(parsed)
    principals = [name for name, _ in stats["ranked"][:8]]
    section = {
        "principals": [
            {
                "name": name,
                "description": "",
                "dialogue_share": round(stats["lines"][name] / stats["total"], 3) if stats["total"] else None,
                "scene_numbers": stats["scenes"][name],
                "arc_summary": "",
            }
            for name in principals
        ],
        "graph": {"edges": stats["edges"]},
    }
    if not principals:
        return section
    payload = ctx.cache_get("characters", ctx.reasoning_model, options=REASONING_OPTS)
    if payload is None:
        prompt = prompts.render("characters", digest=digest, character_data=character_data)
        try:
            payload = await generate_json(ctx.runtime, ctx.reasoning_model, prompt, options=REASONING_OPTS)
        except StageOutputError:
            payload = {"characters": []}
        ctx.cache_put("characters", ctx.reasoning_model, payload, options=REASONING_OPTS)
    described = {c.get("name", ""): c for c in payload.get("characters", []) if isinstance(c, dict)}
    for principal in section["principals"]:
        match = described.get(principal["name"], {})
        principal["description"] = str(match.get("description") or "(no description generated)")
        principal["arc_summary"] = str(match.get("arc_summary") or "(no arc summary generated)")
    return section


def _character_stats(parsed: dict) -> dict:
    lines: dict[str, int] = {}
    scenes: dict[str, list[int]] = {}
    pairs: dict[tuple[str, str], int] = {}
    for scene in parsed["scenes"]:
        present: list[str] = []
        for element in scene["elements"]:
            if element["type"] == "dialogue" and element.get("character"):
                name = element["character"]
                lines[name] = lines.get(name, 0) + 1
                if name not in present:
                    present.append(name)
                    scenes.setdefault(name, []).append(scene["number"])
        for i, a in enumerate(present):
            for b in present[i + 1:]:
                key = tuple(sorted((a, b)))
                pairs[key] = pairs.get(key, 0) + 1
    return {
        "lines": lines,
        "scenes": scenes,
        "total": sum(lines.values()),
        "ranked": sorted(lines.items(), key=lambda kv: -kv[1]),
        "edges": [
            {"a": a, "b": b, "shared_scenes": n}
            for (a, b), n in sorted(pairs.items(), key=lambda kv: -kv[1])
        ],
    }


async def _specialists(
    ctx: PipelineContext, parsed: dict, structure, digest: str,
    character_data: str, excerpts: str, dim_context_budget: int,
) -> list[dict]:
    rubric = []
    for index, (dim_id, dim_name) in enumerate(DIMENSIONS, start=1):
        ctx.tick("score", f"{dim_name} ({index}/{len(DIMENSIONS)})")
        stage_key = f"dim:{dim_id}"
        payload = ctx.cache_get(stage_key, ctx.reasoning_model, options=REASONING_OPTS)
        if payload is None:
            dimension_context = retrieval.dimension_context(
                dim_id, parsed, structure, dim_context_budget
            )
            prompt = prompts.render(
                "specialist",
                dimension_name=dim_name,
                criteria=prompts.load(f"dimensions/{dim_id}").template.strip(),
                structure_line=structure.line(),
                digest=digest,
                character_data=character_data,
                excerpts=excerpts,
                dimension_context=dimension_context or "(none for this dimension)",
            )
            try:
                payload = await generate_json(ctx.runtime, ctx.reasoning_model, prompt, options=REASONING_OPTS)
            except StageOutputError as exc:
                payload = {
                    "score": None,
                    "insufficient_evidence": True,
                    "rationale": f"The analysis model did not produce a usable result for this dimension ({exc}).",
                    "evidence": [],
                }
            ctx.cache_put(stage_key, ctx.reasoning_model, payload, options=REASONING_OPTS)
        rubric.append(_clean_dimension(dim_id, dim_name, payload))
    return rubric


def _clean_dimension(dim_id: str, dim_name: str, payload: dict) -> dict:
    score = payload.get("score")
    score = score.lower().strip() if isinstance(score, str) else None
    insufficient = bool(payload.get("insufficient_evidence")) or score not in SCORES
    evidence = [
        {"scene_number": e["scene_number"], "quote": str(e["quote"]), "note": e.get("note") or None}
        for e in (payload.get("evidence") or [])
        if isinstance(e, dict) and isinstance(e.get("scene_number"), int) and e.get("quote")
    ]
    return {
        "id": dim_id,
        "name": dim_name,
        "score": None if insufficient else score,
        "insufficient_evidence": insufficient,
        "rationale": str(payload.get("rationale") or "No rationale produced.").strip(),
        "evidence": evidence,
    }


async def _scene_notes(ctx: PipelineContext, structure, digest: str) -> list[dict]:
    payload = ctx.cache_get("notes", ctx.reasoning_model, options=REASONING_OPTS)
    if payload is None:
        prompt = prompts.render("notes", structure_line=structure.line(), digest=digest)
        try:
            payload = await generate_json(ctx.runtime, ctx.reasoning_model, prompt, options=REASONING_OPTS)
        except StageOutputError:
            payload = {"notes": []}
        ctx.cache_put("notes", ctx.reasoning_model, payload, options=REASONING_OPTS)
    notes = []
    for note in payload.get("notes", []):
        if not isinstance(note, dict) or not isinstance(note.get("scene_number"), int):
            continue
        kind = note.get("kind")
        if kind not in ("standout", "problem"):
            continue
        item = {
            "scene_number": note["scene_number"],
            "kind": kind,
            "note": str(note.get("note") or "").strip() or "(no note text)",
            "evidence": [],
        }
        if note.get("quote"):
            item["evidence"] = [{"scene_number": note["scene_number"], "quote": str(note["quote"]), "note": None}]
        notes.append(item)
    # Small models repeat themselves: one note per (scene, kind).
    deduped: dict[tuple[int, str], dict] = {}
    for item in notes:
        deduped.setdefault((item["scene_number"], item["kind"]), item)
    return list(deduped.values())[:8]


async def _cached_json(ctx: PipelineContext, stage: str, model: str, prompt: str) -> dict:
    payload = ctx.cache_get(stage, model, options=REASONING_OPTS)
    if payload is None:
        payload = await generate_json(ctx.runtime, model, prompt, options=REASONING_OPTS)
        ctx.cache_put(stage, model, payload, options=REASONING_OPTS)
    return payload


def _rubric_summary(rubric: list[dict]) -> str:
    lines = []
    for dim in rubric:
        score = dim["score"] or "insufficient evidence"
        lines.append(f"- {dim['name']}: {score.upper()} — {dim['rationale'][:200]}")
    return "\n".join(lines)


def _rating_drivers(commercial: dict, scan: dict[str, list[tuple[int, str]]]) -> list[dict]:
    """Model-named drivers, grounded with verbatim lines from the content scan
    so rating claims are citable like everything else."""
    drivers = []
    for driver in (commercial.get("content_rating") or {}).get("drivers", []):
        if not isinstance(driver, dict):
            continue
        category = driver.get("category")
        if category not in RATING_CATEGORIES:
            continue
        evidence = [
            {"scene_number": scene_number, "quote": line, "note": None}
            for scene_number, line in scan.get(category, [])[:2]
        ]
        drivers.append({
            "category": category,
            "detail": str(driver.get("detail") or "").strip() or "(unspecified)",
            "evidence": evidence,
        })
    return drivers


def _clean_comps(raw: list, script_title: str) -> list[dict]:
    """Small models sometimes cite the script itself as its own comparable,
    and copy disclaimer words into titles — scrub both."""
    def norm(t: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()

    comps = []
    for c in raw:
        if not isinstance(c, dict) or not c.get("title"):
            continue
        title = re.sub(r"\s*\((?:unverified|not verified)\)\s*$", "", str(c["title"]), flags=re.IGNORECASE).strip()
        if not title or norm(title) == norm(script_title):
            continue
        comps.append({
            "title": title,
            "year": c.get("year") if isinstance(c.get("year"), int) else None,
            "medium": c.get("medium") if c.get("medium") in ("film", "tv") else None,
            "reason": str(c.get("reason") or ""),
        })
    return comps[:6]


def _verdict(commercial: dict) -> str:
    verdict = ((commercial.get("recommendation") or {}).get("verdict") or "").lower().strip()
    return verdict if verdict in VERDICTS else "consider"


def _assemble(
    ctx: PipelineContext, parsed: dict, structure, characters_section: dict,
    rubric: list[dict], scene_notes: list[dict], narrative: dict, commercial: dict,
    rating_drivers: list[dict], verdict: str, *, stub: bool,
) -> dict:
    synopsis = narrative.get("synopsis") or {}
    acts = [
        {"act": str(act.get("act") or f"Act {i + 1}"), "summary": str(act.get("summary") or "")}
        for i, act in enumerate(synopsis.get("acts") or [])
        if isinstance(act, dict) and act.get("summary")
    ] or [{"act": "Synopsis", "summary": str(synopsis.get("overview") or narrative.get("logline") or "")}]

    genres = [
        {"name": str(g["name"]), "confidence": min(max(float(g.get("confidence", 0.5)), 0.0), 1.0)}
        for g in (commercial.get("genres") or [])
        if isinstance(g, dict) and g.get("name")
    ][:3]

    comps = _clean_comps(commercial.get("comps") or [], ctx.project["title"])

    budget = commercial.get("budget_tier") or {}
    tier = budget.get("tier") if budget.get("tier") in BUDGET_TIERS else "mid"
    drivers = [str(d) for d in (budget.get("drivers") or []) if str(d).strip()] or [
        "(no drivers stated by the model)"
    ]

    rationale = str(((commercial.get("recommendation") or {}).get("rationale")) or "").strip() \
        or "See the scored rubric."

    page_count = parsed.get("page_count") or parsed.get("estimated_page_count")
    return {
        "schema_version": "1.0",
        "meta": {
            "report_id": ctx.report_id,
            "draft_id": ctx.draft["id"],
            "script_hash": ctx.script_hash,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "engine_version": ENGINE_VERSION,
            "prompt_version": prompts.PROMPT_VERSION,
            "models": {"worker": ctx.worker_model, "reasoning": ctx.reasoning_model},
            "stub": stub,
        },
        "header": {
            "title": ctx.project["title"],
            "writers": parsed.get("authors") or [],
            "page_count": page_count,
            "estimated_runtime_minutes": page_count,
            "scene_count": structure.scene_count,
            "genres": genres,
            "source_format": ctx.draft["source_format"],
            "draft_label": ctx.draft["label"],
        },
        "logline": str(narrative.get("logline") or "").strip() or "(no logline produced)",
        "synopsis": {"overview": synopsis.get("overview"), "acts": acts},
        "rubric": rubric,
        "characters": characters_section,
        "comps": {"disclaimer": COMPS_DISCLAIMER, "items": comps},
        "budget_tier": {"tier": tier, "drivers": drivers},
        "content_rating": {
            # Small models sometimes echo the whole enum ("PG-13|R"); keep the
            # first (mildest) option they named.
            "estimated": str((commercial.get("content_rating") or {}).get("estimated") or "unrated").split("|")[0].strip() or "unrated",
            "drivers": rating_drivers,
        },
        "scene_notes": scene_notes,
        "recommendation": {"verdict": verdict, "rationale": rationale},
    }
