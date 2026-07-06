# Decisions Log

Every "your call" from the build brief, recorded with a one-line rationale.
Fixed decisions from the brief (browser app, Ollama default, SQLite, GPLv3,
categorical scores, no native app, …) are not repeated here.

## Phase 1

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Backend: Python 3.12 + FastAPI** (brief's recommendation, confirmed) | Parsing (Phase 2) is the risk center and Python's PDF/text ecosystem is decisively stronger; also collapses v1's Node+Python straddle into one backend language. |
| 2 | Backend packaging via **uv + pyproject** (`backend/`) | Fast, lockfile-based, one tool for venv+deps; plain `pip install ./backend` still works (used in Docker). |
| 3 | **No ORM** — stdlib `sqlite3` + numbered plain-SQL migrations | Schema is small and relational logic simple; plain SQL is the most legible and dependency-free option. |
| 4 | Report JSON stored as **files in the library folder**, DB row keeps the path | Reports are immutable documents; files make them trivially exportable/backupable and keep the DB lean. |
| 5 | **SSE** (not WebSocket) for pipeline progress | Progress is strictly server→client; SSE is simpler, proxies well, and auto-reconnects in the browser. |
| 6 | Backend port **8686**; production/Docker serves the built frontend from the same port; Vite dev server (5173) proxies `/api` | One origin in production = no CORS surface; dev keeps hot reload. |
| 7 | **Ollama URL auto-discovery**: `OLLAMA_URL` env → `localhost` → `host.docker.internal` → bundled `ollama` compose service | One `docker compose up` works everywhere while preferring the host Ollama, which on macOS is the only way to get Metal acceleration. |
| 8 | Compose bundles an `ollama` service with **no published port** | Zero-step Linux setup while honoring "don't expose model ports publicly" (odysseus rule). |
| 9 | Frontend keeps **React 18 + Vite + Tailwind**, rewritten under `frontend/` | Brief's default; separation from `backend/` keeps the two deployables independent. |
| 10 | TS types **hand-mirrored** from `report.schema.json` (`frontend/src/types.ts`), same-commit rule | Codegen is a build dependency we don't need at one schema; revisit if the schema grows or drifts once. |
| 11 | Data dir defaults to `./data` (env `SCREENSCORE_DATA_DIR`, `/data` in Docker), gitignored | Everything a user owns lives in one obvious, portable folder: SQLite DB + library/. |
| 12 | Stub reports are **schema-validated and marked `meta.stub: true`**; the UI banners them | The contract is exercised honestly from day one and fake output can never be mistaken for coverage. |
| 13 | Report rows are **immutable after complete/failed** — enforced in the repository layer with legal-transition checks | Old reads must stay reproducible (brief §6); code-level enforcement catches bugs tests can't. |

### Appendix B interim defaults (operator to refine)

| # | Decision | Rationale |
|---|----------|-----------|
| B1 | **Lowest supported hardware: 8 GB RAM, CPU-only** — collapses both pipeline roles onto `llama3.1:8b` with an explicit depth warning; never hard-fails | Brief mandates graceful degradation; 8 GB is the realistic floor of machines writers own. |
| B2 | **Worker model: `llama3.1:8b`** on every tier | Fast, ubiquitous, strong at extraction/summarization at 8B class. |
| B3 | **Reasoning tier ladder: `qwen2.5:14b` → `qwen2.5:32b`** by memory budget; **`llama3.3:70b` is opt-in only** on ≥48 GB budgets | Qwen2.5 14B/32B are the best open reasoning-per-GB in their classes; 70B is too slow per token to be a default. |
| B4 | **Memory budgets:** Apple Silicon = 50% of unified RAM; CUDA = 90% of VRAM; CPU-only = 60% of (RAM − 4 GB) | Apple Silicon oversubscription can freeze the machine (operator's known constraint); CPU models that merely fit are impractically slow. |

## Process

- Repo work happens on phase branches (`v2/phase-1`, …) merged to `main` only when
  the end-to-end smoke test passes, so `main` is never broken between phases.
