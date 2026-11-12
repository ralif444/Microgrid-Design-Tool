"""Engine Port contract shapes (Doc 3 §5): AnalysisRequest, AnalysisResult and parts."""

from __future__ import annotations

from typing import Any

from pydantic import Field

from mgapp.domain.base import Model
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import (
    AnalysisType,
    ConstraintKind,
    EngineKind,
    InitialGuess,
    IssueCode,
    IssueLevel,
    Status,
    WarningCode,
)

# Defaults from the manuscript 4.2.3 (Doc 3 §5.1).
DEFAULT_MISMATCH_TOLERANCE_W = 1e-3
DEFAULT_MAX_ITERATIONS = 50


class SolverConfig(Model):
    mismatch_tolerance_w: float = Field(default=DEFAULT_MISMATCH_TOLERANCE_W, gt=0)  # W and VAR
    max_iterations: int = Field(default=DEFAULT_MAX_ITERATIONS, ge=1)
    initial_guess: InitialGuess = InitialGuess.DEFAULT


class RunRecordRef(Model):
    """The M1 record parts a dependent analysis carries as `depends_on` (Doc 3 §5.1)."""

    record_id: str
    analysis_type: AnalysisType
    snapshot_hash: str
    status: Status
    result_hash: str
    result_payload: dict[str, Any] | None = None


class ScenarioSnapshot(Model):
    scenario_id: str
    label: str
    project_snapshot: ProjectSnapshot


class AnalysisRequest(Model):
    """Single input shape through the Engine Port (Doc 3 §5.1)."""

    analysis_type: AnalysisType
    project_snapshot: ProjectSnapshot
    parameters: dict[str, Any] = {}
    solver_config: SolverConfig = SolverConfig()
    depends_on: RunRecordRef | None = None
    scenarios: list[ScenarioSnapshot] | None = None


class Warning(Model):  # noqa: A001 - domain term (Doc 3 §5.2)
    code: WarningCode
    message: str
    path: str | None = None


class LimitingConstraint(Model):
    """Doc 3 §5.3. `margin` is in `unit`; negative = violated."""

    kind: ConstraintKind
    element_id: str
    value: float
    limit: float
    unit: str
    margin: float
    normalised_margin: float


class ValidationIssue(Model):
    """One stage-1 issue (Doc 3 §4, Doc 6 §3.4)."""

    code: IssueCode
    level: IssueLevel
    entity: str | None = None
    id: str | None = None
    field: str | None = None
    message: str


class AnalysisResult(Model):
    """Single output shape through the Engine Port (Doc 3 §5.2)."""

    status: Status
    status_code: str
    message: str
    payload: dict[str, Any] | None = None
    limiting_constraints: list[LimitingConstraint] = []
    warnings: list[Warning] = []
    diagnostics: dict[str, Any] = {}


# Message of every UNAVAILABLE / ENGINE_ERROR result, from the guard or an adapter (Doc 6 §5.1).
MSG_ENGINE_ERROR = (
    "The calculation engine failed unexpectedly (internal error, not a solver result). "
    "Run again; if it repeats, report the RunRecord."
)


class EngineIdentity(Model):
    engine_kind: EngineKind
    engine_version: str
    engine_git_commit: str
