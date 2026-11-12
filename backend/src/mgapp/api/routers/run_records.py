"""RunRecord routes: verify and rerun (Doc 6 §2, rows 14-15). Body `{run_record}`."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from starlette.concurrency import run_in_threadpool

from mgapp.api.routers.analyses import read_body
from mgapp.services.file_check import VerifyResponse, verify
from mgapp.services.pipeline import Pipeline
from mgapp.services.rerun import RerunResponse, rerun

router = APIRouter(prefix="/api", tags=["run-records"])

BODY = {
    "requestBody": {
        "required": True,
        "content": {
            "application/json": {
                "schema": {
                    "type": "object",
                    "required": ["run_record"],
                    "properties": {"run_record": {"$ref": "#/components/schemas/RunRecord"}},
                }
            }
        },
    }
}


async def _record(request: Request) -> tuple[Pipeline, Any]:
    pipeline, raw = await read_body(request)
    return pipeline, raw.get("run_record") if isinstance(raw, dict) else None


@router.post(
    "/run-records/verify",
    response_model=VerifyResponse,
    operation_id="verify_run_record",
    summary="Check an imported RunRecord: schema, both hashes, engine identity",
    openapi_extra=BODY,
)
async def verify_run_record(request: Request) -> VerifyResponse:
    pipeline, rec = await _record(request)
    return verify(rec, pipeline.engine_identity())


@router.post(
    "/run-records/rerun",
    response_model=RerunResponse,
    operation_id="rerun_run_record",
    summary="Verify, then re-run the stored input and compare (REPRODUCED or DIFFERS)",
    openapi_extra=BODY,
)
async def rerun_run_record(request: Request) -> RerunResponse:
    pipeline, rec = await _record(request)
    return await run_in_threadpool(rerun, rec, pipeline)
