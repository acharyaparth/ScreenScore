"""End-to-end over the HTTP API: upload → stub pipeline → SSE → report → persistence."""

import asyncio
import json

import httpx
import pytest

FOUNTAIN_SAMPLE = b"""Title: Cold Open
Author: Test Writer

INT. LIGHTHOUSE - NIGHT

The beam sweeps the water. MARA (40s) grips the rail.

MARA
You said the storm would pass.
"""


@pytest.fixture
async def client(data_dir):
    from screenscore.main import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.state.conn.close()


async def wait_complete(client, report_id, timeout=10.0):
    async def poll():
        while True:
            resp = await client.get(f"/api/reports/{report_id}")
            body = resp.json()
            if body["status"] in ("complete", "failed"):
                return body
            await asyncio.sleep(0.02)

    return await asyncio.wait_for(poll(), timeout)


async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["schema_version"] == "1.0"


async def test_hardware_endpoint(client):
    resp = await client.get("/api/hardware")
    assert resp.status_code == 200
    body = resp.json()
    assert body["hardware"]["total_ram_gb"] > 0
    assert body["recommendation"]["worker_model"]
    assert body["recommendation"]["reasoning_model"]


async def test_analyze_end_to_end(client):
    resp = await client.post(
        "/api/analyze",
        files={"file": ("cold_open.fountain", FOUNTAIN_SAMPLE, "text/plain")},
    )
    assert resp.status_code == 200, resp.text
    ids = resp.json()

    body = await wait_complete(client, ids["report_id"])
    assert body["status"] == "complete"
    report = body["report"]
    assert report["schema_version"] == "1.0"
    assert report["meta"]["stub"] is True
    assert report["header"]["title"] == "Cold Open"
    assert len(report["rubric"]) == 8
    for dim in report["rubric"]:
        assert dim["insufficient_evidence"] or (dim["score"] and dim["evidence"])

    # library persisted: project visible with draft + report
    projects = (await client.get("/api/projects")).json()["projects"]
    assert len(projects) == 1
    detail = (await client.get(f"/api/projects/{ids['project_id']}")).json()
    assert detail["drafts"][0]["reports"][0]["status"] == "complete"


async def test_sse_stream_reaches_done(client):
    resp = await client.post(
        "/api/analyze",
        files={"file": ("cold_open.fountain", FOUNTAIN_SAMPLE, "text/plain")},
    )
    report_id = resp.json()["report_id"]

    events = []

    async def read_stream():
        async with client.stream("GET", f"/api/reports/{report_id}/events") as stream:
            async for line in stream.aiter_lines():
                if line.startswith("data: "):
                    event = json.loads(line[len("data: "):])
                    events.append(event)
                    if event["type"] in ("done", "failed"):
                        return

    await asyncio.wait_for(read_stream(), timeout=10.0)
    types = [e["type"] for e in events]
    assert types[-1] == "done"
    stages = [e["stage"] for e in events if e["type"] == "stage" and e["status"] == "completed"]
    assert stages == ["ingest", "segment", "map", "score", "synthesize", "assemble"]


async def test_sse_after_completion_replays_done(client):
    resp = await client.post(
        "/api/analyze",
        files={"file": ("cold_open.fountain", FOUNTAIN_SAMPLE, "text/plain")},
    )
    report_id = resp.json()["report_id"]
    await wait_complete(client, report_id)

    async with client.stream("GET", f"/api/reports/{report_id}/events") as stream:
        async for line in stream.aiter_lines():
            if line.startswith("data: "):
                event = json.loads(line[len("data: "):])
                if event["type"] == "done":
                    return
    pytest.fail("never saw done event on reconnect")


async def test_duplicate_upload_reuses_draft(client):
    first = (await client.post(
        "/api/analyze", files={"file": ("a.fountain", FOUNTAIN_SAMPLE, "text/plain")},
    )).json()
    await wait_complete(client, first["report_id"])
    second = (await client.post(
        "/api/analyze",
        data={"project_id": first["project_id"]},
        files={"file": ("a.fountain", FOUNTAIN_SAMPLE, "text/plain")},
    )).json()
    assert second["draft_id"] == first["draft_id"]  # same content, same draft
    assert second["report_id"] != first["report_id"]  # new run
    await wait_complete(client, second["report_id"])


async def test_unsupported_extension_rejected(client):
    resp = await client.post(
        "/api/analyze", files={"file": ("script.docx", b"whatever", "application/octet-stream")},
    )
    assert resp.status_code == 400


async def test_annotations_crud(client):
    ids = (await client.post(
        "/api/analyze", files={"file": ("b.fountain", FOUNTAIN_SAMPLE, "text/plain")},
    )).json()
    await wait_complete(client, ids["report_id"])

    created = (await client.post(
        f"/api/reports/{ids['report_id']}/annotations",
        json={"target_ref": "/rubric/1", "status": "working", "note": "act two pacing"},
    )).json()
    patched = (await client.patch(
        f"/api/annotations/{created['id']}", json={"status": "addressed"},
    )).json()
    assert patched["status"] == "addressed"
    listed = (await client.get(f"/api/reports/{ids['report_id']}/annotations")).json()
    assert len(listed["annotations"]) == 1
