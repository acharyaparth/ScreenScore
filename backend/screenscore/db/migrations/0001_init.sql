-- ScreenScore persistence schema v1.
-- Projects → drafts → reports → annotations, plus the pipeline stage cache.
-- Reports are immutable once complete (enforced in repository.py, not SQL).

CREATE TABLE projects (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE drafts (
    id                 TEXT PRIMARY KEY,
    project_id         TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_hash       TEXT NOT NULL,          -- sha256 of the uploaded file
    original_filename  TEXT NOT NULL,
    source_format      TEXT NOT NULL CHECK (source_format IN ('pdf', 'txt', 'fountain', 'fdx')),
    file_path          TEXT NOT NULL,          -- relative to the library folder
    label              TEXT,
    uploaded_at        TEXT NOT NULL,
    UNIQUE (project_id, content_hash)
);

CREATE TABLE reports (
    id               TEXT PRIMARY KEY,
    draft_id         TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
    schema_version   TEXT NOT NULL,
    prompt_version   TEXT NOT NULL,
    worker_model     TEXT,
    reasoning_model  TEXT,
    status           TEXT NOT NULL CHECK (status IN ('queued', 'running', 'complete', 'failed')),
    error            TEXT,
    json_path        TEXT,                     -- versioned report JSON, relative to the library folder
    created_at       TEXT NOT NULL,
    completed_at     TEXT
);

CREATE TABLE annotations (
    id          TEXT PRIMARY KEY,
    report_id   TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    target_ref  TEXT NOT NULL,                 -- JSON pointer into the report, e.g. /rubric/2 or /scene_notes/5
    status      TEXT NOT NULL CHECK (status IN ('addressed', 'dismissed', 'working')),
    note        TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE pipeline_cache (
    script_hash     TEXT NOT NULL,
    stage           TEXT NOT NULL,
    model           TEXT NOT NULL,
    prompt_version  TEXT NOT NULL,
    payload         TEXT NOT NULL,             -- JSON
    created_at      TEXT NOT NULL,
    PRIMARY KEY (script_hash, stage, model, prompt_version)
);

CREATE INDEX idx_drafts_project ON drafts(project_id);
CREATE INDEX idx_reports_draft ON reports(draft_id);
CREATE INDEX idx_annotations_report ON annotations(report_id);
