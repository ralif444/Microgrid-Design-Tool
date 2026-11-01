"""Project routes: POST /api/projects/validate (Doc 6 §2, row 3). Import arrives in WP 1.2.3."""

from __future__ import annotations

from fastapi import APIRouter, Request

from mgapp.api.routers.analyses import read_json
from mgapp.services.pipeline import Pipeline
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
