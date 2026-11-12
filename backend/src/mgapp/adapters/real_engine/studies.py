"""Real Engine adapter for M3a–M3d, M4a, M4b (WP 1.5.4; Doc 9 D-52, D-53, D-55).

The adapter applies parameter paths, axes and scenarios in contract units and hands the engine
ready Networks (D-52 K50); results come back in contract units. Also holds the result and
constraint helpers shared with `engine.py`.
"""

from __future__ import annotations

from typing import Any

from mgengine import m3 as e_m3
from mgengine import m4 as e_m4
from mgengine import m4b as e_m4b
from mgengine.m2 import Constraint
from mgengine.types import Status as EStatus

from mgapp.adapters.real_engine import convert as cv
from mgapp.domain.contract import (
    AnalysisRequest,
    AnalysisResult,
    LimitingConstraint,
    ValidationIssue,
    Warning,
)
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import (
    CONSTRAINT_UNIT,
    M4_POINT_METRICS,
    ConstraintKind,
    IssueCode,
    IssueLevel,
    Status,
    StatusCode,
    WarningCode,
)
from mgapp.domain.payloads import (
    BusSeries,
    Delta,
    DominantMode,
    Eigenvalue,
    Indicator,
    Indicators,
    InverterSeries,
    KeyMetrics,
    M3aPayload,
    M3bPayload,
    M3cPayload,
    M3dPayload,
    M4aPayload,
    M4bPayload,
    Mode,
    OutputMetric,
    Participation,
    Ranking,
    ScenarioResult,
    Scheme,
    Sensitivity,
    StabilityClass,
    SweepPoint,
    TransientClass,
)

MSG_M3 = "Analysis completed; the status of each point or scenario is in the results."
MSG_M4_FAILED = (
    "The stability calculation failed ({code}). This is a calculation problem, not an "
    "instability. Check the design data and run again."
)
MSG_INPUT = "The engine rejected the input ({code}). Correct the input and run again."
_ISSUE_TEXT = {
    "MULTIPLE_INVERTERS_ON_BUS": "Stability analysis allows at most one inverter per bus.",
    "DISTURBANCE_INVALID": "Complete the disturbance definition.",
}


def result(
    status: Status,
    code: StatusCode | str,
    message: str,
    payload: dict[str, Any] | None = None,
    limiting: list[LimitingConstraint] | None = None,
    warnings: list[Warning] | None = None,
    diagnostics: dict[str, Any] | None = None,
) -> AnalysisResult:
    return AnalysisResult(
        status=status,
        status_code=code,
        message=message,
        payload=payload,
        limiting_constraints=limiting or [],
        warnings=warnings or [],
        diagnostics={"engine": "REAL", **(diagnostics or {})},
    )


def constraint(c: Constraint, s: ProjectSnapshot) -> LimitingConstraint:
    k = cv.to_contract(c.kind, s)
    kind = ConstraintKind(c.kind.value)
    return LimitingConstraint(
        kind=kind,
        element_id=c.element_id,
        value=c.value * k,
        limit=c.limit * k,
        unit=CONSTRAINT_UNIT[kind],
        margin=c.margin * k,
        normalised_margin=c.normalised_margin,  # unchanged by linear scaling (D-51 K40)
    )


def _input_invalid(code: str) -> AnalysisResult:
    issue = ValidationIssue(
        code=IssueCode(code), level=IssueLevel.REQUEST, message=_ISSUE_TEXT[code]
    )
    return result(
        Status.INPUT_INVALID,
        code,
        MSG_INPUT.format(code=code),
        diagnostics={"issues": [issue.model_dump(mode="json")]},
    )


def _eig(v: complex) -> Eigenvalue:
    return Eigenvalue(real_per_s=v.real, imag_per_s=v.imag)


# ------------------------------------------------------------------ M3 points
def _key_metrics(m: e_m3.KeyMetrics | None, s: ProjectSnapshot, flags: set[str]) -> KeyMetrics:
    if m is None:  # failed point: outputs left empty (Gambar C.3a)
        return KeyMetrics(
            system_frequency_hz=None,
            min_voltage_pu=None,
            max_loading_ratio=None,
            total_losses_kw=None,
            epsilon_x_ratio=None,
        )
    return KeyMetrics(
        system_frequency_hz=m.omega_rad_s / cv.TWO_PI,
        min_voltage_pu=m.v_min_v / cv.v_phase(s.nominal_voltage_kv),
        max_loading_ratio=m.max_loading_ratio,
        total_losses_kw=m.total_losses_w / 1e3,
        epsilon_x_ratio=m.epsilon_x_ratio,
        max_q_sharing_error_pu=m.e_q_max_ratio,
        lambda_c=m.lambda_c,
        zeta_min=m.zeta_min if "ZETA_MIN" in flags else None,
        re_lambda_dom_per_s=m.re_lambda_dom_per_s if "RE_LAMBDA_DOM" in flags else None,
        r_tau=m.r_tau if "INDICATORS" in flags else None,
        kappa=m.kappa if "INDICATORS" in flags else None,
    )


def _sweep(req: AnalysisRequest, max_points: int, axes: list[dict[str, Any]]) -> list[SweepPoint]:
    """One point per grid value (M3b) or grid pair (M3d), each from the flat start (K51)."""
    s, p = req.project_snapshot, req.parameters
    flags = set(p.get("point_metrics") or [])
    eigs = bool(p.get("include_eigenvalues"))
    limits, w0, cfg = cv.limits(s), cv.omega_nom(s), cv.solver(req.solver_config)
    grids = [cv.grid(a) for a in axes]
    coords = (
        [(x,) for x in grids[0]] if len(axes) == 1 else [(x, y) for x in grids[0] for y in grids[1]]
    )
    out = []
    for c in coords:
        snap = s
        for a, v in zip(axes, c, strict=True):
            snap = cv.on_axis(snap, a, v)
        pr = e_m3.evaluate(
            cv.network(snap),
            limits,
            w0,
            cfg,
            lambda_c_points=max_points if "LAMBDA_C" in flags else None,
            m4=bool(flags & M4_POINT_METRICS),
            include_eigenvalues=eigs,
        )
        m = pr.metrics
        out.append(
            SweepPoint(
                **({"value": c[0]} if len(c) == 1 else {"x_value": c[0], "y_value": c[1]}),
                status=Status(pr.status.value),
                status_code=pr.code.value,
                limiting_constraint=None if pr.limiting is None else constraint(pr.limiting, s),
                key_metrics=_key_metrics(m, s, flags),
                eigenvalues=(
                    [_eig(v) for v in m.eigenvalues]
                    if eigs and m is not None and m.eigenvalues is not None
                    else None
                ),
            )
        )
    return out


def m3a(req: AnalysisRequest) -> AnalysisResult:
    s, p = req.project_snapshot, req.parameters
    paths = [str(x) for x in p["parameter_paths"]]
    metrics = [e_m3.Metric(m) for m in p.get("output_metrics") or []]
    rel = p.get("step_relative")
    cases, empty = [], []
    for path in paths:
        p0 = cv.get(s, path)
        if p0 is None:
            empty.append(path)
            continue
        h = float(rel) * abs(p0) if rel is not None else float(p["step_absolute"])  # D-55 K92
        cases.append(
            e_m3.SensitivityCase(
                path, p0, h, cv.network(cv.with_value(s, path, p0 - h)),
                cv.network(cv.with_value(s, path, p0 + h)),
            )
        )  # fmt: skip
    r = e_m3.m3a(
        cv.network(s), cases, metrics, cv.limits(s), cv.omega_nom(s), cv.solver(req.solver_config)
    )
    by_key = {(x.parameter_id, x.metric): x for x in r.sensitivities}
    sens = []
    for path in paths:
        for m in metrics:
            unit = f"{cv.METRIC_UNIT[m]}/{cv.field_unit(path)}"
            x = by_key.get((path, m))
            if x is None:  # parameter without a value (optional field left empty)
                sens.append(
                    Sensitivity(
                        parameter_path=path, metric=OutputMetric(m.value), value=None,
                        normalised_value=None, unit=unit, scheme=None, status_change=False,
                        reason="parameter has no value",
                    )
                )  # fmt: skip
                continue
            sens.append(
                Sensitivity(
                    parameter_path=path,
                    metric=OutputMetric(m.value),
                    value=None if x.value is None else x.value * cv.metric_factor(m, s),
                    normalised_value=x.normalised_value,  # unit-free
                    unit=unit,
                    scheme=None if x.scheme is None else Scheme(x.scheme.value),
                    status_change=x.status_change,
                    reason=x.reason,
                )
            )
    ranking = [
        Ranking(metric=OutputMetric(k.metric.value), parameter_path=k.parameter_id, rank=k.rank)
        for k in r.ranking
    ]
    payload = M3aPayload(sensitivities=sens, ranking=ranking).model_dump(mode="json")
    return result(Status.FEASIBLE, StatusCode.OK, MSG_M3, payload)


def m3b(req: AnalysisRequest, max_points: int) -> AnalysisResult:
    pts = _sweep(req, max_points, [req.parameters["axis"]])
    first = next((pt.value for pt in pts if pt.status is not Status.FEASIBLE), None)
    payload = M3bPayload(points=pts, first_infeasible_value=first).model_dump(mode="json")
    return result(Status.FEASIBLE, StatusCode.OK, MSG_M3, payload)


def m3d(req: AnalysisRequest, max_points: int) -> AnalysisResult:
    p = req.parameters
    pts = _sweep(req, max_points, [p["axis_x"], p["axis_y"]])
    frac = sum(pt.status is Status.FEASIBLE for pt in pts) / len(pts)
    payload = M3dPayload(grid=pts, feasible_fraction=frac).model_dump(mode="json")
    return result(Status.FEASIBLE, StatusCode.OK, MSG_M3, payload)


def m3c(req: AnalysisRequest) -> AnalysisResult:
    s, scen = req.project_snapshot, req.scenarios or []
    r = e_m3.m3c(
        [(sc.scenario_id, cv.network(sc.project_snapshot)) for sc in scen],
        cv.limits(s),  # overrides cannot touch DesignConstraints (Doc 3 §3.10)
        cv.omega_nom(s),
        req.parameters.get("reference_scenario_id"),
        cv.solver(req.solver_config),
    )
    snaps = {sc.scenario_id: sc.project_snapshot for sc in scen}
    payload = M3cPayload(
        scenario_results=[
            ScenarioResult(
                scenario_id=sid,
                status=Status(pr.status.value),
                status_code=pr.code.value,
                key_metrics=_key_metrics(pr.metrics, snaps[sid], set()),
                limiting_constraints=[] if pr.limiting is None else [constraint(pr.limiting, s)],
            )
            for sid, pr in r.scenarios
        ],
        deltas=[
            Delta(
                metric=OutputMetric(d.metric.value),
                scenario_id=d.scenario_id,
                reference_scenario_id=d.reference_scenario_id,
                delta=d.delta * cv.metric_factor(d.metric, s),
                unit=cv.METRIC_UNIT[d.metric],
                relative_delta_ratio=d.relative_delta,
            )
            for d in r.deltas
        ],
    ).model_dump(mode="json")
    return result(Status.FEASIBLE, StatusCode.OK, MSG_M3, payload)


# ------------------------------------------------------------------ M4a (Doc 3 §6.8)
def _indicator(i: e_m4.Indicator) -> Indicator:
    return Indicator(value=i.value, evaluated=i.evaluated, reason=i.reason)


def m4a(req: AnalysisRequest) -> AnalysisResult:
    s, p = req.project_snapshot, req.parameters
    r = e_m4.solve_m4a(
        cv.network(s),
        cv.limits(s),
        cv.omega_nom(s),
        cv.solver(req.solver_config),
        p.get("tau_in_s"),
        p.get("damping_threshold_ratio"),
    )
    if r.status is EStatus.INPUT_INVALID:
        return _input_invalid(r.code.value)
    if r.status is not EStatus.FEASIBLE:
        return result(Status.SOLVER_FAILED, r.code.value, MSG_M4_FAILED.format(code=r.code.value))
    assert r.indicators is not None and r.stability_class is not None
    ind = r.indicators
    payload = M4aPayload(
        eigenvalues=[_eig(v) for v in r.eigenvalues],
        modes=[
            Mode(
                eigenvalue_index=m.index, damping_ratio=m.damping_ratio, frequency_hz=m.frequency_hz
            )
            for m in r.modes
        ],
        zeta_min=r.zeta_min,
        dominant_modes=[
            DominantMode(
                eigenvalue_index=d.index,
                damping_ratio=d.damping_ratio,
                frequency_hz=d.frequency_hz,
                associated_element_ids=list(d.element_ids),
            )
            for d in r.dominant
        ],  # fmt: skip
        participation=(
            None
            if r.participation is None
            else Participation(
                state_names=list(r.state_names), factors=[list(f) for f in r.participation]
            )
        ),
        stability_class=StabilityClass(r.stability_class.value),
        indicators=Indicators(
            r_tau=_indicator(ind.r_tau),
            kappa=_indicator(ind.kappa),
            r_in=_indicator(ind.r_in),
            epsilon_x=_indicator(ind.epsilon_x),
        ),
        outside_definition=r.outside_definition,
        damping_pass=r.damping_pass,
    ).model_dump(mode="json")
    warnings = [
        Warning(
            code=WarningCode.VALIDITY_NOT_CALIBRATED,
            message="The validity indicators have no calibrated thresholds before the PSIM "
            "validation (stage 1.6); read them as descriptive only.",
            path="payload.indicators",
        )
    ]
    diag = {"participation_reason": r.participation_reason} if r.participation_reason else {}
    return result(
        Status.FEASIBLE,
        StatusCode.OK,
        f"Small-signal analysis completed: {r.stability_class.value}.",
        payload,
        warnings=warnings,
        diagnostics=diag,
    )


# ------------------------------------------------------------------ M4b (Doc 3 §6.9)
def _magnitude(d: dict[str, Any], s: ProjectSnapshot) -> float:
    """Contract magnitude → engine SI (W, ratio, W/VAR/V phase/rad·s⁻¹)."""
    x = float(d.get("magnitude") or 0.0)
    kind, ref = d["kind"], d.get("reference")
    if kind == "LOAD_STEP" or (kind == "REFERENCE_STEP" and ref in ("P_SETPOINT", "Q_SETPOINT")):
        return x * 1e3
    if kind == "REFERENCE_STEP" and ref == "V_SETPOINT":
        return cv.v_phase(x)
    if kind == "REFERENCE_STEP" and ref == "F_SETPOINT":
        return x * cv.TWO_PI
    return x  # LOAD_SCALING ratio; unused for INVERTER_OUTAGE


def m4b(req: AnalysisRequest) -> AnalysisResult:
    s, p = req.project_snapshot, req.parameters
    d = p["disturbance"]
    st = p.get("settling")
    r = e_m4b.solve_m4b(
        cv.network(s),
        e_m4b.Disturbance(
            kind=e_m4b.DisturbanceKind(d["kind"]),
            element_id=str(d["element_id"]),
            start_time_s=float(d["start_time_s"]),
            magnitude=_magnitude(d, s),
            magnitude_q_var=float(d.get("magnitude_kvar") or 0.0) * 1e3,
            reference=None if d.get("reference") is None else e_m4b.Reference(d["reference"]),
            duration_s=d.get("duration_s"),
        ),
        float(p["simulation_end_s"]),
        cv.limits(s),
        cv.omega_nom(s),
        None
        if st is None
        else e_m4b.Settling(
            omega_band_rad_s=float(st["frequency_band_hz"]) * cv.TWO_PI,
            v_band_v=cv.v_phase(st["voltage_band_kv"]),
            window_s=float(st["window_s"]),
        ),
        cv.solver(req.solver_config),
    )
    if r.status is EStatus.INPUT_INVALID:
        return _input_invalid(r.code.value)
    if r.status is not EStatus.FEASIBLE:
        return result(Status.SOLVER_FAILED, r.code.value, MSG_M4_FAILED.format(code=r.code.value))
    inv_ids = [i.id for i in s.inverters]
    k_v = cv.SQRT3 / 1e3  # V phase → kV line-to-line
    payload = M4bPayload(
        time_s=list(r.time_s),
        system_frequency_hz=[w / cv.TWO_PI for w in r.omega_rad_s],
        bus_voltage_kv=[
            BusSeries(bus_id=b.id, values=[v * k_v for v in vs])
            for b, vs in zip(s.buses, r.bus_v_v, strict=True)
        ],
        inverter_p_kw=[
            InverterSeries(inverter_id=i, values=[x / 1e3 for x in xs])
            for i, xs in zip(inv_ids, r.inverter_p_w, strict=True)
        ],
        inverter_q_kvar=[
            InverterSeries(inverter_id=i, values=[x / 1e3 for x in xs])
            for i, xs in zip(inv_ids, r.inverter_q_var, strict=True)
        ],
        max_rocof_hz_per_s=r.max_rocof_rad_s2 / cv.TWO_PI,
        transient_class=None
        if r.transient_class is None
        else TransientClass(r.transient_class.value),
        settled=r.settled,
        class_reason=r.class_reason,
    ).model_dump(mode="json")
    cls = r.transient_class.value if r.transient_class else "class not set"
    diag = {
        "inverter_frequency_hz": {  # per-inverter ω (D-53 K68); null after an outage
            i: [None if w is None else w / cv.TWO_PI for w in ws]
            for i, ws in zip(inv_ids, r.inverter_omega_rad_s, strict=True)
        },
        "not_evaluated": list(r.not_evaluated),
    }
    return result(
        Status.FEASIBLE,
        StatusCode.OK,
        f"Simulation completed: {cls}" + (f" ({r.class_reason})." if r.class_reason else "."),
        payload,
        diagnostics=diag,
    )
