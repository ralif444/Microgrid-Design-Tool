"""M2: constraint check, preliminary sizing and loadability margins (manuscript 4.2.4).

Five checks (4.10) with the violation tolerance (4.11), normalised margins (4.18), sizing
(4.12)–(4.13), load scaling (4.14), λ_c and λ_s (4.15) traced as in Gambar C.2b, test
oracle λ_ub (4.16). SI units (Doc 9 D-51 K40); design choices K41–K46.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass, replace
from enum import StrEnum

from mgengine.m1 import Vector, solve_m1, state
from mgengine.ps import StorageEnergy, storage_energy
from mgengine.results import M1Details, m1_details
from mgengine.types import M1Result, Network, SolverConfig, Status

EPS_ABS = 1e-12  # (4.11)
EPS_REL = 1e-9
GRID_STEP = 0.05  # (4.15) grid Λ
RESOLUTION = 0.005  # bisection bracket around each status change
SYSTEM = "SYSTEM"


class ImplementationError(RuntimeError):
    """λ_c > λ_ub with the loading check active (4.2.4); adapter maps it to ENGINE_ERROR."""


class Kind(StrEnum):  # same names as the contract ConstraintKind
    BUS_VOLTAGE_MIN = "BUS_VOLTAGE_MIN"
    BUS_VOLTAGE_MAX = "BUS_VOLTAGE_MAX"
    FREQUENCY_MIN = "FREQUENCY_MIN"
    FREQUENCY_MAX = "FREQUENCY_MAX"
    INVERTER_LOADING = "INVERTER_LOADING"
    LINE_CURRENT = "LINE_CURRENT"
    POWER_BALANCE = "POWER_BALANCE"


class Verdict(StrEnum):
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"


@dataclass(frozen=True)
class Limits:
    """Design limits in SI; None = not evaluated (no default values, 4.2.4)."""

    v_min_v: float | None = None  # phase voltage
    v_max_v: float | None = None
    omega_min_rad_s: float | None = None
    omega_max_rad_s: float | None = None
    loading_max_ratio: float | None = None  # μ_max
    line_current_max_a: tuple[float | None, ...] = ()  # one per line, resolved by the adapter
    balance_tolerance_w: float | None = None


@dataclass(frozen=True)
class Constraint:
    kind: Kind
    element_id: str
    value: float
    limit: float
    margin: float  # signed distance to the limit; negative = beyond it
    normalised_margin: float  # (4.18)
    violated: bool  # beyond the (4.11) tolerance


@dataclass(frozen=True)
class InverterSizing:
    inverter_id: str
    s_va: float
    required_rating_va: float
    headroom_va: float
    rating_margin_short: bool


@dataclass(frozen=True)
class LineSizing:
    line_id: str
    current_a: float
    required_current_a: float


@dataclass(frozen=True)
class Loadability:
    lambda_c: float | None
    lambda_s: float
    lambda_ub: float | None
    resolution: float
    grid_step: float
    points: int
    stop_reason: str


@dataclass(frozen=True)
class M2Result:
    verdict: Verdict
    constraints: tuple[Constraint, ...]  # sorted by normalised margin ascending
    not_evaluated: tuple[tuple[Kind, str], ...]
    per_inverter: tuple[InverterSizing, ...]
    per_line: tuple[LineSizing, ...]
    storage: StorageEnergy | None
    loadability: Loadability


def _tol(u: float) -> float:
    return EPS_ABS + EPS_REL * abs(u)


def _bound(
    kind: Kind, element: str, x: float, limit: float, upper: bool, scale: float
) -> Constraint:
    margin = limit - x if upper else x - limit
    return Constraint(kind, element, x, limit, margin, margin / scale, margin < -_tol(limit))


def check(
    net: Network, res: M1Result, d: M1Details, limits: Limits
) -> tuple[list[Constraint], list[tuple[Kind, str]]]:
    """Five checks (4.10) on one admissible point; scales s_c per (4.18)."""
    assert res.v_v is not None and res.omega_rad_s is not None
    out: list[Constraint] = []
    skipped: list[tuple[Kind, str]] = []

    def band(
        lo: float | None, hi: float | None, kmin: Kind, kmax: Kind, element: str, x: float
    ) -> None:
        width = hi - lo if lo is not None and hi is not None else None
        for kind, lim, upper in ((kmin, lo, False), (kmax, hi, True)):
            if lim is None:
                skipped.append((kind, element))
            else:
                out.append(_bound(kind, element, x, lim, upper, width or abs(lim)))

    for bus, v in zip(net.buses, res.v_v, strict=True):
        band(limits.v_min_v, limits.v_max_v, Kind.BUS_VOLTAGE_MIN, Kind.BUS_VOLTAGE_MAX, bus, v)
    band(
        limits.omega_min_rad_s,
        limits.omega_max_rad_s,
        Kind.FREQUENCY_MIN,
        Kind.FREQUENCY_MAX,
        SYSTEM,
        res.omega_rad_s,
    )
    mu = limits.loading_max_ratio
    for inv in d.inverters:
        if mu is None:
            skipped.append((Kind.INVERTER_LOADING, inv.inverter_id))
        else:
            out.append(
                _bound(Kind.INVERTER_LOADING, inv.inverter_id, inv.loading_ratio, mu, True, mu)
            )
    line_limits = limits.line_current_max_a or (None,) * len(d.lines)
    for lf, i_max in zip(d.lines, line_limits, strict=True):
        if i_max is None:
            skipped.append((Kind.LINE_CURRENT, lf.line_id))
        else:
            out.append(_bound(Kind.LINE_CURRENT, lf.line_id, lf.current_a, i_max, True, i_max))
    if limits.balance_tolerance_w is None:
        skipped.append((Kind.POWER_BALANCE, SYSTEM))
    else:
        dp = sum(i.p_w for i in d.inverters) - d.total_load_w - d.total_losses_w  # K42
        tol = limits.balance_tolerance_w
        out.append(_bound(Kind.POWER_BALANCE, SYSTEM, abs(dp), tol, True, tol))
    out.sort(key=lambda c: (c.normalised_margin, list(Kind).index(c.kind), c.element_id))
    return out, skipped


def scaled(net: Network, lam: float) -> Network:
    """(4.14): every load scaled at constant power factor."""
    loads = tuple(replace(ld, p_w=lam * ld.p_w, q_var=lam * ld.q_var) for ld in net.loads)
    return replace(net, loads=loads)


def lambda_ub(net: Network, limits: Limits) -> float | None:
    """(4.16), only with the loading limit set (K45)."""
    s_load = abs(sum(complex(ld.p_w, ld.q_var) for ld in net.loads))
    if limits.loading_max_ratio is None or s_load == 0.0:
        return None
    return sum(limits.loading_max_ratio * inv.rated_va for inv in net.inverters) / s_load


class _PointCapError(Exception):
    pass


def trace(
    net: Network,
    limits: Limits,
    omega_nom_rad_s: float,
    max_points: int,
    cfg: SolverConfig | None = None,
    x0: Vector | None = None,
) -> Loadability:
    """λ_c, λ_s by grid from λ = 1, bisection to RESOLUTION, warm start (K44, Gambar C.2b)."""
    warm = [x0]
    count = [0]

    def status(lam: float) -> str:  # FEASIBLE, INFEASIBLE or FAIL (no admissible point)
        if count[0] >= max_points:
            raise _PointCapError
        count[0] += 1
        net_l = scaled(net, lam)
        res = solve_m1(net_l, cfg, warm[0])
        if res.status is not Status.FEASIBLE:
            return "FAIL"
        warm[0] = state(res)
        cons, _ = check(net_l, res, m1_details(net_l, res, omega_nom_rad_s), limits)
        return "INFEASIBLE" if any(c.violated for c in cons) else "FEASIBLE"

    def bisect(lo: float, hi: float, good: Callable[[str], bool]) -> float:
        while hi - lo > RESOLUTION + 1e-12:
            mid = (lo + hi) / 2
            if good(status(mid)):
                lo = mid
            else:
                hi = mid
        return lo

    first = status(1.0)
    if first == "FAIL":
        raise ValueError("M1 has no admissible point at λ = 1; M2 needs a valid M1")
    lam_c: float | None = None if first == "INFEASIBLE" else math.nan  # nan = still tracing
    prev, k, reason = 1.0, 0, ""
    try:
        while True:
            k += 1
            lam = 1.0 + k * GRID_STEP
            s = status(lam)
            if lam_c is not None and math.isnan(lam_c) and s != "FEASIBLE":
                lam_c = bisect(prev, lam, lambda st: st == "FEASIBLE")
            if s == "FAIL":
                lam_s = bisect(prev, lam, lambda st: st != "FAIL")
                reason = f"first failure at λ = {lam:.4g}"
                break
            prev = lam
    except _PointCapError:
        lam_s = prev
        reason = f"point cap {max_points} reached"
    if lam_c is not None and math.isnan(lam_c):
        lam_c = prev
    ub = lambda_ub(net, limits)
    if ub is not None and lam_c is not None and lam_c > ub:
        raise ImplementationError(f"λ_c = {lam_c} > λ_ub = {ub}")
    return Loadability(lam_c, lam_s, ub, RESOLUTION, GRID_STEP, count[0], reason)


def solve_m2(
    net: Network,
    limits: Limits,
    omega_nom_rad_s: float,
    inverter_margin_ratio: float,
    line_margin_ratio: float,
    max_points: int,
    autonomy_h: int | None = None,
    dc_efficiency_ratio: float | None = None,
    depth_of_discharge_ratio: float | None = None,
    cfg: SolverConfig | None = None,
) -> M2Result:
    res = solve_m1(net, cfg)  # K41
    if res.status is not Status.FEASIBLE:
        raise ValueError("M2 needs a FEASIBLE M1 point")
    d = m1_details(net, res, omega_nom_rad_s)
    cons, skipped = check(net, res, d, limits)
    rated = {inv.id: inv.rated_va for inv in net.inverters}
    per_inv = []
    for o in d.inverters:  # (4.12)
        req = o.s_va * (1.0 + inverter_margin_ratio)
        head = rated[o.inverter_id] - req
        per_inv.append(InverterSizing(o.inverter_id, o.s_va, req, head, head < 0.0))
    per_line = tuple(
        LineSizing(lf.line_id, lf.current_a, lf.current_a * (1.0 + line_margin_ratio))
        for lf in d.lines
    )
    storage = None
    if autonomy_h is not None:  # (4.13) with P_demand = M1 total load (K46)
        storage = storage_energy(
            d.total_load_w * autonomy_h, dc_efficiency_ratio, depth_of_discharge_ratio
        )
    return M2Result(
        verdict=Verdict.INFEASIBLE if any(c.violated for c in cons) else Verdict.FEASIBLE,
        constraints=tuple(cons),
        not_evaluated=tuple(skipped),
        per_inverter=tuple(per_inv),
        per_line=per_line,
        storage=storage,
        loadability=trace(net, limits, omega_nom_rad_s, max_points, cfg, state(res)),
    )
