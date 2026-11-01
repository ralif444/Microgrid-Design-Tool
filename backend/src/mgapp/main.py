"""Composition root: wires the app once at startup (Doc 4 §4, Doc 8 §2).

`create_app` is also the factory the in-process tests use to inject a Fake Engine.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from mgapp import __version__
from mgapp.config import BIND_HOST, Settings

STATIC_DIR = Path(__file__).parent / "static"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="mgapp", version=__version__)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    # Static frontend build (component 1). Mounted last so /api routes win.
    if (STATIC_DIR / "index.html").exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    return app


def run() -> None:
    """Single start command `uv run mgapp` (NFR-02)."""
    import uvicorn

    settings = Settings.from_env()
    uvicorn.run(create_app(settings), host=BIND_HOST, port=settings.port)
