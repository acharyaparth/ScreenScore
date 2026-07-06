"""The report schema is the engine↔UI contract; these tests pin its rules."""

import pytest

from screenscore.pipeline.stub import build_stub_report
from screenscore.schemas import ReportValidationError, validate_report


def make_report(**overrides):
    report = build_stub_report(
        report_id="r1",
        draft_id="d1",
        script_hash="abc123",
        title="Test Script",
        source_format="fountain",
        draft_label=None,
    )
    report.update(overrides)
    return report


def test_stub_report_is_schema_valid():
    validate_report(make_report())


def test_stub_reports_are_marked_stub():
    assert make_report()["meta"]["stub"] is True


def test_scored_dimension_requires_evidence():
    report = make_report()
    report["rubric"][0]["evidence"] = []  # scored but no citation → invalid
    with pytest.raises(ReportValidationError):
        validate_report(report)


def test_insufficient_evidence_forbids_score():
    report = make_report()
    report["rubric"][0]["insufficient_evidence"] = True
    report["rubric"][0]["score"] = "good"  # must be null when insufficient
    with pytest.raises(ReportValidationError):
        validate_report(report)


def test_insufficient_evidence_with_null_score_is_valid():
    report = make_report()
    report["rubric"][0]["insufficient_evidence"] = True
    report["rubric"][0]["score"] = None
    report["rubric"][0]["evidence"] = []
    validate_report(report)


def test_numeric_scores_rejected():
    report = make_report()
    report["rubric"][0]["score"] = 7  # categorical only, per the coverage spec
    with pytest.raises(ReportValidationError):
        validate_report(report)


def test_verdict_is_industry_trichotomy():
    report = make_report()
    report["recommendation"]["verdict"] = "strong recommend"
    with pytest.raises(ReportValidationError):
        validate_report(report)


def test_missing_section_rejected():
    report = make_report()
    del report["scene_notes"]
    with pytest.raises(ReportValidationError):
        validate_report(report)
