"""Paths and environment configuration.

Everything ScreenScore persists lives under one data directory:
    data/
      screenscore.db        SQLite (projects, drafts, reports, annotations, cache)
      library/              original scripts + versioned report JSON

Functions (not module constants) so tests can point SCREENSCORE_DATA_DIR at a
temp dir per-test.
"""

import os
from pathlib import Path

REPORT_SCHEMA_VERSION = "1.0"


def data_dir() -> Path:
    return Path(os.environ.get("SCREENSCORE_DATA_DIR", "data")).resolve()


def db_path() -> Path:
    return data_dir() / "screenscore.db"


def library_dir() -> Path:
    return data_dir() / "library"


def ensure_dirs() -> None:
    library_dir().mkdir(parents=True, exist_ok=True)


def frontend_dist() -> Path | None:
    """Location of the built frontend, if present (Docker / production serve)."""
    env = os.environ.get("SCREENSCORE_FRONTEND_DIST")
    if env:
        p = Path(env)
        return p if p.is_dir() else None
    p = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    return p if p.is_dir() else None


def stub_stage_delay() -> float:
    """Per-stage delay of the stub pipeline, seconds. Tests set this to 0."""
    return float(os.environ.get("SCREENSCORE_STUB_DELAY", "0.5"))
