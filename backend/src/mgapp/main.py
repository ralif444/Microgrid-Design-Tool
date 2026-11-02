"""Composition root: wires the app once at startup (Doc 4 §4, Doc 8 §2).

`create_app` is also the factory the in-process tests use to inject a Fake Engine
instance with a script (Doc 8 §5). Engine choice is fixed here, never per request.
"""

from __future__ import annotations

import dataclasses
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.openapi.utils import get_openapi
from fastapi.routing import APIRoute
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from mgapp import __version__
from mgapp.adapters.fake_engine import FakeEngine
from mgapp.adapters.fake_engine.profiles import PROFILES
from mgapp.adapters.real_engine import RealEngine
from mgapp.api import error_mapper
from mgapp.api.error_mapper import TransportFailureError
from mgapp.api.routers import analyses, health_meta, projects, run_records
from mgapp.config import BIND_HOST, EngineChoice, Settings
from mgapp.domain.catalog import Catalog
from mgapp.domain.contract import ValidationIssue
from mgapp.domain.payloads import PAYLOAD_MODEL
from mgapp.engine_port import EnginePort
from mgapp.services.guard import ExecutionGuard
from mgapp.services.limits import Limits
from mgapp.services.pipeline import AnalysisRequestBody, Pipeline
from mgapp.services.project_file import ProjectFile
from mgapp.services.run_record import RunRecordService
from mgapp.services.validation import ValidateRequest

STATIC_DIR = Path(__file__).parent / "static"
API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


def build_engine(settings: Settings, limits: Limits | None = None) -> EnginePort:
    if settings.engine is EngineChoice.REAL:
        return RealEngine(max_points=(limits or Limits()).sweep_cap)
    name = settings.fake_profile or "default"
    if name not in PROFILES:
        raise SystemExit(f"Unknown MGAPP_FAKE_PROFILE '{name}'. Known: {', '.join(PROFILES)}.")
    return FakeEngine(script=dict(PROFILES[name]))


def create_app(
    settings: Settings | None = None,
    *,
    engine: EnginePort | None = None,
    limits: Limits | None = None,
    records: RunRecordService | None = None,
    serve_static: bool = True,
) -> FastAPI:
    settings = settings or Settings()
    limits = limits or Limits()
    if settings.time_budget_s_override is not None:
        limits = dataclasses.replace(limits, time_budget_s=settings.time_budget_s_override)
    engine = engine or build_engine(settings, limits)

    app = FastAPI(
        title="mgapp",
        version=__version__,
        openapi_url="/api/openapi.json",
        docs_url=None,
        redoc_url=None,
    )
    app.state.pipeline = Pipeline(
        ExecutionGuard(engine, limits.time_budget_s), records or RunRecordService(), limits
    )
    error_mapper.install(app)
    app.include_router(health_meta.router)
    app.include_router(analyses.router)
    app.include_router(projects.router)
    app.include_router(run_records.router)

    known = [
        r
        for router in (health_meta.router, analyses.router, projects.router, run_records.router)
        for r in router.routes
        if isinstance(r, APIRoute)
    ]

    @app.api_route("/api/{path:path}", methods=API_METHODS, include_in_schema=False)
    async def api_fallback(path: str, request: Request) -> None:
        full = f"/api/{path}"
        if any(r.path_regex.match(full) for r in known):
            raise TransportFailureError(405)
        raise TransportFailureError(404)

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            app.openapi_schema = build_openapi(app)
        return app.openapi_schema

    app.openapi = openapi  # type: ignore[method-assign]

    # Static frontend build (component 1), mounted last so /api routes win.
    if serve_static and (STATIC_DIR / "index.html").exists():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
    return app


def build_openapi(app: FastAPI) -> dict[str, Any]:
    """OpenAPI generated from the Pydantic schemas (Doc 6 §1, NFR-15).

    Analysis routes read their body themselves (to turn request-model failures into
    INPUT_INVALID or a report), so the body schemas are added to the components here.
    """
    spec = get_openapi(title=app.title, version=app.version, routes=app.routes)
    schemas = spec.setdefault("components", {}).setdefault("schemas", {})
    # Payload shapes (Doc 3 §6) and stage-1 issues are carried as free objects in
    # AnalysisResult; they are published here so the frontend gets typed payloads.
    extra: list[type[BaseModel]] = [
        AnalysisRequestBody,
        ValidateRequest,
        ProjectFile,
        Catalog,
        ValidationIssue,
        *PAYLOAD_MODEL.values(),
    ]
    for model in extra:
        sch = model.model_json_schema(ref_template="#/components/schemas/{model}")
        for name, sub in sch.pop("$defs", {}).items():
            schemas.setdefault(name, sub)
        schemas[model.__name__] = sch
    spec["info"]["x-generated"] = "Generated from backend/src/mgapp; do not edit (tools/gen.py)."
    return spec


def run() -> None:
    """Single start command `uv run --project backend mgapp` (NFR-02)."""
    import uvicorn

    logging.basicConfig(level=logging.INFO)
    settings = Settings.from_env()
    uvicorn.run(create_app(settings), host=BIND_HOST, port=settings.port)
