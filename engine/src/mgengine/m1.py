"""M1: droop power flow without a slack bus, Newton–Raphson (manuscript 4.2.3, (4.5)–(4.9)).

State x = [V_1..V_n, θ_2..θ_n, ω] (4.6). Mismatch F = [P_spec − P_net; Q_spec − Q_net] (4.8)
with P_net, Q_net from (4.7) and the droop injections (4.5) in P_spec, Q_spec. The Jacobian
is analytic; its ω column holds −Σ 1/m_p on the active-power rows of buses with inverters.
Equation and unit audit: engine/docs/m1.md.
"""

from __future__ import annotations

import numpy as np
import numpy.typing as npt

from mgengine.network import Complex, admittance
from mgengine.types import Code, M1Result, Network, SolverConfig, Status

Vector = npt.NDArray[np.float64]


class _Model:
    """Per-bus sums of the droop and load terms, so F and J are vector expressions."""

    def __init__(self, net: Network) -> None:
        n = len(net.buses)
        index = {b: i for i, b in enumerate(net.buses)}
        self.n = n
        self.Y = admittance(net)
        self.p_load = np.zeros(n)
        self.q_load = np.zeros(n)
        for ld in net.loads:
            self.p_load[index[ld.bus]] += ld.p_w
            self.q_load[index[ld.bus]] += ld.q_var
        # Σ over inverters on a bus (D-49 K29): P_spec = a_p − b_p ω, Q_spec = a_q − b_q V
        self.b_p = np.zeros(n)
        self.a_p = np.zeros(n)
        self.b_q = np.zeros(n)
        self.a_q = np.zeros(n)
        for inv in net.inverters:
            i = index[inv.bus]
            self.b_p[i] += 1.0 / inv.m_p_rad_s_per_w
            self.a_p[i] += inv.p_set_w + inv.omega_set_rad_s / inv.m_p_rad_s_per_w
            self.b_q[i] += 1.0 / inv.n_q_v_per_var
            self.a_q[i] += inv.q_set_var + inv.v_set_v / inv.n_q_v_per_var

    def split(self, x: Vector) -> tuple[Vector, Vector, float]:
        n = self.n
        theta = np.concatenate(([0.0], x[n : 2 * n - 1]))
        return x[:n], theta, float(x[-1])

    def power(self, V: Vector, theta: Vector) -> tuple[Complex, Complex, Complex]:
        """S = 3 V conj(Y V) per (4.7); also returns the phasors and bus currents."""
        Vc = V.astype(np.complex128) * np.exp(1j * theta)
        current = self.Y @ Vc
        return 3.0 * Vc * np.conj(current), Vc, current

    def mismatch(self, x: Vector) -> Vector:
        V, theta, omega = self.split(x)
        S, _, _ = self.power(V, theta)
        p_spec = self.a_p - self.b_p * omega - self.p_load
        q_spec = self.a_q - self.b_q * V - self.q_load
        return np.concatenate((p_spec - S.real, q_spec - S.imag))

    def jacobian(self, x: Vector) -> npt.NDArray[np.float64]:
        V, theta, _ = self.split(x)
        _, Vc, current = self.power(V, theta)
        unit = np.exp(1j * theta)  # dVc/dV; V is a signed magnitude, so no division by |V|
        # derivative of S = 3 Vc conj(I), I = Y Vc (standard polar form, times 3)
        dS_dtheta = 3.0 * 1j * np.diag(Vc) @ np.conj(np.diag(current) - self.Y @ np.diag(Vc))
        dS_dV = 3.0 * (
            np.diag(Vc) @ np.conj(self.Y @ np.diag(unit)) + np.diag(np.conj(current) * unit)
        )
        n = self.n
        J = np.zeros((2 * n, 2 * n))
        J[:n, :n] = -dS_dV.real
        J[:n, n : 2 * n - 1] = -dS_dtheta.real[:, 1:]
        J[:n, -1] = -self.b_p
        J[n:, :n] = -dS_dV.imag - np.diag(self.b_q)
        J[n:, n : 2 * n - 1] = -dS_dtheta.imag[:, 1:]
        return J


def initial_guess(net: Network) -> Vector:
    """θ = 0; V from the bus's inverter setpoints; ω0 from the droop sum (D-49 K30, (4.9))."""
    index = {b: i for i, b in enumerate(net.buses)}
    n = len(net.buses)
    v_all = float(np.mean([inv.v_set_v for inv in net.inverters]))
    V = np.full(n, v_all)
    for i in range(n):
        own = [inv.v_set_v for inv in net.inverters if index[inv.bus] == i]
        if own:
            V[i] = float(np.mean(own))
    inv_m = sum(1.0 / inv.m_p_rad_s_per_w for inv in net.inverters)
    p_load = sum(ld.p_w for ld in net.loads)
    omega0 = (
        sum(inv.omega_set_rad_s / inv.m_p_rad_s_per_w + inv.p_set_w for inv in net.inverters)
        - p_load
    ) / inv_m
    return np.concatenate((V, np.zeros(n - 1), [omega0]))


def _result(
    status: Status, code: Code, k: int, x: Vector | None, model: _Model, f: Vector
) -> M1Result:
    worst = float(np.max(np.abs(f))) if np.all(np.isfinite(f)) else float("inf")
    if x is None:
        return M1Result(status, code, k, None, None, None, worst)
    V, theta, omega = model.split(x)
    return M1Result(status, code, k, tuple(V.tolist()), tuple(theta.tolist()), omega, worst)


def state(res: M1Result) -> Vector:
    """State vector (4.6) of a solved point, for a warm start (D-51 K44)."""
    if res.v_v is None or res.theta_rad is None or res.omega_rad_s is None:
        raise ValueError(f"no operating point for status {res.status}")
    return np.array([*res.v_v, *res.theta_rad[1:], res.omega_rad_s])


def solve_m1(net: Network, cfg: SolverConfig | None = None, x0: Vector | None = None) -> M1Result:
    cfg = cfg or SolverConfig()
    model = _Model(net)
    x = initial_guess(net) if x0 is None else x0
    for k in range(cfg.max_iterations + 1):
        f = model.mismatch(x)
        if not (np.all(np.isfinite(x)) and np.all(np.isfinite(f))):
            return _result(Status.SOLVER_FAILED, Code.NON_FINITE, k, None, model, f)
        if np.max(np.abs(f)) < cfg.mismatch_tolerance_w:
            if np.any(x[: model.n] <= 0.0):  # root with V ≤ 0 (manuscript 4.2.3)
                return _result(
                    Status.PHYSICALLY_INADMISSIBLE,
                    Code.OPERATING_POINT_NOT_PHYSICAL,
                    k,
                    x,
                    model,
                    f,
                )
            return _result(Status.FEASIBLE, Code.OK, k, x, model, f)
        if k == cfg.max_iterations:
            break
        J = model.jacobian(x)
        cond = np.linalg.cond(J)
        if not np.isfinite(cond) or cond > cfg.max_condition_number:
            return _result(Status.SOLVER_FAILED, Code.ILL_CONDITIONED_JACOBIAN, k, None, model, f)
        x = x + np.linalg.solve(J, -f)
    return _result(
        Status.SOLVER_FAILED, Code.MAX_ITERATIONS_REACHED, cfg.max_iterations, None, model, f
    )
