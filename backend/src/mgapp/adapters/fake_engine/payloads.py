"""Placeholder payloads for the Fake Engine (Doc 8 §5; user decision 2026-11-01).

Placeholders are derived from the snapshot: nominal voltage and frequency, zero powers,
currents and losses, element ids from the request. They are **not physics**. The only
non-zero synthetic numbers are the two canned INFEASIBLE violations, marked SYNTHETIC.
"""

from __future__ import annotations

from typing import Any

from mgapp.domain.contract import AnalysisRequest, LimitingConstraint
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import AnalysisType, ConstraintKind, Status, StatusCode
from mgapp.domain.payloads import (
    BusResult,
    BusSeries,
    Indicator,
    Indicators,
    InverterPlan,
    InverterResult,
    InverterSeries,
    InverterSizing,
    KeyMetrics,
    LineResult,
    LineSizing,
    Loadability,
    M1Payload,
    M2Payload,
    M3aPayload,
    M3bPayload,
    M3cPayload,
    M3dPayload,
    M4aPayload,
    M4bPayload,
    NotEvaluated,
    OutputMetric,
    PsPayload,
    Ranking,
    RequiredInverter,
    ScenarioResult,
    Scheme,
    Sensitivity,
    SizingCheck,
    StabilityClass,
    SweepPoint,
    TransientClass,
    Verdict,
)

BASIS = "Fake Engine placeholder; not a calculation result."
# Loadability grid settings from the manuscript 4.2.4 (step 0.05, bisection to 0.005).
GRID_STEP = 0.05
RESOLUTION = 0.005


def _ids(items: list[Any]) -> list[str]:
    return [str(i.id) for i in items if i.id is not None]


def _f_nom(s: ProjectSnapshot) -> float:
    return float(s.nominal_frequency_hz or 0.0)


def _key_metrics(s: ProjectSnapshot) -> KeyMetrics:
    return KeyMetrics(
        system_frequency_hz=_f_nom(s),
        min_voltage_pu=1.0,
        max_loading_ratio=0.0,
        total_losses_kw=0.0,
        epsilon_x_ratio=0.0,
    )


def ps(req: AnalysisRequest) -> dict[str, Any]:
    p = req.parameters
    n = int(p.get("unit_count", 1))
    r = int(p.get("redundancy", 0))
    return PsPayload(
        load_apparent_kva=0.0,
        required_inverter_kva=RequiredInverter(value_kva=0.0, basis=BASIS, assumptions=[]),
        inverter_plan=InverterPlan(
            unit_count=n,
            redundancy=r,
            unit_rating_kva=0.0,
            installed_kva=0.0,
            basis=BASIS,
            assumptions=[],
        ),
        storage_energy=None,
        profile_peak_kw=None,
    ).model_dump(mode="json")


def m1(req: AnalysisRequest) -> dict[str, Any]:
    s = req.project_snapshot
    v = float(s.nominal_voltage_kv or 0.0)
    return M1Payload(
        system_frequency_hz=_f_nom(s),
        bus_results=[
            BusResult(bus_id=b, voltage_kv=v, voltage_pu=1.0, angle_deg=0.0) for b in _ids(s.buses)
        ],
        inverter_results=[
            InverterResult(inverter_id=i, p_kw=0.0, q_kvar=0.0, s_kva=0.0, loading_ratio=0.0)
            for i in _ids(s.inverters)
        ],
        line_results=[
            LineResult(
                line_id=ln,
                p_from_kw=0.0,
                q_from_kvar=0.0,
                p_to_kw=0.0,
                q_to_kvar=0.0,
                current_a=0.0,
                losses_kw=0.0,
            )
            for ln in _ids(s.lines)
        ],
        total_load_kw=0.0,
        total_load_kvar=0.0,
        total_losses_kw=0.0,
        iterations=0,
        epsilon_x_ratio=0.0,
    ).model_dump(mode="json")


def _not_evaluated(s: ProjectSnapshot) -> list[NotEvaluated]:
    c = s.design_constraints
    out: list[NotEvaluated] = []
    for b in _ids(s.buses):
        if c.voltage_min_pu is None:
            out.append(NotEvaluated(kind=ConstraintKind.BUS_VOLTAGE_MIN, element_id=b))
        if c.voltage_max_pu is None:
            out.append(NotEvaluated(kind=ConstraintKind.BUS_VOLTAGE_MAX, element_id=b))
    if c.frequency_min_hz is None:
        out.append(NotEvaluated(kind=ConstraintKind.FREQUENCY_MIN, element_id="SYSTEM"))
    if c.frequency_max_hz is None:
        out.append(NotEvaluated(kind=ConstraintKind.FREQUENCY_MAX, element_id="SYSTEM"))
    if c.inverter_loading_limit_ratio is None:
        out += [
            NotEvaluated(kind=ConstraintKind.INVERTER_LOADING, element_id=i)
            for i in _ids(s.inverters)
        ]
    for ln in s.lines:
        if ln.id is not None and ln.current_limit_a is None and c.line_current_limit_a is None:
            out.append(NotEvaluated(kind=ConstraintKind.LINE_CURRENT, element_id=ln.id))
    return out


def synthetic_violations(s: ProjectSnapshot) -> list[LimitingConstraint]:
    """Two canned violations for M2 INFEASIBLE (Doc 8 §5). Values are SYNTHETIC markers."""
    bus = next(iter(_ids(s.buses)), "SYSTEM")
    inv = next(iter(_ids(s.inverters)), "SYSTEM")
    return [
        LimitingConstraint(
            kind=ConstraintKind.BUS_VOLTAGE_MIN,
            element_id=bus,
            value=0.9,
            limit=1.0,
            unit="pu",
            margin=-0.1,
            normalised_margin=-0.1,
        ),
        LimitingConstraint(
            kind=ConstraintKind.INVERTER_LOADING,
            element_id=inv,
            value=1.1,
            limit=1.0,
            unit="ratio",
            margin=-0.1,
            normalised_margin=-0.1,
        ),
    ]


def m2(req: AnalysisRequest, verdict: Verdict) -> dict[str, Any]:
    s = req.project_snapshot
    margins = synthetic_violations(s) if verdict is Verdict.INFEASIBLE else []
    return M2Payload(
        verdict=verdict,
        constraint_margins=margins,
        not_evaluated=_not_evaluated(s),
        sizing_check=SizingCheck(
            per_inverter=[
                InverterSizing(
                    inverter_id=str(i.id),
                    s_kva=0.0,
                    required_rating_kva=0.0,
                    headroom_kva=float(i.rated_kva or 0.0),
                    rating_margin_short=False,
                )
                for i in s.inverters
                if i.id is not None
            ],
            per_line=[
                LineSizing(line_id=ln, current_a=0.0, required_current_a=0.0)
                for ln in _ids(s.lines)
            ],
            storage=None,
            basis=BASIS,
            assumptions=[],
        ),
        loadability=Loadability(
            lambda_c=None,
            lambda_s=None,
            lambda_ub=None,
            resolution=RESOLUTION,
            grid_step=GRID_STEP,
            stop_reason="FAKE_ENGINE",
        ),
    ).model_dump(mode="json")


def _metrics(p: dict[str, Any]) -> list[OutputMetric]:
    out = []
    for m in p.get("output_metrics", []) or []:
        try:
            out.append(OutputMetric(m))
        except ValueError:
            continue
    return out


def m3a(req: AnalysisRequest) -> dict[str, Any]:
    paths = [str(x) for x in req.parameters.get("parameter_paths", []) or []]
    metrics = _metrics(req.parameters)
    sens = [
        Sensitivity(
            parameter_path=pp,
            metric=m,
            value=0.0,
            normalised_value=0.0,
            unit="",
            scheme=Scheme.CENTRAL,
            status_change=False,
        )
        for pp in paths
        for m in metrics
    ]
    ranking = [
        Ranking(metric=m, parameter_path=pp, rank=k + 1)
        for m in metrics
        for k, pp in enumerate(paths)
    ]
    return M3aPayload(sensitivities=sens, ranking=ranking).model_dump(mode="json")


def _grid(axis: Any) -> list[float]:
    if not isinstance(axis, dict):
        return []
    try:
        lo, hi, n = float(axis["range_min"]), float(axis["range_max"]), int(axis["step_count"])
    except (KeyError, TypeError, ValueError):
        return []
    if n < 2:
        return [lo]
    return [lo + k * (hi - lo) / (n - 1) for k in range(n)]


def _point(s: ProjectSnapshot, **coords: float) -> SweepPoint:
    return SweepPoint(
        status=Status.FEASIBLE,
        status_code=StatusCode.OK,
        limiting_constraint=None,
        key_metrics=_key_metrics(s),
        **coords,
    )


def m3b(req: AnalysisRequest) -> dict[str, Any]:
    s = req.project_snapshot
    pts = [_point(s, value=v) for v in _grid(req.parameters.get("axis"))]
    return M3bPayload(points=pts, first_infeasible_value=None).model_dump(mode="json")


def m3c(req: AnalysisRequest) -> dict[str, Any]:
    scen = req.scenarios or []
    return M3cPayload(
        scenario_results=[
            ScenarioResult(
                scenario_id=sc.scenario_id,
                status=Status.FEASIBLE,
                status_code=StatusCode.OK,
                key_metrics=_key_metrics(sc.project_snapshot),
                limiting_constraints=[],
            )
            for sc in scen
        ],
        deltas=[],
    ).model_dump(mode="json")


def m3d(req: AnalysisRequest) -> dict[str, Any]:
    s = req.project_snapshot
    xs = _grid(req.parameters.get("axis_x"))
    ys = _grid(req.parameters.get("axis_y"))
    grid = [_point(s, x_value=x, y_value=y) for x in xs for y in ys]
    frac = 1.0 if grid else 0.0
    return M3dPayload(grid=grid, feasible_fraction=frac).model_dump(mode="json")


def _not_evaluated_indicator() -> Indicator:
    return Indicator(value=None, evaluated=False, reason="FAKE_ENGINE")


def m4a(req: AnalysisRequest) -> dict[str, Any]:
    ind = _not_evaluated_indicator()
    return M4aPayload(
        eigenvalues=[],
        modes=[],
        zeta_min=None,
        dominant_modes=[],
        participation=None,
        stability_class=StabilityClass.STABLE,
        indicators=Indicators(r_tau=ind, kappa=ind, r_in=ind, epsilon_x=ind),
        outside_definition=False,
    ).model_dump(mode="json")


def m4b(req: AnalysisRequest) -> dict[str, Any]:
    s = req.project_snapshot
    end = req.parameters.get("simulation_end_s")
    t = [0.0, float(end)] if isinstance(end, int | float) and end > 0 else [0.0]
    f = [_f_nom(s)] * len(t)
    v = float(s.nominal_voltage_kv or 0.0)
    zeros = [0.0] * len(t)
    return M4bPayload(
        time_s=t,
        system_frequency_hz=f,
        bus_voltage_kv=[BusSeries(bus_id=b, values=[v] * len(t)) for b in _ids(s.buses)],
        inverter_p_kw=[InverterSeries(inverter_id=i, values=zeros) for i in _ids(s.inverters)],
        inverter_q_kvar=[InverterSeries(inverter_id=i, values=zeros) for i in _ids(s.inverters)],
        max_rocof_hz_per_s=0.0,
        transient_class=TransientClass.RECOVERED_STABLE,
        settled=True,
    ).model_dump(mode="json")


def feasible_payload(req: AnalysisRequest) -> dict[str, Any]:
    t = req.analysis_type
    if t is AnalysisType.M2:
        return m2(req, Verdict.FEASIBLE)
    return _BUILDERS[t](req)


_BUILDERS = {
    AnalysisType.PS: ps,
    AnalysisType.M1: m1,
    AnalysisType.M3A: m3a,
    AnalysisType.M3B: m3b,
    AnalysisType.M3C: m3c,
    AnalysisType.M3D: m3d,
    AnalysisType.M4A: m4a,
    AnalysisType.M4B: m4b,
}
