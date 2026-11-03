"""GET /api/health and GET /api/meta (Doc 6 §2, rows 1-2)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from mgapp import __version__
from mgapp.domain.meta import PROJECT_SCHEMA_VERSION, HealthInfo, LimitsInfo, MetaInfo
from mgapp.domain.run_record import RECORD_SCHEMA_VERSION
from mgapp.services.pipeline import Pipeline

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", response_model=HealthInfo, operation_id="health")
def health() -> HealthInfo:
    return HealthInfo(status="OK")


@router.get("/meta", response_model=MetaInfo, operation_id="meta")
def meta(request: Request) -> MetaInfo:
    pipeline: Pipeline = request.app.state.pipeline
    lim = pipeline.limits
    return MetaInfo(
        app_version=__version__,
        schema_version=PROJECT_SCHEMA_VERSION,
        record_schema_version=RECORD_SCHEMA_VERSION,
        api_description_version=__version__,
        engine=pipeline.engine_identity(),
        limits=LimitsInfo(
            time_budget_s=lim.time_budget_s,
            sweep_cap=lim.sweep_cap,
            margin_warn=lim.margin_warn,
            body_limit_mib=lim.body_limit_mib,
            scenario_cap=lim.scenario_cap,
            m3a_parameter_cap=lim.m3a_parameter_cap,
            m4b_duration_cap_s=lim.m4b_duration_cap_s,
            lambda_c_point_cap=lim.lambda_c_point_cap,
        ),
        indicator_threshold_version=None,
    )
