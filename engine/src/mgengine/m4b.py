"""M4b transient stability (manuscript 4.2.6, Gambar C.4a–C.4b; Doc 9 D-53 K66–K71).

The M4 model with absolute angles in the ω_nom frame, integrated by LSODA (rtol 10⁻⁸); the
algebraic network is solved by Newton with a warm start at every right-hand-side call. The
horizon is split at the disturbance (and at its end when it reverts); a failed step is retried
from the last state with the step limit divided by 4, at most eight times. Classes per
Gambar C.4b with the settling and envelope criteria of K67.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from enum import StrEnum

import numpy as np
from scipy.integrate import solve_ivp

from mgengine.m1 import Vector, solve_m1
from mgengine.m2 import Limits
from mgengine.m4 import Dae, fd_jacobian, one_inverter_per_bus
from mgengine.types import Code, Network, SolverConfig, Status

RTOL = 1e-8  # 4.2.6
MAX_RETRIES = 8
NEWTON_ITERATIONS = 20  # algebraic network solve per right-hand-side call
ALL = "ALL"


class DisturbanceKind(StrEnum):
    LOAD_STEP = "LOAD_STEP"
    LOAD_SCALING = "LOAD_SCALING"
    REFERENCE_STEP = "REFERENCE_STEP"
    INVERTER_OUTAGE = "INVERTER_OUTAGE"


class Reference(StrEnum):
    P_SETPOINT = "P_SETPOINT"
    Q_SETPOINT = "Q_SETPOINT"
    V_SETPOINT = "V_SETPOINT"
    F_SETPOINT = "F_SETPOINT"


@dataclass(frozen=True)
class Disturbance:
    kind: DisturbanceKind
    element_id: str  # Load id or ALL (scaling), Inverter id (reference step, outage)
    start_time_s: float
    magnitude: float = 0.0  # W (load step Δp), ratio (scaling), W/VAR/V/rad·s⁻¹ (reference Δ)
    magnitude_q_var: float = 0.0  # load step Δq
    reference: Reference | None = None
    duration_s: float | None = None  # None = permanent; an outage is always permanent


@dataclass(frozen=True)
class Settling:
    """K67: bands around the final value over the final window; no defaults."""

    omega_band_rad_s: float
    v_band_v: float
    window_s: float


class TransientClass(StrEnum):
    RECOVERED_STABLE = "RECOVERED_STABLE"
    CRITERIA_VIOLATED = "CRITERIA_VIOLATED"
    UNSTABLE = "UNSTABLE"


@dataclass(frozen=True)
class M4bResult:
    status: Status
    code: Code
    time_s: tuple[float, ...] = ()  # a disturbance instant appears twice: before and after
    omega_rad_s: tuple[float, ...] = ()  # mean ω_i of in-service inverters (K68)
    inverter_omega_rad_s: tuple[tuple[float | None, ...], ...] = ()  # [inverter][sample]
    bus_v_v: tuple[tuple[float, ...], ...] = ()  # [bus][sample], phase V
    inverter_p_w: tuple[tuple[float, ...], ...] = ()  # [inverter][sample]; 0 after outage
    inverter_q_var: tuple[tuple[float, ...], ...] = ()
    max_rocof_rad_s2: float = 0.0  # max m_p,i |dP_f,i/dt|
    transient_class: TransientClass | None = None
    class_reason: str | None = None
    settled: bool | None = None
    not_evaluated: tuple[str, ...] = ()


class _NetworkLostError(Exception):
    pass


def _disturbed(net: Network, d: Disturbance) -> Network | None:
    """The network while the disturbance acts; None when the element does not exist."""
    if d.kind in (DisturbanceKind.LOAD_STEP, DisturbanceKind.LOAD_SCALING):
        hit = [
            ld.id == d.element_id
            or (d.kind is DisturbanceKind.LOAD_SCALING and d.element_id == ALL)
            for ld in net.loads
        ]
        if not any(hit):
            return None
        loads = tuple(
            (
                replace(ld, p_w=ld.p_w + d.magnitude, q_var=ld.q_var + d.magnitude_q_var)
                if d.kind is DisturbanceKind.LOAD_STEP
                else replace(ld, p_w=ld.p_w * d.magnitude, q_var=ld.q_var * d.magnitude)
            )
            if h
            else ld
            for ld, h in zip(net.loads, hit, strict=True)
        )
        return replace(net, loads=loads)
    if d.element_id not in {i.id for i in net.inverters}:
        return None
    if d.kind is DisturbanceKind.INVERTER_OUTAGE:
        return replace(net, inverters=tuple(i for i in net.inverters if i.id != d.element_id))
    field = {
        Reference.P_SETPOINT: "p_set_w",
        Reference.Q_SETPOINT: "q_set_var",
        Reference.V_SETPOINT: "v_set_v",
        Reference.F_SETPOINT: "omega_set_rad_s",
    }[d.reference or Reference.P_SETPOINT]
    inv = tuple(
        replace(i, **{field: getattr(i, field) + d.magnitude}) if i.id == d.element_id else i
        for i in net.inverters
    )
    return replace(net, inverters=inv)


def _invalid(net: Network, d: Disturbance, end_s: float, settling: Settling | None) -> bool:
    """Gambar C.4a: disturbance and criteria consistent?"""
    return (
        _disturbed(net, d) is None
        or not 0.0 <= d.start_time_s < end_s
        or (d.duration_s is not None and d.duration_s <= 0.0)
        or (d.kind is DisturbanceKind.LOAD_SCALING and d.magnitude <= 0.0)
        or (d.kind is DisturbanceKind.REFERENCE_STEP and d.reference is None)
        or (settling is not None and settling.window_s > end_s - d.start_time_s)
    )


def _solve_network(dae: Dae, x: Vector, y: Vector, tol: float) -> Vector:
    """Newton on g(x, y) = 0 from the previous y (warm start); K70 failures raise."""
    if y.size == 0:
        return y
    for _ in range(NEWTON_ITERATIONS):
        r = dae.g(x, y)
        if not np.all(np.isfinite(r)):
            raise _NetworkLostError
        if np.max(np.abs(r)) < tol:
            if np.any(y[: len(dae.load_bus)] <= 0.0):
                raise _NetworkLostError  # V ≤ 0
            return y
        try:
            y = y - np.linalg.solve(fd_jacobian(lambda v: dae.g(x, v), y), r)
        except np.linalg.LinAlgError as e:
            raise _NetworkLostError from e
    raise _NetworkLostError


def solve_m4b(
    net: Network,
    disturbance: Disturbance,
    end_s: float,
    limits: Limits,
    omega_nom_rad_s: float,
    settling: Settling | None = None,
    cfg: SolverConfig | None = None,
) -> M4bResult:
    cfg = cfg or SolverConfig()
    if not one_inverter_per_bus(net):
        return M4bResult(Status.INPUT_INVALID, Code.MULTIPLE_INVERTERS_ON_BUS)
    if _invalid(net, disturbance, end_s, settling):
        return M4bResult(Status.INPUT_INVALID, Code.DISTURBANCE_INVALID)
    m1 = solve_m1(net, cfg)
    if m1.status is not Status.FEASIBLE:
        raise ValueError("M4b needs a FEASIBLE M1 point")
    tol = cfg.mismatch_tolerance_w
    ids = [i.id for i in net.inverters]
    base = Dae(net, relative=False, omega_ref_rad_s=omega_nom_rad_s)
    dt = min(min(base.tau_p), min(base.tau_q)) / 20  # K69

    t0 = disturbance.start_time_s
    hit = _disturbed(net, disturbance)
    assert hit is not None
    segments: list[tuple[float, float, Network]] = [(0.0, t0, net)]
    permanent = (
        disturbance.duration_s is None or disturbance.kind is DisturbanceKind.INVERTER_OUTAGE
    )
    t1 = end_s if permanent else min(end_s, t0 + float(disturbance.duration_s or 0.0))
    segments.append((t0, t1, hit))
    if t1 < end_s:
        segments.append((t1, end_s, net))

    x_all, y = base.initial(m1)
    n = len(ids)
    state = {iid: (x_all[k], x_all[n + k], x_all[2 * n + k]) for k, iid in enumerate(ids)}
    rows: list[tuple[float, Dae, Vector, Vector]] = []
    lost_at: float | None = None

    def guess(dae: Dae, xs: Vector) -> Vector:
        """Last accepted y, its angles shifted with the mean inverter angle (stays on branch)."""
        _, _, x_ref, y_ref = rows[-1]
        y_g = y_ref.copy()
        y_g[len(dae.load_bus) :] += np.mean(dae.split(xs)[0]) - np.mean(dae.split(x_ref)[0])
        return y_g

    def record(t: float, dae: Dae, x: Vector, y0: Vector | None = None) -> None:
        y_k = _solve_network(dae, x, guess(dae, x) if y0 is None else y0, tol)
        rows.append((t, dae, x.copy(), y_k))

    try:
        for s0, s1, seg_net in segments:
            if not seg_net.inverters:
                raise _NetworkLostError  # no source left
            dae = Dae(seg_net, relative=False, omega_ref_rad_s=omega_nom_rad_s)
            act = [i.id for i in seg_net.inverters]
            x = np.array([state[i][j] for j in range(3) for i in act])
            if rows:  # warm start this segment's load buses from the last bus voltages
                V, theta = rows[-1][1].buses(rows[-1][2], rows[-1][3])
                y = np.concatenate((V[dae.load_bus], theta[dae.load_bus]))
            record(s0, dae, x, y)
            t, max_step, retries = s0, s1 - s0, 0
            samples = [s0 + k * dt for k in range(1, int((s1 - s0) / dt) + 1)] + [s1]
            while t < s1:

                def rhs(_t: float, xs: Vector, dae: Dae = dae) -> Vector:
                    return dae.f(xs, _solve_network(dae, xs, guess(dae, xs), tol))

                todo = sorted({s for s in samples if s > t})
                sol = solve_ivp(
                    rhs, (t, s1), x, method="LSODA", rtol=RTOL, t_eval=todo, max_step=max_step
                )
                for k, ts in enumerate(sol.t):
                    xk = sol.y[:, k]
                    if not np.all(np.isfinite(xk)):
                        return M4bResult(Status.SOLVER_FAILED, Code.SIMULATION_FAILED)
                    record(float(ts), dae, xk)
                if sol.status == 0:
                    x, t = sol.y[:, -1], s1
                    break
                retries += 1
                if retries > MAX_RETRIES:
                    return M4bResult(Status.SOLVER_FAILED, Code.SIMULATION_FAILED)
                if sol.t.size:
                    x, t = sol.y[:, -1], float(sol.t[-1])
                max_step /= 4
            m = len(act)
            for k, iid in enumerate(act):
                state[iid] = (x[k], x[m + k], x[2 * m + k])
    except _NetworkLostError:
        lost_at = rows[-1][0] if rows else 0.0
    return _report(net, ids, rows, lost_at, disturbance, limits, settling)


def _report(
    net: Network,
    ids: list[str],
    rows: list[tuple[float, Dae, Vector, Vector]],
    lost_at: float | None,
    d: Disturbance,
    limits: Limits,
    settling: Settling | None,
) -> M4bResult:
    nb = len(net.buses)
    time, w_sys = [], []
    w_inv: list[list[float | None]] = [[] for _ in ids]
    v_bus: list[list[float]] = [[] for _ in range(nb)]
    p_inv: list[list[float]] = [[] for _ in ids]
    q_inv: list[list[float]] = [[] for _ in ids]
    rocof = 0.0
    for t, dae, x, y in rows:
        act = [i.id for i in dae.net.inverters]
        w = dae.omega(x)
        _, p, q = dae.injections(x, y)
        _, pf, _ = dae.split(x)
        V, _ = dae.buses(x, y)
        time.append(t)
        w_sys.append(float(np.mean(w)))
        rocof = max(rocof, float(np.max(dae.m * np.abs(p - pf) / dae.tau_p)))
        for k, iid in enumerate(ids):
            j = act.index(iid) if iid in act else None
            w_inv[k].append(None if j is None else float(w[j]))
            p_inv[k].append(0.0 if j is None else float(p[j]))
            q_inv[k].append(0.0 if j is None else float(q[j]))
        for b in range(nb):
            v_bus[b].append(float(V[b]))
    out = M4bResult(
        Status.FEASIBLE,
        Code.OK,
        tuple(time),
        tuple(w_sys),
        tuple(tuple(r) for r in w_inv),
        tuple(tuple(r) for r in v_bus),
        tuple(tuple(r) for r in p_inv),
        tuple(tuple(r) for r in q_inv),
        rocof,
    )
    if lost_at is not None:
        reason = f"network solution lost or no source left at t = {lost_at:.6g} s"
        return replace(out, transient_class=TransientClass.UNSTABLE, class_reason=reason)
    if settling is None:
        return replace(out, class_reason="settling criteria not given")
    t_end = time[-1]
    win = [k for k, t in enumerate(time) if t >= t_end - settling.window_s]
    settled = all(abs(w_sys[k] - w_sys[-1]) <= settling.omega_band_rad_s for k in win) and all(
        abs(v_bus[b][k] - v_bus[b][-1]) <= settling.v_band_v for b in range(nb) for k in win
    )
    if not settled:
        return replace(
            out, settled=False, transient_class=TransientClass.UNSTABLE, class_reason="not settled"
        )
    post = [k for k, t in enumerate(time) if t >= d.start_time_s]
    skipped, violated = [], False
    for name, lo, hi, series in (
        ("FREQUENCY", limits.omega_min_rad_s, limits.omega_max_rad_s, [w_sys]),
        ("BUS_VOLTAGE", limits.v_min_v, limits.v_max_v, v_bus),
    ):
        for bound, upper in ((lo, False), (hi, True)):
            if bound is None:
                skipped.append(f"{name}_{'MAX' if upper else 'MIN'}")
                continue
            tol = 1e-12 + 1e-9 * abs(bound)  # (4.11)
            for s in series:
                for k in post:
                    if (s[k] > bound + tol) if upper else (s[k] < bound - tol):
                        violated = True
    cls = TransientClass.CRITERIA_VIOLATED if violated else TransientClass.RECOVERED_STABLE
    return replace(out, settled=True, transient_class=cls, not_evaluated=tuple(skipped))
