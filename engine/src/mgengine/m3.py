"""M3: sensitivity, sweeps and scenarios (manuscript 4.2.5, (4.17)–(4.18), Gambar C.3a–C.3b).

Each point runs M1 then the M2 checks. The adapter builds the varied Networks (Doc 9 D-52 K50);
every point starts from the flat start (K51). SI units like the rest of the engine.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum

from mgengine.m1 import solve_m1
from mgengine.m2 import Constraint, Kind, Limits, check, trace
from mgengine.results import m1_details
from mgengine.types import Code, Network, SolverConfig, Status


class PointStatus(StrEnum):
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    SOLVER_FAILED = "SOLVER_FAILED"
    PHYSICALLY_INADMISSIBLE = "PHYSICALLY_INADMISSIBLE"


class Metric(StrEnum):  # same names as the contract OutputMetric
    SYSTEM_FREQUENCY = "SYSTEM_FREQUENCY"
    MIN_BUS_VOLTAGE = "MIN_BUS_VOLTAGE"
    MAX_BUS_VOLTAGE = "MAX_BUS_VOLTAGE"
    MAX_INVERTER_LOADING = "MAX_INVERTER_LOADING"
    MAX_LINE_CURRENT = "MAX_LINE_CURRENT"
    TOTAL_LOSSES = "TOTAL_LOSSES"


class Scheme(StrEnum):
    CENTRAL = "CENTRAL"
    FORWARD = "FORWARD"
    BACKWARD = "BACKWARD"


@dataclass(frozen=True)
class KeyMetrics:
    omega_rad_s: float
    v_min_v: float
    v_max_v: float
    max_loading_ratio: float
    max_line_current_a: float
    total_losses_w: float
    epsilon_x_ratio: float
    lambda_c: float | None = None  # only when requested (K56)

    def get(self, metric: Metric) -> float:
        return {
            Metric.SYSTEM_FREQUENCY: self.omega_rad_s,
            Metric.MIN_BUS_VOLTAGE: self.v_min_v,
            Metric.MAX_BUS_VOLTAGE: self.v_max_v,
            Metric.MAX_INVERTER_LOADING: self.max_loading_ratio,
            Metric.MAX_LINE_CURRENT: self.max_line_current_a,
            Metric.TOTAL_LOSSES: self.total_losses_w,
        }[metric]


@dataclass(frozen=True)
class PointResult:
    status: PointStatus
    code: Code
    limiting: Constraint | None
    metrics: KeyMetrics | None  # None for a failed point (outputs left empty, Gambar C.3a)


def limiting(cons: Sequence[Constraint]) -> Constraint | None:
    """(4.18) on a list sorted by μ̄: first violation, else first non-balance check (K57)."""
    violated = [c for c in cons if c.violated]
    if violated:
        return violated[0]
    return next((c for c in cons if c.kind is not Kind.POWER_BALANCE), None)


def evaluate(
    net: Network,
    limits: Limits,
    omega_nom_rad_s: float,
    cfg: SolverConfig | None = None,
    lambda_c_points: int | None = None,
) -> PointResult:
    """One sweep point: M1, then the M2 checks; λ_c only when lambda_c_points is given."""
    res = solve_m1(net, cfg)
    if res.status is not Status.FEASIBLE:
        return PointResult(PointStatus(res.status.value), res.code, None, None)
    assert res.v_v is not None and res.omega_rad_s is not None
    d = m1_details(net, res, omega_nom_rad_s)
    cons, _ = check(net, res, d, limits)
    lam_c = None
    if lambda_c_points is not None:
        lam_c = trace(net, limits, omega_nom_rad_s, lambda_c_points, cfg).lambda_c
    metrics = KeyMetrics(
        omega_rad_s=res.omega_rad_s,
        v_min_v=min(res.v_v),
        v_max_v=max(res.v_v),
        max_loading_ratio=max(i.loading_ratio for i in d.inverters),
        max_line_current_a=max((lf.current_a for lf in d.lines), default=0.0),
        total_losses_w=d.total_losses_w,
        epsilon_x_ratio=d.epsilon_x_ratio,
        lambda_c=lam_c,
    )
    if any(c.violated for c in cons):
        return PointResult(
            PointStatus.INFEASIBLE, Code.CONSTRAINT_VIOLATED, limiting(cons), metrics
        )
    return PointResult(PointStatus.FEASIBLE, Code.OK, limiting(cons), metrics)


# ------------------------------------------------------------------ M3a (4.17)
@dataclass(frozen=True)
class SensitivityCase:
    parameter_id: str
    p0: float
    h: float
    minus: Network  # design at p0 − h
    plus: Network  # design at p0 + h


@dataclass(frozen=True)
class Sensitivity:
    parameter_id: str
    metric: Metric
    value: float | None  # dy/dp in engine units; None = not reported (reason)
    normalised_value: float | None  # S_norm = dy/dp · p0/y0; None when y0 or p0 is 0 (K53)
    scheme: Scheme | None
    status_change: bool  # statuses of the two sides differ (K52)
    reason: str | None


@dataclass(frozen=True)
class Rank:
    metric: Metric
    parameter_id: str
    rank: int


@dataclass(frozen=True)
class M3aResult:
    sensitivities: tuple[Sensitivity, ...]
    ranking: tuple[Rank, ...]


def _derivative(
    b: PointResult, lo: PointResult, hi: PointResult, case: SensitivityCase, metric: Metric
) -> tuple[float | None, Scheme | None, str | None]:
    """(4.17): central, or one-sided when one side fails; None with a reason otherwise."""
    if b.metrics is None:
        return None, None, "base point not admissible"
    if case.h == 0.0:
        return None, None, "step is zero (relative step with p0 = 0)"  # K58
    y0, h = b.metrics.get(metric), case.h
    if lo.metrics is not None and hi.metrics is not None:
        return (hi.metrics.get(metric) - lo.metrics.get(metric)) / (2 * h), Scheme.CENTRAL, None
    if hi.metrics is not None:
        return (hi.metrics.get(metric) - y0) / h, Scheme.FORWARD, None
    if lo.metrics is not None:
        return (y0 - lo.metrics.get(metric)) / h, Scheme.BACKWARD, None
    return None, None, "both sides failed"


def m3a(
    base: Network,
    cases: Sequence[SensitivityCase],
    metrics: Sequence[Metric],
    limits: Limits,
    omega_nom_rad_s: float,
    cfg: SolverConfig | None = None,
) -> M3aResult:
    b = evaluate(base, limits, omega_nom_rad_s, cfg)
    out: list[Sensitivity] = []
    for case in cases:
        lo = evaluate(case.minus, limits, omega_nom_rad_s, cfg)
        hi = evaluate(case.plus, limits, omega_nom_rad_s, cfg)
        change = lo.status != hi.status
        for metric in metrics:
            dy, scheme, reason = _derivative(b, lo, hi, case, metric)
            y0 = b.metrics.get(metric) if b.metrics is not None else 0.0
            norm = dy * case.p0 / y0 if dy is not None and y0 != 0.0 and case.p0 != 0.0 else None
            out.append(Sensitivity(case.parameter_id, metric, dy, norm, scheme, change, reason))
    ranking: list[Rank] = []
    for metric in metrics:  # K54: |S_norm| descending, ties in request order (stable sort)
        ranked = sorted(
            (s for s in out if s.metric is metric and s.normalised_value is not None),
            key=lambda s: -abs(s.normalised_value or 0.0),
        )
        ranking += [Rank(metric, s.parameter_id, k) for k, s in enumerate(ranked, 1)]
    return M3aResult(tuple(out), tuple(ranking))


# ------------------------------------------------------------------ M3b, M3d
@dataclass(frozen=True)
class M3bResult:
    points: tuple[tuple[float, PointResult], ...]
    first_infeasible_value: float | None  # first grid value whose status is not FEASIBLE


def m3b(
    points: Sequence[tuple[float, Network]],
    limits: Limits,
    omega_nom_rad_s: float,
    cfg: SolverConfig | None = None,
    lambda_c_points: int | None = None,
) -> M3bResult:
    res = tuple((v, evaluate(n, limits, omega_nom_rad_s, cfg, lambda_c_points)) for v, n in points)
    first = next((v for v, r in res if r.status is not PointStatus.FEASIBLE), None)
    return M3bResult(res, first)


@dataclass(frozen=True)
class M3dResult:
    grid: tuple[tuple[float, float, PointResult], ...]
    feasible_fraction: float


def m3d(
    grid: Sequence[tuple[float, float, Network]],
    limits: Limits,
    omega_nom_rad_s: float,
    cfg: SolverConfig | None = None,
    lambda_c_points: int | None = None,
) -> M3dResult:
    res = tuple(
        (x, y, evaluate(n, limits, omega_nom_rad_s, cfg, lambda_c_points)) for x, y, n in grid
    )
    feasible = sum(r.status is PointStatus.FEASIBLE for _, _, r in res)
    return M3dResult(res, feasible / len(res))


# ------------------------------------------------------------------ M3c
@dataclass(frozen=True)
class Delta:
    metric: Metric
    scenario_id: str
    reference_scenario_id: str
    delta: float
    relative_delta: float | None  # None when the reference value is 0 (K55)


@dataclass(frozen=True)
class M3cResult:
    scenarios: tuple[tuple[str, PointResult], ...]
    deltas: tuple[Delta, ...]


def m3c(
    scenarios: Sequence[tuple[str, Network]],
    limits: Limits,
    omega_nom_rad_s: float,
    reference_scenario_id: str | None = None,
    cfg: SolverConfig | None = None,
) -> M3cResult:
    res = tuple((sid, evaluate(n, limits, omega_nom_rad_s, cfg)) for sid, n in scenarios)
    ref_id = reference_scenario_id or res[0][0]
    ref = dict(res)[ref_id].metrics
    deltas: list[Delta] = []
    for sid, r in res:
        if sid == ref_id or ref is None or r.metrics is None:
            continue  # differences only between admissible points (K55)
        for metric in Metric:
            y_ref = ref.get(metric)
            d = r.metrics.get(metric) - y_ref
            deltas.append(Delta(metric, sid, ref_id, d, d / y_ref if y_ref != 0.0 else None))
    return M3cResult(res, tuple(deltas))
