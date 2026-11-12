"""MetaInfo and TransportError shapes (Doc 6 §3.9, §3.10)."""

from __future__ import annotations

from mgapp.domain.base import Model
from mgapp.domain.contract import EngineIdentity

# [ASSUMPTION Doc 9 A-57] First Project file layout of this implementation.
PROJECT_SCHEMA_VERSION = 1


class LimitsInfo(Model):
    time_budget_s: float
    sweep_cap: int
    margin_warn: float
    body_limit_mib: int
    scenario_cap: int | None
    m3a_parameter_cap: int | None
    m4b_duration_cap_s: float | None
    lambda_c_point_cap: int | None


class FeaturesInfo(Model):
    """Startup feature flags the frontend needs (D-103 K286)."""

    cable_sizing: bool


class MetaInfo(Model):
    app_version: str
    schema_version: int
    record_schema_version: int
    api_description_version: str
    engine: EngineIdentity
    limits: LimitsInfo
    indicator_threshold_version: str | None
    features: FeaturesInfo


class HealthInfo(Model):
    status: str


class TransportError(Model):
    code: str
    message: str
