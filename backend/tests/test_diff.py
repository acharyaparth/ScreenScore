"""Cross-draft diff: mechanical score movement, the honest narrative pass,
and draft-of-known-project detection."""

import asyncio

from screenscore.pipeline.diff import dimension_changes

DRAFT_ONE = b"""Title: Same Story

INT. KITCHEN - DAY

TOM stirs cold coffee, staring at nothing much at all.

TOM
We're out of everything that matters.

EXT. STREET - NIGHT

Tom walks past shuttered storefronts in the rain.

TOM
Every light on this street went out years ago.
"""

DRAFT_TWO = b"""Title: Same Story

INT. KITCHEN - DAY

TOM pours the coffee down the sink, decided about something.

TOM
Today we fix what matters.

EXT. STREET - NIGHT

Tom walks fast past shuttered storefronts, collar up against the rain.

TOM
One of these lights is coming back on.

INT. DINER - NIGHT

MAE watches Tom walk in like she expected him an hour ago.

MAE
Took you long enough.
"""


def dim(dim_id, score):
    return {"id": dim_id, "name": dim_id.title(), "score": score}


def test_dimension_changes_directions():
    changes = dimension_changes(
        [dim("a", "weak"), dim("b", "good"), dim("c", "fair"), dim("d", None), dim("e", "fair")],
        [dim("a", "good"), dim("b", "fair"), dim("c", "fair"), dim("d", "fair"), dim("e", None)],
    )
    by_id = {c["id"]: c["direction"] for c in changes}
    assert by_id == {
        "a": "improved",
        "b": "declined",
        "c": "unchanged",
        "d": "newly_scored",
        "e": "newly_unscored",
    }


def test_dimension_changes_handles_new_dimension():
    changes = dimension_changes([dim("a", "fair")], [dim("a", "fair"), dim("z", "good")])
    assert {c["id"]: c["direction"] for c in changes}["z"] == "new_dimension"


async def wait_status(client, url, timeout=15.0):
    async def poll():
        while True:
            body = (await client.get(url)).json()
            if body["status"] in ("complete", "failed"):
                return body
            await asyncio.sleep(0.02)

    return await asyncio.wait_for(poll(), timeout)


async def analyze_and_wait(client, content, filename="same_story.fountain"):
    resp = await client.post(
        "/api/analyze", files={"file": (filename, content, "text/plain")},
    )
    assert resp.status_code == 200, resp.text
    ids = resp.json()
    body = await wait_status(client, f"/api/reports/{ids['report_id']}")
    assert body["status"] == "complete", body.get("error")
    return ids


async def test_reupload_same_title_attaches_to_project(client):
    first = await analyze_and_wait(client, DRAFT_ONE)
    second = await analyze_and_wait(client, DRAFT_TWO, filename="same_story_v2.fountain")
    assert second["attached_to_existing"] is True
    assert second["project_id"] == first["project_id"]
    assert second["draft_id"] != first["draft_id"]  # different content → new draft

    project = (await client.get(f"/api/projects/{first['project_id']}")).json()
    assert len(project["drafts"]) == 2


async def test_diff_end_to_end(client):
    first = await analyze_and_wait(client, DRAFT_ONE)
    second = await analyze_and_wait(client, DRAFT_TWO, filename="same_story_v2.fountain")

    resp = await client.post("/api/diffs", json={
        "from_report_id": first["report_id"], "to_report_id": second["report_id"],
    })
    assert resp.status_code == 200, resp.text
    diff_id = resp.json()["diff_id"]
    body = await wait_status(client, f"/api/diffs/{diff_id}")
    assert body["status"] == "complete", body.get("error")

    payload = body["payload"]
    assert len(payload["mechanical"]["dimensions"]) == 8
    assert payload["mechanical"]["verdict"]["from"] in ("pass", "consider", "recommend")
    assert payload["mechanical"]["size"]["to_scenes"] == 3
    # The narrative pass is contractually willing to report regressions.
    assert isinstance(payload["narrative"]["regressions"], list)
    assert payload["narrative"]["overall"]

    # Requesting the same comparison again reuses the stored diff.
    again = (await client.post("/api/diffs", json={
        "from_report_id": first["report_id"], "to_report_id": second["report_id"],
    })).json()
    assert again["diff_id"] == diff_id

    # And it shows up on the project.
    project = (await client.get(f"/api/projects/{first['project_id']}")).json()
    assert [d["id"] for d in project["diffs"]] == [diff_id]


async def test_diff_rejects_cross_project_and_incomplete(client):
    first = await analyze_and_wait(client, DRAFT_ONE)
    other = await analyze_and_wait(
        client,
        DRAFT_TWO.replace(b"Title: Same Story", b"Title: Unrelated Story"),
        filename="unrelated.fountain",
    )
    resp = await client.post("/api/diffs", json={
        "from_report_id": first["report_id"], "to_report_id": other["report_id"],
    })
    assert resp.status_code == 400
    assert "different projects" in resp.json()["detail"]

    resp = await client.post("/api/diffs", json={
        "from_report_id": first["report_id"], "to_report_id": first["report_id"],
    })
    assert resp.status_code == 400
