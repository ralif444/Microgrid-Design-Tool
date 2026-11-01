"""Project routes: POST /api/projects/validate and /api/projects/import (Doc 6 §2, rows 3-4)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from mgapp.api.routers.analyses import read_json
from mgapp.services.pipeline import Pipeline
from mgapp.services.project_file import ImportResponse, import_project
from mgapp.services.validation import ValidationReport, validate_raw

router = APIRouter(prefix="/api", tags=["projects"])


@router.post(
    "/projects/validate",
    response_model=ValidationReport,
    operation_id="validate_project",
    summary="Stage-1 validation for live feedback; no RunRecord, no engine call",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": {"$ref": "#/components/schemas/ValidateRequest"}}
            },
        }
    },
)
async def validate_project(request: Request) -> ValidationReport:
    pipeline: Pipeline = request.app.state.pipeline
    return validate_raw(await read_json(request, pipeline.limits.body_limit_mib * 1024 * 1024))


@router.post(
    "/projects/import",
    response_model=ImportResponse,
    operation_id="import_project",
    summary="Check a Project file: version, shape, run records, stage-1 validation",
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {"schema": {"$ref": "#/components/schemas/ProjectFile"}}
            },
        }
    },
)
async def import_project_file(request: Request) -> ImportResponse:
    pipeline: Pipeline = request.app.state.pipeline
    return import_project(await read_json(request, pipeline.limits.body_limit_mib * 1024 * 1024))
