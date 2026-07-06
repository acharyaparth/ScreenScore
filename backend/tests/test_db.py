"""Persistence: CRUD, restart survival, report immutability."""

import pytest

from screenscore import db
from screenscore.db import repository


@pytest.fixture
def conn(tmp_path):
    conn = db.connect(tmp_path / "test.db")
    db.migrate(conn)
    return conn


def seed(conn):
    project = repository.create_project(conn, "Cold Open")
    draft = repository.create_draft(
        conn, project["id"], "hash1", "cold_open.fountain", "fountain", "projects/p/hash1.fountain"
    )
    report = repository.create_report(conn, draft["id"], "1.0", "stub-0", None, None)
    return project, draft, report


def test_crud_roundtrip(conn):
    project, draft, report = seed(conn)
    assert repository.get_project(conn, project["id"])["title"] == "Cold Open"
    assert repository.find_draft_by_hash(conn, project["id"], "hash1")["id"] == draft["id"]
    assert repository.get_report(conn, report["id"])["status"] == "queued"

    annotation = repository.create_annotation(conn, report["id"], "/rubric/1", "working", "tightening act two")
    updated = repository.update_annotation(conn, annotation["id"], status="addressed")
    assert updated["status"] == "addressed"
    assert updated["note"] == "tightening act two"


def test_persistence_survives_reconnect(tmp_path):
    """Simulates an app restart: new connection, same file."""
    path = tmp_path / "restart.db"
    conn1 = db.connect(path)
    db.migrate(conn1)
    project, draft, report = seed(conn1)
    repository.mark_report_running(conn1, report["id"])
    repository.mark_report_complete(conn1, report["id"], "reports/x.json")
    conn1.close()

    conn2 = db.connect(path)
    db.migrate(conn2)  # idempotent
    assert repository.get_project(conn2, project["id"])["title"] == "Cold Open"
    assert repository.get_report(conn2, report["id"])["status"] == "complete"
    assert len(repository.list_drafts(conn2, project["id"])) == 1


def test_report_lifecycle_transitions(conn):
    _, _, report = seed(conn)
    repository.mark_report_running(conn, report["id"])
    repository.mark_report_complete(conn, report["id"], "reports/r.json")
    row = repository.get_report(conn, report["id"])
    assert row["status"] == "complete"
    assert row["json_path"] == "reports/r.json"
    assert row["completed_at"] is not None


def test_completed_reports_are_immutable(conn):
    _, _, report = seed(conn)
    repository.mark_report_running(conn, report["id"])
    repository.mark_report_complete(conn, report["id"], "reports/r.json")
    with pytest.raises(repository.IllegalReportTransition):
        repository.mark_report_failed(conn, report["id"], "nope")
    with pytest.raises(repository.IllegalReportTransition):
        repository.mark_report_running(conn, report["id"])


def test_cannot_complete_unstarted_report(conn):
    _, _, report = seed(conn)
    with pytest.raises(repository.IllegalReportTransition):
        repository.mark_report_complete(conn, report["id"], "reports/r.json")


def test_duplicate_draft_hash_rejected_per_project(conn):
    project, _, _ = seed(conn)
    import sqlite3

    with pytest.raises(sqlite3.IntegrityError):
        repository.create_draft(
            conn, project["id"], "hash1", "same_file.fountain", "fountain", "projects/p/dup.fountain"
        )


def test_pipeline_cache_roundtrip(conn):
    assert repository.cache_get(conn, "h", "map", "m", "p1") is None
    repository.cache_put(conn, "h", "map", "m", "p1", '{"scenes": []}')
    assert repository.cache_get(conn, "h", "map", "m", "p1") == '{"scenes": []}'
    # different prompt version = different cache slot
    assert repository.cache_get(conn, "h", "map", "m", "p2") is None
