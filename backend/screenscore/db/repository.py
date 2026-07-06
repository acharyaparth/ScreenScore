"""CRUD over the persistence schema. Flat functions taking a connection —
no ORM, no repository classes. Report immutability is enforced here:
a report row can only move queued → running → complete | failed, and a
complete/failed report never changes again.
"""

import sqlite3
import uuid

from . import now_iso

REPORT_TRANSITIONS = {
    "queued": {"running", "failed"},
    "running": {"complete", "failed"},
    "complete": set(),
    "failed": set(),
}


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# -- projects -----------------------------------------------------------------

def create_project(conn: sqlite3.Connection, title: str) -> sqlite3.Row:
    pid = _new_id()
    conn.execute(
        "INSERT INTO projects (id, title, created_at) VALUES (?, ?, ?)",
        (pid, title, now_iso()),
    )
    conn.commit()
    return get_project(conn, pid)


def get_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()


def list_projects(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT p.*,
               COUNT(DISTINCT d.id) AS draft_count,
               COUNT(DISTINCT r.id) AS report_count,
               MAX(d.uploaded_at)   AS last_activity
        FROM projects p
        LEFT JOIN drafts d ON d.project_id = p.id
        LEFT JOIN reports r ON r.draft_id = d.id
        GROUP BY p.id
        ORDER BY COALESCE(MAX(d.uploaded_at), p.created_at) DESC
        """
    ).fetchall()


# -- drafts -------------------------------------------------------------------

def create_draft(
    conn: sqlite3.Connection,
    project_id: str,
    content_hash: str,
    original_filename: str,
    source_format: str,
    file_path: str,
    label: str | None = None,
) -> sqlite3.Row:
    did = _new_id()
    conn.execute(
        "INSERT INTO drafts (id, project_id, content_hash, original_filename,"
        " source_format, file_path, label, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (did, project_id, content_hash, original_filename, source_format, file_path, label, now_iso()),
    )
    conn.commit()
    return get_draft(conn, did)


def get_draft(conn: sqlite3.Connection, draft_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone()


def find_draft_by_hash(conn: sqlite3.Connection, project_id: str, content_hash: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM drafts WHERE project_id = ? AND content_hash = ?",
        (project_id, content_hash),
    ).fetchone()


def list_drafts(conn: sqlite3.Connection, project_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM drafts WHERE project_id = ? ORDER BY uploaded_at DESC",
        (project_id,),
    ).fetchall()


# -- reports ------------------------------------------------------------------

def create_report(
    conn: sqlite3.Connection,
    draft_id: str,
    schema_version: str,
    prompt_version: str,
    worker_model: str | None,
    reasoning_model: str | None,
) -> sqlite3.Row:
    rid = _new_id()
    conn.execute(
        "INSERT INTO reports (id, draft_id, schema_version, prompt_version,"
        " worker_model, reasoning_model, status, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)",
        (rid, draft_id, schema_version, prompt_version, worker_model, reasoning_model, now_iso()),
    )
    conn.commit()
    return get_report(conn, rid)


def get_report(conn: sqlite3.Connection, report_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()


def list_reports(conn: sqlite3.Connection, draft_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM reports WHERE draft_id = ? ORDER BY created_at DESC",
        (draft_id,),
    ).fetchall()


class IllegalReportTransition(ValueError):
    pass


def _transition_report(conn: sqlite3.Connection, report_id: str, new_status: str) -> sqlite3.Row:
    row = get_report(conn, report_id)
    if row is None:
        raise KeyError(f"no report {report_id}")
    if new_status not in REPORT_TRANSITIONS[row["status"]]:
        raise IllegalReportTransition(
            f"report {report_id} is '{row['status']}'; cannot become '{new_status}'"
            + (" (reports are immutable once finished)" if row["status"] in ("complete", "failed") else "")
        )
    return row


def mark_report_running(conn: sqlite3.Connection, report_id: str) -> None:
    _transition_report(conn, report_id, "running")
    conn.execute("UPDATE reports SET status = 'running' WHERE id = ?", (report_id,))
    conn.commit()


def mark_report_complete(conn: sqlite3.Connection, report_id: str, json_path: str) -> None:
    _transition_report(conn, report_id, "complete")
    conn.execute(
        "UPDATE reports SET status = 'complete', json_path = ?, completed_at = ? WHERE id = ?",
        (json_path, now_iso(), report_id),
    )
    conn.commit()


def mark_report_failed(conn: sqlite3.Connection, report_id: str, error: str) -> None:
    _transition_report(conn, report_id, "failed")
    conn.execute(
        "UPDATE reports SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
        (error, now_iso(), report_id),
    )
    conn.commit()


# -- annotations --------------------------------------------------------------

def create_annotation(
    conn: sqlite3.Connection,
    report_id: str,
    target_ref: str,
    status: str,
    note: str | None = None,
) -> sqlite3.Row:
    aid = _new_id()
    ts = now_iso()
    conn.execute(
        "INSERT INTO annotations (id, report_id, target_ref, status, note, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (aid, report_id, target_ref, status, note, ts, ts),
    )
    conn.commit()
    return get_annotation(conn, aid)


def get_annotation(conn: sqlite3.Connection, annotation_id: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM annotations WHERE id = ?", (annotation_id,)).fetchone()


def list_annotations(conn: sqlite3.Connection, report_id: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM annotations WHERE report_id = ? ORDER BY created_at",
        (report_id,),
    ).fetchall()


def update_annotation(
    conn: sqlite3.Connection,
    annotation_id: str,
    status: str | None = None,
    note: str | None = None,
) -> sqlite3.Row:
    row = get_annotation(conn, annotation_id)
    if row is None:
        raise KeyError(f"no annotation {annotation_id}")
    conn.execute(
        "UPDATE annotations SET status = COALESCE(?, status), note = COALESCE(?, note),"
        " updated_at = ? WHERE id = ?",
        (status, note, now_iso(), annotation_id),
    )
    conn.commit()
    return get_annotation(conn, annotation_id)


# -- pipeline cache -----------------------------------------------------------

def cache_get(
    conn: sqlite3.Connection, script_hash: str, stage: str, model: str, prompt_version: str
) -> str | None:
    row = conn.execute(
        "SELECT payload FROM pipeline_cache WHERE script_hash = ? AND stage = ?"
        " AND model = ? AND prompt_version = ?",
        (script_hash, stage, model, prompt_version),
    ).fetchone()
    return row["payload"] if row else None


def cache_put(
    conn: sqlite3.Connection, script_hash: str, stage: str, model: str, prompt_version: str, payload: str
) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO pipeline_cache"
        " (script_hash, stage, model, prompt_version, payload, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (script_hash, stage, model, prompt_version, payload, now_iso()),
    )
    conn.commit()
