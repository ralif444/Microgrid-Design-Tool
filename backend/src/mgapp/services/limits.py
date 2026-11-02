"""Execution limits (MetaInfo.limits; Doc 6 §3.9, manuscript 4.1.3 and 4.3.6).

Initial values set by the author; replaced by measurement at WP 1.4.3 (time budget) and
WP 1.7.1 (sweep cap, margin warn, body limit). None = not yet fixed (Doc 9 A-53).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from mgapp.domain.contract import ValidationIssue
from mgapp.domain.enums import AnalysisType, IssueCode, IssueLevel


@dataclass(frozen=True)
class Limits:
    time_budget_s: float = 30.0
    sweep_cap: int = 1000
    margin_warn: float = 0.05
    body_limit_mib: int = 10
    scenario_cap: int | None = None
    m3a_parameter_cap: int | None = None
    m4b_duration_cap_s: float | None = None


def _steps(axis: Any) -> int:
    if isinstance(axis, dict) and isinstance(axis.get("step_count"), int):
        return int(axis["step_count"])
    return 0


def check_size_limits(
    t: AnalysisType, parameters: dict[str, Any], scenario_count: int, limits: Limits
) -> list[ValidationIssue]:
    """Size limits after stage 1, before any engine call (manuscript 4.3.3). INPUT_INVALID codes."""
    out: list[ValidationIssue] = []

    def issue(code: IssueCode, msg: str) -> None:
        out.append(ValidationIssue(code=code, level=IssueLevel.REQUEST, message=msg))

    if t is AnalysisType.M3B:
        n = _steps(parameters.get("axis"))
        if n > limits.sweep_cap:
            issue(
                IssueCode.SWEEP_CAP_EXCEEDED,
                f"This sweep has too many points ({n}; the limit is {limits.sweep_cap}).",
            )
    if t is AnalysisType.M3D:
        n = _steps(parameters.get("axis_x")) * _steps(parameters.get("axis_y"))
        if n > limits.sweep_cap:
            issue(
                IssueCode.SWEEP_CAP_EXCEEDED,
                f"This sweep has too many points ({n}; the limit is {limits.sweep_cap}).",
            )
    if t is AnalysisType.M3A and limits.m3a_parameter_cap is not None:
        paths = parameters.get("parameter_paths") or []
        if isinstance(paths, list) and len(paths) > limits.m3a_parameter_cap:
            issue(IssueCode.PARAMETER_CAP_EXCEEDED, "Too many parameters selected.")
    if t is AnalysisType.M4B and limits.m4b_duration_cap_s is not None:
        end = parameters.get("simulation_end_s")
        if isinstance(end, int | float) and end > limits.m4b_duration_cap_s:
            issue(IssueCode.DURATION_CAP_EXCEEDED, "The simulation time is too long.")
    if (
        t is AnalysisType.M3C
        and limits.scenario_cap is not None
        and scenario_count > limits.scenario_cap
    ):
        issue(
            IssueCode.SCENARIO_COUNT_INVALID,
            "Compare between 2 and the allowed number of scenarios.",
        )
    return out
