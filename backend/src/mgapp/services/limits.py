"""Execution limits (MetaInfo.limits; Doc 6 §3.9, manuscript 4.1.3 and 4.3.6).

Initial values set by the author; time budget measured at WP 1.4.3 (D-54 K80), the other
limits at WP 1.7.1 (D-67). None = no limit.
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
    m4b_duration_cap_s: float | None = 60.0  # D-67: about 81 KiB of RunRecord per simulated second
    lambda_c_point_cap: int | None = 50  # D-67: LAMBDA_C costs about 0.38 s per sweep point


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

    if t in (AnalysisType.M3B, AnalysisType.M3D):
        n = (
            _steps(parameters.get("axis"))
            if t is AnalysisType.M3B
            else _steps(parameters.get("axis_x")) * _steps(parameters.get("axis_y"))
        )
        if n > limits.sweep_cap:
            issue(
                IssueCode.SWEEP_CAP_EXCEEDED,
                f"This sweep has too many points ({n}; the limit is {limits.sweep_cap}). "
                "Reduce the range or step count.",
            )
        cap = limits.lambda_c_point_cap
        if cap is not None and n > cap and "LAMBDA_C" in (parameters.get("point_metrics") or []):
            issue(
                IssueCode.SWEEP_CAP_EXCEEDED,
                f"Loadability at every point is limited to {cap} points"
                f" (this sweep has {n}). Reduce the step count or leave out loadability per point.",
            )
    if t is AnalysisType.M3A and limits.m3a_parameter_cap is not None:
        paths = parameters.get("parameter_paths") or []
        if isinstance(paths, list) and len(paths) > limits.m3a_parameter_cap:
            issue(
                IssueCode.PARAMETER_CAP_EXCEEDED,
                f"Too many parameters selected ({len(paths)}; the limit is "
                f"{limits.m3a_parameter_cap}). Select fewer parameters.",
            )
    if t is AnalysisType.M4B and limits.m4b_duration_cap_s is not None:
        end = parameters.get("simulation_end_s")
        if isinstance(end, int | float) and end > limits.m4b_duration_cap_s:
            issue(
                IssueCode.DURATION_CAP_EXCEEDED,
                f"The simulation time is too long ({end:g} s; the limit is "
                f"{limits.m4b_duration_cap_s:g} s). Shorten the simulation end time.",
            )
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
