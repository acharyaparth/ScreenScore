"""The report schema is the engine↔UI contract; these tests pin its rules."""

import pytest

from screenscore.schemas import ReportValidationError, validate_report

from report_fixture import make_report


def test_fixture_report_is_schema_valid():
    validate_report(make_report())


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
