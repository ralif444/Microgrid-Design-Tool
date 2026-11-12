"""Analysis routes: POST /api/analyses/{type} for the nine types (Doc 6 §2, rows 5-13)."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter, Request
from starlette.concurrency import run_in_threadpool

from mgapp.api.error_mapper import TransportFailureError
from mgapp.domain.enums import AnalysisType
from mgapp.domain.run_record import AnalysisResponse
from mgapp.services.pipeline import AnalysisRequestBody, Pipeline

router = APIRouter(prefix="/api", tags=["analyses"])

BODY_SCHEMA_REF = {"$ref": "#/components/schemas/AnalysisRequestBody"}


async def read_json(request: Request, limit_bytes: int) -> Any:
    ctype = request.headers.get("content-type", "")
    if ctype.split(";")[0].strip().lower() != "application/json":
        raise TransportFailureError(415)
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > limit_bytes:
        raise TransportFailureError(413)
    raw = await request.body()
    if len(raw) > limit_bytes:
        raise TransportFailureError(413)
    try:
        return json.loads(raw)
    except (ValueError, RecursionError) as exc:  # RecursionError: nesting too deep to decode
        raise TransportFailureError(400) from exc


async def read_body(request: Request) -> tuple[Pipeline, Any]:
    """The app's pipeline and the decoded JSON body, read under the MetaInfo body limit."""
    pipeline: Pipeline = request.app.state.pipeline
    return pipeline, await read_json(request, pipeline.limits.body_limit_mib * 1024 * 1024)


def _handler(t: AnalysisType) -> Callable[[Request], Awaitable[AnalysisResponse]]:
    async def analyse(request: Request) -> AnalysisResponse:
        pipeline, raw = await read_body(request)
        return await run_in_threadpool(pipeline.run_raw, t, raw)

    analyse.__name__ = f"analyse_{t.value}"
    return analyse


for _t in AnalysisType:
    router.add_api_route(
        f"/analyses/{_t.value}",
        _handler(_t),
        methods=["POST"],
        response_model=AnalysisResponse,
        operation_id=f"analyse_{_t.value}",
        summary=f"Run analysis {_t.value}",
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {"application/json": {"schema": BODY_SCHEMA_REF}},
            }
        },
    )


@router.post("/analyses/{name}", include_in_schema=False)
async def unknown_analysis(name: str) -> None:
    raise TransportFailureError(404, "UNKNOWN_ANALYSIS_TYPE", f"Unknown analysis type '{name}'.")


# Referenced by the composition root so the body schema appears in OpenAPI components.
REQUEST_BODY_MODEL = AnalysisRequestBody
