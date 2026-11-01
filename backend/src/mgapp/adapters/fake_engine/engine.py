"""Fake Engine: deterministic canned results for every Status (Doc 8 §5, manuscript 4.3.2).

Control is in-process only (never a request field or HTTP route):
- `script` maps an analysis type to a `ScriptEntry` (outcome, optional delay, optional raise);
- `call_log` records every `run` call for "zero engine calls" assertions.
Every result carries warning ENGINE_KIND_FAKE (Doc 6 §3.3).
"""

from __future__ import annotations

import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum

from mgapp.adapters.fake_engine import payloads
from mgapp.domain.contract import AnalysisRequest, AnalysisResult, EngineIdentity, Warning
from mgapp.domain.enums import AnalysisType, EngineKind, Status, StatusCode, WarningCode
from mgapp.domain.payloads import Verdict

# Version of the canned behaviour; bump when canned outputs change (RunRecord engine_version).
FAKE_ENGINE_VERSION = "fake-1"
FAKE_ENGINE_COMMIT = "none"


class Outcome(StrEnum):
    """Named canned outcomes (Doc 8 §5 coverage matrix)."""

    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    SOLVER_FAILED = "SOLVER_FAILED"
    PHYSICALLY_INADMISSIBLE = "PHYSICALLY_INADMISSIBLE"
    INPUT_INVALID = "INPUT_INVALID"
    NOT_APPLICABLE = "NOT_APPLICABLE"


@dataclass(frozen=True)
class ScriptEntry:
    outcome: Outcome = Outcome.FEASIBLE
    delay_s: float = 0.0  # sleep before answering (TIMEOUT tests of the execution guard)
    raise_error: bool = False  # defect mode: raise instead of answering (ENGINE_ERROR tests)


@dataclass(frozen=True)
class Call:
    analysis_type: AnalysisType


class FakeEngineDefectError(RuntimeError):
    """Raised only in defect mode; a conforming engine never raises (rule 4)."""


_MESSAGES: dict[Outcome, tuple[Status, StatusCode, str]] = {
    Outcome.FEASIBLE: (
        Status.FEASIBLE,
        StatusCode.OK,
        "Analysis completed (Fake Engine placeholder result, not a calculation).",
    ),
    Outcome.INFEASIBLE: (
        Status.INFEASIBLE,
        StatusCode.CONSTRAINT_VIOLATED,
        "Design violates constraints (Fake Engine canned result). "
        "See the limiting constraints and adjust the design.",
    ),
    Outcome.SOLVER_FAILED: (
        Status.SOLVER_FAILED,
        StatusCode.NO_CONVERGENCE,
        "Solver did not converge (Fake Engine canned result). "
        "Check inverter and line data, then run again.",
    ),
    Outcome.PHYSICALLY_INADMISSIBLE: (
        Status.PHYSICALLY_INADMISSIBLE,
        StatusCode.OPERATING_POINT_NOT_PHYSICAL,
        "Solution is not physical (Fake Engine canned result). Check inverter and line data.",
    ),
    Outcome.INPUT_INVALID: (
        Status.INPUT_INVALID,
        StatusCode.MULTIPLE_ISSUES,
        "Input rejected by the engine (Fake Engine canned result). Correct the input.",
    ),
    Outcome.NOT_APPLICABLE: (
        Status.UNAVAILABLE,
        StatusCode.NOT_APPLICABLE,
        "This analysis is not available in the active engine (Fake Engine canned result).",
    ),
}

FAKE_WARNING = Warning(
    code=WarningCode.ENGINE_KIND_FAKE,
    message="Result from the Fake Engine; not an engine calculation.",
)


@dataclass
class FakeEngine:
    """Default (no script entry) = FEASIBLE for every analysis type."""

    script: Mapping[AnalysisType, ScriptEntry] = field(default_factory=dict)
    call_log: list[Call] = field(default_factory=list)

    def identity(self) -> EngineIdentity:
        return EngineIdentity(
            engine_kind=EngineKind.FAKE,
            engine_version=FAKE_ENGINE_VERSION,
            engine_git_commit=FAKE_ENGINE_COMMIT,
        )

    def run(self, request: AnalysisRequest) -> AnalysisResult:
        self.call_log.append(Call(request.analysis_type))
        entry = self.script.get(request.analysis_type, ScriptEntry())
        if entry.delay_s > 0:
            time.sleep(entry.delay_s)
        if entry.raise_error:
            raise FakeEngineDefectError("Fake Engine defect mode")
        return build_result(request, entry.outcome)


def build_result(request: AnalysisRequest, outcome: Outcome) -> AnalysisResult:
    status, code, message = _MESSAGES[outcome]
    payload = None
    limiting = []
    if outcome is Outcome.FEASIBLE:
        payload = payloads.feasible_payload(request)
    elif outcome is Outcome.INFEASIBLE:
        if request.analysis_type is AnalysisType.M2:
            payload = payloads.m2(request, Verdict.INFEASIBLE)
        else:  # disallowed for other types; used to test the guard (ENGINE_ERROR)
            payload = payloads.feasible_payload(request)
        limiting = payloads.synthetic_violations(request.project_snapshot)
    diagnostics: dict[str, object] = {"engine": "FAKE"}
    if outcome is Outcome.INPUT_INVALID:
        diagnostics["issues"] = []
    return AnalysisResult(
        status=status,
        status_code=code,
        message=message,
        payload=payload,
        limiting_constraints=limiting,
        warnings=[FAKE_WARNING],
        diagnostics=diagnostics,
    )
