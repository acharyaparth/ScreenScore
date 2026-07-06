"""Pipeline behaviors that matter: caching, resume after a crash, and the
report actually reflecting the analyzed script."""

import asyncio

from screenscore.runtime.fake import FakeRuntime

THREE_SCENE_SCRIPT = b"""Title: Resume Test

INT. KITCHEN - DAY

TOM stirs cold coffee, staring at nothing much at all.

TOM
We're out of everything that matters.

EXT. STREET - NIGHT

Tom walks past shuttered storefronts in the rain.

TOM
Every light on this street went out years ago.

INT. DINER - NIGHT

MAE slides a plate across the counter without being asked.

MAE
You look like a man who forgot how to ask for things.
"""


async def wait_done(client, report_id, timeout=15.0):
    async def poll():
        while True:
            body = (await client.get(f"/api/reports/{report_id}")).json()
            if body["status"] in ("complete", "failed"):
                return body
            await asyncio.sleep(0.02)

    return await asyncio.wait_for(poll(), timeout)


async def analyze(client, project_id=None):
    data = {"project_id": project_id} if project_id else {}
    resp = await client.post(
        "/api/analyze", data=data,
        files={"file": ("resume_test.fountain", THREE_SCENE_SCRIPT, "text/plain")},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


async def test_second_run_is_fully_cached(app, client):
    runtime: FakeRuntime = app.state.runtime
    first = await analyze(client)
    body = await wait_done(client, first["report_id"])
    assert body["status"] == "complete"
    calls_after_first = runtime.generate_calls
    assert calls_after_first > 0

    second = await analyze(client, project_id=first["project_id"])
    body2 = await wait_done(client, second["report_id"])
    assert body2["status"] == "complete"
    # Same script hash + same models + same prompt version → every stage
    # comes from cache; the models are never called again.
    assert runtime.generate_calls == calls_after_first
    assert second["report_id"] != first["report_id"]


class FlakyRuntime(FakeRuntime):
    """Dies once at the characters stage — after the map pass has cached."""

    def __init__(self):
        super().__init__()
        self.crashed = False

    async def generate(self, model, prompt, **kwargs):
        if not self.crashed and self._kind(prompt) == "characters":
            self.crashed = True
            raise RuntimeError("simulated crash: model runtime died mid-run")
        return await super().generate(model, prompt, **kwargs)


async def test_crashed_run_resumes_from_stage_cache(app, client):
    flaky = FlakyRuntime()
    app.state.runtime = flaky

    first = await analyze(client)
    body = await wait_done(client, first["report_id"])
    assert body["status"] == "failed"
    assert "simulated crash" in body["error"]
    map_calls_first = flaky.history.count("map")
    assert map_calls_first == 3  # all scenes mapped and cached before the crash

    second = await analyze(client, project_id=first["project_id"])
    body2 = await wait_done(client, second["report_id"])
    assert body2["status"] == "complete"
    # Resume: the map pass was not re-generated.
    assert flaky.history.count("map") == map_calls_first


async def test_report_reflects_the_script(app, client):
    ids = await analyze(client)
    body = await wait_done(client, ids["report_id"])
    report = body["report"]

    assert report["header"]["scene_count"] == 3
    assert {c["name"] for c in report["characters"]["principals"]} == {"TOM", "MAE"}
    tom = next(c for c in report["characters"]["principals"] if c["name"] == "TOM")
    assert tom["scene_numbers"] == [1, 2]
    assert tom["dialogue_share"] and tom["dialogue_share"] > 0.5

    script_text = THREE_SCENE_SCRIPT.decode()
    for dim in report["rubric"]:
        assert not dim["insufficient_evidence"]
        for evidence in dim["evidence"]:
            assert evidence["quote"] in script_text  # verification guarantee
    for note in report["scene_notes"]:
        assert note["scene_number"] in (1, 2, 3)

    assert report["meta"]["stub"] is True  # fake runtime is always labeled
    assert report["recommendation"]["verdict"] in ("pass", "consider", "recommend")


async def test_prompt_version_changes_bust_cache(app, client, monkeypatch):
    runtime: FakeRuntime = app.state.runtime
    first = await analyze(client)
    await wait_done(client, first["report_id"])
    calls_after_first = runtime.generate_calls

    from screenscore.pipeline import prompts
    monkeypatch.setattr(prompts, "PROMPT_VERSION", "999-test")

    second = await analyze(client, project_id=first["project_id"])
    body2 = await wait_done(client, second["report_id"])
    assert body2["status"] == "complete"
    assert runtime.generate_calls > calls_after_first  # cache was not reused
