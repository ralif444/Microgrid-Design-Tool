"""Analysis pipeline (component 4; manuscript 4.3.3, Gambar C.5a-C.5b).

Fixed order: request model → stage-1 validation → size limits → canonicalise + hash →
dependency check → guarded engine call → RunRecord. Every path ends in a RunRecord.
CB (cable sizing) replaces the engine call with the app-side service (ADR-014).
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from mgapp.domain.base import Model
from mgapp.domain.contract import (
    AnalysisRequest,
    AnalysisResult,
    EngineIdentity,
    RunRecordRef,
    ScenarioSnapshot,
    SolverConfig,
    ValidationIssue,
)
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import (
    DEPENDENT_TYPES,
    AnalysisType,
    IssueCode,
    IssueLevel,
    Status,
    StatusCode,
)
from mgapp.domain.run_record import AnalysisResponse
from mgapp.services.cable_sizing.service import compute as compute_cable_sizing
from mgapp.services.canonical import normalise_raw, normalise_snapshot, sha256_hex
from mgapp.services.dependency import check_dependency
from mgapp.services.guard import ExecutionGuard
from mgapp.services.limits import Limits, check_size_limits
from mgapp.services.run_record import RunRecordService
from mgapp.services.validation import MESSAGES, validate_request


class AnalysisRequestBody(Model):
    """HTTP body of POST /api/analyses/{type} (Doc 6 §3.1). analysis_type comes from the route."""

    project_snapshot: ProjectSnapshot
    parameters: dict[str, Any]
    solver_config: SolverConfig
    depends_on: RunRecordRef | None = None
    scenarios: list[ScenarioSnapshot] | None = None


def _invalid(issues: list[ValidationIssue]) -> AnalysisResult:
    if len(issues) == 1:
        code, detail = issues[0].code.value, issues[0].message
    else:
        code, detail = StatusCode.MULTIPLE_ISSUES.value, f"{len(issues)} problems were found."
    return AnalysisResult(
        status=Status.INPUT_INVALID,
        status_code=code,
        message=f"Input is not valid: {detail} Correct the marked input and run again.",
        payload=None,
        diagnostics={"issues": [i.model_dump(mode="json") for i in issues]},
    )


def _unavailable(code: StatusCode, message: str, reason: str | None = None) -> AnalysisResult:
    diag: dict[str, Any] = {"dependency_reason": reason} if reason else {}
    return AnalysisResult(
        status=Status.UNAVAILABLE, status_code=code, message=message, payload=None, diagnostics=diag
    )


MSG_CB_OFF = (
    "Cable and breaker sizing is switched off in this installation. Start the app with "
    "MGAPP_FEATURE_CABLE_SIZING=1 to use it."
)
MSG_CB_FAILED = "The cable sizing service failed ({exc}). Check the table file and settings."


class Pipeline:
    def __init__(
        self,
        guard: ExecutionGuard,
        records: RunRecordService,
        limits: Limits,
        cable_sizing_enabled: bool = False,
    ) -> None:
        self._guard = guard
        self._records = records
        self.limits = limits
        self.cable_sizing_enabled = cable_sizing_enabled

    def engine_identity(self) -> EngineIdentity:
        return self._guard.identity()

    def run_raw(
        self, analysis_type: AnalysisType, raw: Any, replay_of: str | None = None
    ) -> AnalysisResponse:
        """Entry from HTTP and re-run: a request-model failure becomes MALFORMED_REQUEST."""
        if analysis_type is AnalysisType.CB and not self.cable_sizing_enabled:
            result = _unavailable(StatusCode.NOT_APPLICABLE, MSG_CB_OFF)
            return self._raw_record(analysis_type, raw, result, replay_of)
        try:
            body = AnalysisRequestBody.model_validate(raw)
        except ValidationError as exc:
            return self._malformed(analysis_type, raw, exc, replay_of)
        return self.run(analysis_type, body, replay_of)

    def _malformed(
        self, t: AnalysisType, raw: Any, exc: ValidationError, replay_of: str | None
    ) -> AnalysisResponse:
        issue = ValidationIssue(
            code=IssueCode.MALFORMED_REQUEST,
            level=IssueLevel.REQUEST,
            message=MESSAGES[IssueCode.MALFORMED_REQUEST],
        )
        result = _invalid([issue])
        result.diagnostics["schema_errors"] = [
            {"loc": [str(x) for x in e["loc"]], "msg": e["msg"]} for e in exc.errors()
        ]
        return self._raw_record(t, raw, result, replay_of)

    def _raw_record(
        self, t: AnalysisType, raw: Any, result: AnalysisResult, replay_of: str | None
    ) -> AnalysisResponse:
        """RunRecord for a body that is not parsed (malformed, or CB with the flag off)."""
        r = raw if isinstance(raw, dict) else {}
        snapshot = normalise_raw(r.get("project_snapshot"))
        scen = r.get("scenarios") if isinstance(r.get("scenarios"), list) else None
        snap_hash = self._safe_hash({"snapshot": snapshot, "scenarios": scen} if scen else snapshot)
        rec = self._records.build(
            analysis_type=t,
            parameters=r.get("parameters") if isinstance(r.get("parameters"), dict) else {},
            snapshot=snapshot,
            snapshot_hash=snap_hash,
            scenarios=scen,
            depends_on=r.get("depends_on"),
            solver_config=r.get("solver_config"),
            identity=None,
            result=result,
            replay_of_record_id=replay_of,
        )
        return AnalysisResponse(result=result, run_record=rec)

    @staticmethod
    def _safe_hash(value: Any) -> str:
        try:
            return sha256_hex(value)
        except ValueError:
            return sha256_hex(None)

    def run(
        self, t: AnalysisType, body: AnalysisRequestBody, replay_of: str | None = None
    ) -> AnalysisResponse:
        # Canonical forms are computed first so every RunRecord carries the submitted input.
        snapshot = normalise_snapshot(body.project_snapshot)
        base_hash = sha256_hex(snapshot)
        scenarios = (
            [
                {
                    "scenario_id": s.scenario_id,
                    "label": s.label,
                    "project_snapshot": normalise_snapshot(s.project_snapshot),
                }
                for s in body.scenarios
            ]
            if body.scenarios is not None
            else None
        )
        snap_hash = (
            sha256_hex({"snapshot": snapshot, "scenarios": scenarios}) if scenarios else base_hash
        )
        depends = body.depends_on.model_dump(mode="json") if body.depends_on else None
        if t is AnalysisType.CB and isinstance(body.parameters.get("tables"), dict):
            # The server derives the hash and overwrites the client's value (D-102 K282).
            tables_hash = self._safe_hash(body.parameters["tables"])
            body.parameters = {**body.parameters, "table_set_hash": tables_hash}
        solver = body.solver_config.model_dump(mode="json")

        def record(result: AnalysisResult, ident: EngineIdentity | None) -> AnalysisResponse:
            rec = self._records.build(
                analysis_type=t,
                parameters=body.parameters,
                snapshot=snapshot,
                snapshot_hash=snap_hash,
                scenarios=scenarios,
                depends_on=depends,
                solver_config=solver,
                identity=ident,
                result=result,
                replay_of_record_id=replay_of,
            )
            return AnalysisResponse(result=result, run_record=rec)

        # 1. stage-1 validation, all issues
        issues = validate_request(
            t, body.project_snapshot, body.parameters, body.depends_on is not None, body.scenarios
        )
        if issues:
            return record(_invalid(issues), None)
        # 2. size limits
        issues = check_size_limits(t, body.parameters, len(body.scenarios or []), self.limits)
        if issues:
            return record(_invalid(issues), None)
        # 3. (hashes computed above) 4. dependency check
        if t in DEPENDENT_TYPES:
            failure = check_dependency(body.depends_on, base_hash, t)
            if failure is not None:
                return record(
                    _unavailable(StatusCode.DEPENDENCY_NOT_MET, failure.message, failure.reason),
                    None,
                )
        # 5. CB: app-side service instead of the engine (ADR-014); no TIME_BUDGET (D-102 K285)
        if t is AnalysisType.CB:
            assert body.depends_on is not None  # checked in step 4
            try:
                result = compute_cable_sizing(
                    ProjectSnapshot.model_validate(snapshot), body.parameters, body.depends_on
                )
            except Exception as exc:  # noqa: BLE001 - any service failure is reported, never raised
                result = _unavailable(StatusCode.ENGINE_ERROR, MSG_CB_FAILED.format(exc=exc))
                result.diagnostics["computed_by"] = "app"
            return record(result, None)
        # 5. guarded engine call
        request = AnalysisRequest(
            analysis_type=t,
            project_snapshot=ProjectSnapshot.model_validate(snapshot),
            parameters=body.parameters,
            solver_config=body.solver_config,
            depends_on=body.depends_on,
            scenarios=[ScenarioSnapshot.model_validate(s) for s in scenarios]
            if scenarios
            else None,
        )
        outcome = self._guard.run(request)
        # 6. RunRecord
        return record(outcome.result, outcome.identity)
