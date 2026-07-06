-- Cross-draft diffs. A diff compares two immutable reports of the same
-- project. The scoring pipeline never reads reports (blind scoring); only
-- this separate pass sees both drafts.

CREATE TABLE diffs (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_report_id  TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    to_report_id    TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'failed')),
    error           TEXT,
    prompt_version  TEXT NOT NULL,
    model           TEXT,
    payload         TEXT,               -- JSON
    created_at      TEXT NOT NULL,
    completed_at    TEXT,
    UNIQUE (from_report_id, to_report_id, prompt_version)
);

CREATE INDEX idx_diffs_project ON diffs(project_id);
