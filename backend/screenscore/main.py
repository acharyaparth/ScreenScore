"""App factory.

Run (dev):     uvicorn --factory screenscore.main:create_app --port 8686 --reload
Run (docker):  same, host 0.0.0.0; the built frontend is served from / when present.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import ENGINE_VERSION, config, db
from .api.routes import router
from .pipeline.progress import ProgressBus
from .runtime import OllamaRuntime


def create_app() -> FastAPI:
    config.ensure_dirs()
    conn = db.connect(config.db_path())
    db.migrate(conn)

    app = FastAPI(title="ScreenScore", version=ENGINE_VERSION, docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.state.conn = conn
    app.state.runtime = OllamaRuntime()
    app.state.bus = ProgressBus()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/api")

    dist = config.frontend_dist()
    if dist is not None:
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str):
            candidate = (dist / path).resolve()
            if path and candidate.is_file() and candidate.is_relative_to(dist):
                return FileResponse(candidate)
            return FileResponse(dist / "index.html")

    return app
