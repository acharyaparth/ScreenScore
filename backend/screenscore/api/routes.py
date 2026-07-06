"""HTTP API. The frontend (and any other consumer) talks only to these routes.

Privacy note: nothing here makes an outbound network call except the model
runtime talking to a local Ollama, and the (user-initiated) model pull.
"""

import asyncio
import hashlib
import json
import re

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import ENGINE_VERSION, config, hardware
from ..db import repository
from ..parsing import PARSER_VERSION, parse_bytes
from ..pipeline import diff as diffmod
from ..pipeline import prompts, stages

router = APIRouter()

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
EXTENSION_FORMATS = {".pdf": "pdf", ".txt": "txt", ".fountain": "fountain", ".fdx": "fdx"}


def _row(row) -> dict | None:
    return dict(row) if row is not None else None


def _title_from_filename(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0]
    cleaned = re.sub(r"[_\-]+", " ", stem).strip()
    return cleaned.title() if cleaned else "Untitled"


def _normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


# -- health & hardware --------------------------------------------------------

@router.get("/health")
async def health(request: Request):
    conn = request.app.state.conn
    conn.execute("SELECT 1")
    runtime_info = await request.app.state.runtime.info()
    return {
        "status": "ok",
        "engine_version": ENGINE_VERSION,
        "schema_version": config.REPORT_SCHEMA_VERSION,
        "runtime": runtime_info.__dict__,
    }


@router.get("/hardware")
async def hardware_info(request: Request):
    hw = hardware.detect()
    rec = hardware.recommend(hw)
    installed: list[str] = []
    runtime_available = False
    try:
        installed = await request.app.state.runtime.list_models()
        runtime_available = True
    except RuntimeError:
        pass

    return {
        "hardware": hw.__dict__,
        "recommendation": rec.as_dict(),
        "runtime_available": runtime_available,
        "installed_models": installed,
        "models_ready": {
            "worker": rec.worker_model in installed,
            "reasoning": rec.reasoning_model in installed,
        },
    }


# -- projects & library -------------------------------------------------------

@router.get("/projects")
def list_projects(request: Request):
    conn = request.app.state.conn
    return {"projects": [dict(r) for r in repository.list_projects(conn)]}


@router.get("/projects/{project_id}")
def get_project(request: Request, project_id: str):
    conn = request.app.state.conn
    project = repository.get_project(conn, project_id)
    if project is None:
        raise HTTPException(404, "project not found")
    drafts = []
    for draft in repository.list_drafts(conn, project_id):
        reports = []
        for report in repository.list_reports(conn, draft["id"]):
            annotations = repository.list_annotations(conn, report["id"])
            counts = {"addressed": 0, "dismissed": 0, "working": 0}
            for a in annotations:
                counts[a["status"]] = counts.get(a["status"], 0) + 1
            reports.append({**dict(report), "annotation_counts": counts})
        drafts.append({**dict(draft), "reports": reports})
    diffs = [
        {**dict(d), "payload": json.loads(d["payload"]) if d["payload"] else None}
        for d in repository.list_diffs(conn, project_id)
    ]
    return {**dict(project), "drafts": drafts, "diffs": diffs}


# -- analyze ------------------------------------------------------------------

@router.post("/analyze")
async def analyze(
    request: Request,
    file: UploadFile,
    project_id: str | None = Form(default=None),
    draft_label: str | None = Form(default=None),
    worker_model: str | None = Form(default=None),
    reasoning_model: str | None = Form(default=None),
):
    conn = request.app.state.conn
    bus = request.app.state.bus

    suffix = ("." + file.filename.rsplit(".", 1)[-1].lower()) if "." in (file.filename or "") else ""
    source_format = EXTENSION_FORMATS.get(suffix)
    if source_format is None:
        raise HTTPException(400, f"Unsupported file type '{suffix}'. Accepted: PDF, TXT, Fountain, FDX.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "File exceeds the 20 MB limit.")
    if not content:
        raise HTTPException(400, "Uploaded file is empty.")
    content_hash = hashlib.sha256(content).hexdigest()

    # Parse now: it validates the file, recovers the real title, and the
    # digest is cached for the pipeline (keyed by content hash + parser
    # version, so a parser upgrade re-parses automatically).
    cached = repository.cache_get(conn, content_hash, "parse", "-", PARSER_VERSION)
    if cached is not None:
        parsed_dict = json.loads(cached)
    else:
        parsed = await asyncio.to_thread(parse_bytes, content, source_format)
        parsed_dict = parsed.as_dict()
        parsed_dict["estimated_page_count"] = parsed.estimated_page_count()
        repository.cache_put(
            conn, content_hash, "parse", "-", PARSER_VERSION, json.dumps(parsed_dict)
        )

    attached_to_existing = False
    if project_id:
        project = repository.get_project(conn, project_id)
        if project is None:
            raise HTTPException(404, "project not found")
    else:
        title = parsed_dict.get("title") or _title_from_filename(file.filename)
        # Draft-of-known-project detection: a re-upload with the same title is
        # a new draft of that project, not a stranger.
        project = next(
            (p for p in repository.list_projects(conn)
             if _normalize_title(p["title"]) == _normalize_title(title)),
            None,
        )
        attached_to_existing = project is not None
        if project is None:
            project = repository.create_project(conn, title)

    draft = repository.find_draft_by_hash(conn, project["id"], content_hash)
    if draft is None:
        rel_path = f"projects/{project['id']}/{content_hash[:16]}{suffix}"
        abs_path = config.library_dir() / rel_path
        abs_path.parent.mkdir(parents=True, exist_ok=True)
        abs_path.write_bytes(content)
        draft = repository.create_draft(
            conn,
            project_id=project["id"],
            content_hash=content_hash,
            original_filename=file.filename,
            source_format=source_format,
            file_path=rel_path,
            label=draft_label,
        )

    if not worker_model or not reasoning_model:
        recommendation = hardware.recommend(hardware.detect())
        worker_model = worker_model or recommendation.worker_model
        reasoning_model = reasoning_model or recommendation.reasoning_model

    report = repository.create_report(
        conn,
        draft_id=draft["id"],
        schema_version=config.REPORT_SCHEMA_VERSION,
        prompt_version=prompts.PROMPT_VERSION,
        worker_model=worker_model,
        reasoning_model=reasoning_model,
    )
    asyncio.create_task(
        stages.run_pipeline(report["id"], conn, bus, request.app.state.runtime)
    )
    return {
        "project_id": project["id"],
        "draft_id": draft["id"],
        "report_id": report["id"],
        "attached_to_existing": attached_to_existing,
        "parse_summary": {
            "title": parsed_dict.get("title"),
            "scene_count": len(parsed_dict.get("scenes", [])),
            "page_count": parsed_dict.get("page_count") or parsed_dict.get("estimated_page_count"),
            "warnings": parsed_dict.get("warnings", []),
        },
    }


@router.get("/drafts/{draft_id}/parse")
def get_parse(request: Request, draft_id: str):
    """The cached structured parse for a draft (scenes, characters, warnings)."""
    conn = request.app.state.conn
    draft = repository.get_draft(conn, draft_id)
    if draft is None:
        raise HTTPException(404, "draft not found")
    cached = repository.cache_get(conn, draft["content_hash"], "parse", "-", PARSER_VERSION)
    if cached is None:
        raise HTTPException(404, "no parse cached for this draft (re-upload to regenerate)")
    return json.loads(cached)


# -- reports ------------------------------------------------------------------

@router.get("/reports/{report_id}")
def get_report(request: Request, report_id: str):
    conn = request.app.state.conn
    row = repository.get_report(conn, report_id)
    if row is None:
        raise HTTPException(404, "report not found")
    payload = {**dict(row), "report": None}
    if row["status"] == "complete" and row["json_path"]:
        payload["report"] = json.loads((config.library_dir() / row["json_path"]).read_text())
    return payload


@router.get("/reports/{report_id}/events")
async def report_events(request: Request, report_id: str):
    conn = request.app.state.conn
    bus = request.app.state.bus
    row = repository.get_report(conn, report_id)
    if row is None:
        raise HTTPException(404, "report not found")

    async def gen():
        # After a server restart the bus has no history for old runs; emit the
        # terminal state straight from the DB.
        if row["status"] in ("complete", "failed") and not bus.finished(report_id):
            event = (
                {"type": "done", "report_id": report_id, "seq": 0}
                if row["status"] == "complete"
                else {"type": "failed", "error": row["error"] or "unknown error", "seq": 0}
            )
            yield f"data: {json.dumps(event)}\n\n"
            return
        async for event in bus.stream(report_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# -- diffs ---------------------------------------------------------------------

class DiffRequest(BaseModel):
    from_report_id: str
    to_report_id: str


@router.post("/diffs")
async def create_diff(request: Request, body: DiffRequest):
    conn = request.app.state.conn
    if body.from_report_id == body.to_report_id:
        raise HTTPException(400, "cannot compare a report with itself")
    from_row = repository.get_report(conn, body.from_report_id)
    to_row = repository.get_report(conn, body.to_report_id)
    if from_row is None or to_row is None:
        raise HTTPException(404, "report not found")
    if from_row["status"] != "complete" or to_row["status"] != "complete":
        raise HTTPException(400, "both reports must be complete before comparing")
    from_draft = repository.get_draft(conn, from_row["draft_id"])
    to_draft = repository.get_draft(conn, to_row["draft_id"])
    if from_draft["project_id"] != to_draft["project_id"]:
        raise HTTPException(400, "reports belong to different projects")

    existing = repository.find_diff(conn, body.from_report_id, body.to_report_id, prompts.PROMPT_VERSION)
    if existing is not None:
        if existing["status"] != "failed":
            return {"diff_id": existing["id"], "status": existing["status"]}
        repository.delete_diff(conn, existing["id"])

    row = repository.create_diff(
        conn,
        project_id=to_draft["project_id"],
        from_report_id=body.from_report_id,
        to_report_id=body.to_report_id,
        prompt_version=prompts.PROMPT_VERSION,
        model=to_row["reasoning_model"],
    )
    asyncio.create_task(
        diffmod.run_diff(row["id"], conn, request.app.state.bus, request.app.state.runtime)
    )
    return {"diff_id": row["id"], "status": "queued"}


@router.get("/diffs/{diff_id}")
def get_diff(request: Request, diff_id: str):
    conn = request.app.state.conn
    row = repository.get_diff(conn, diff_id)
    if row is None:
        raise HTTPException(404, "diff not found")
    payload = json.loads(row["payload"]) if row["payload"] else None
    return {**dict(row), "payload": payload}


# -- models -------------------------------------------------------------------

class PullRequest(BaseModel):
    model: str


@router.post("/models/pull")
async def pull_model(request: Request, body: PullRequest):
    """User-initiated model download — the one permitted outbound activity."""
    runtime = request.app.state.runtime

    async def gen():
        try:
            async for event in runtime.pull(body.model):
                yield f"data: {json.dumps(event)}\n\n"
            yield f'data: {json.dumps({"status": "done", "model": body.model})}\n\n'
        except Exception as exc:
            yield f'data: {json.dumps({"status": "error", "error": str(exc)})}\n\n'

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# -- annotations --------------------------------------------------------------

class AnnotationIn(BaseModel):
    target_ref: str
    status: str  # addressed | dismissed | working
    note: str | None = None


class AnnotationPatch(BaseModel):
    status: str | None = None
    note: str | None = None


@router.get("/reports/{report_id}/annotations")
def list_annotations(request: Request, report_id: str):
    conn = request.app.state.conn
    if repository.get_report(conn, report_id) is None:
        raise HTTPException(404, "report not found")
    return {"annotations": [dict(a) for a in repository.list_annotations(conn, report_id)]}


@router.post("/reports/{report_id}/annotations", status_code=201)
def create_annotation(request: Request, report_id: str, body: AnnotationIn):
    conn = request.app.state.conn
    if repository.get_report(conn, report_id) is None:
        raise HTTPException(404, "report not found")
    if body.status not in ("addressed", "dismissed", "working"):
        raise HTTPException(400, "status must be addressed, dismissed or working")
    row = repository.create_annotation(conn, report_id, body.target_ref, body.status, body.note)
    return dict(row)


@router.patch("/annotations/{annotation_id}")
def patch_annotation(request: Request, annotation_id: str, body: AnnotationPatch):
    conn = request.app.state.conn
    if body.status is not None and body.status not in ("addressed", "dismissed", "working"):
        raise HTTPException(400, "status must be addressed, dismissed or working")
    try:
        row = repository.update_annotation(conn, annotation_id, body.status, body.note)
    except KeyError:
        raise HTTPException(404, "annotation not found")
    return dict(row)
