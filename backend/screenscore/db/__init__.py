"""SQLite connection + plain-SQL migrations.

No ORM: the schema is small, relationships are simple, and plain SQL keeps the
persistence layer legible. Migrations are numbered .sql files applied in order
and recorded in schema_migrations.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def connect(path: Path) -> sqlite3.Connection:
    """One connection per consumer: each HTTP request opens (and closes) its
    own via the get_conn dependency, and each pipeline task owns one for its
    run. A sqlite3 connection must never be shared across threads — FastAPI's
    sync endpoints run in a threadpool, and shared-connection cursor reuse
    corrupts with 'bad parameter or other API misuse'. WAL + busy_timeout
    keep concurrent connections cheap and writers patient."""
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)"
    )
    applied = {row["version"] for row in conn.execute("SELECT version FROM schema_migrations")}
    for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(path.name.split("_", 1)[0])
        if version in applied:
            continue
        conn.executescript(path.read_text())
        conn.execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
            (version, path.name, now_iso()),
        )
        conn.commit()
