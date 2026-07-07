"""Exports render from the same immutable report JSON the UI consumes."""

import asyncio

from screenscore.export import export_filename, to_markdown, to_pdf

from report_fixture import make_report

SAMPLE = b"""Title: Export Test

INT. KITCHEN - DAY

TOM stirs cold coffee, staring at nothing much at all.

TOM
We're out of everything that matters.
"""


def test_markdown_contains_scores_and_citations():
    md = to_markdown(make_report())
    assert "# Test Script — Script Coverage" in md
    assert "**Recommendation: CONSIDER**" in md
    assert "| Structure_Pacing | Fair |" in md
    assert "Scene 3" in md and "A quoted line." in md
    assert "Nothing left this machine." in md


def test_markdown_insufficient_evidence_labeled():
    report = make_report()
    report["rubric"][0]["insufficient_evidence"] = True
    report["rubric"][0]["score"] = None
    md = to_markdown(report)
    assert "Insufficient evidence" in md


def test_pdf_renders_valid_bytes():
    pdf = to_pdf(make_report())
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 2000


def test_pdf_survives_unicode():
    report = make_report()
    report["logline"] = "A “quoted” logline — with em-dashes… and ‘curly’ quotes."
    pdf = to_pdf(report)
    assert pdf.startswith(b"%PDF")


def test_export_filename_sanitized():
    report = make_report()
    report["header"]["title"] = 'Bad/Name: "Draft*3"'
    assert export_filename(report, "pdf") == "BadName Draft3 - ScreenScore coverage.pdf"


async def test_export_endpoints(client):
    resp = await client.post(
        "/api/analyze", files={"file": ("export_test.fountain", SAMPLE, "text/plain")},
    )
    report_id = resp.json()["report_id"]

    async def wait():
        while True:
            body = (await client.get(f"/api/reports/{report_id}")).json()
            if body["status"] in ("complete", "failed"):
                return body
            await asyncio.sleep(0.02)

    body = await asyncio.wait_for(wait(), 15)
    assert body["status"] == "complete"

    md = await client.get(f"/api/reports/{report_id}/export/md")
    assert md.status_code == 200
    assert "Export Test" in md.text
    assert "attachment" in md.headers["content-disposition"]

    js = await client.get(f"/api/reports/{report_id}/export/json")
    assert js.json()["schema_version"] == "1.0"

    pdf = await client.get(f"/api/reports/{report_id}/export/pdf")
    assert pdf.content.startswith(b"%PDF")

    bad = await client.get(f"/api/reports/{report_id}/export/docx")
    assert bad.status_code == 400
