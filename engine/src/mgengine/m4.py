"""M4 model and M4a small-signal stability (manuscript 4.2.6–4.2.7, (2.1), (2.7), (4.19)–(4.23)).

Outer power loop with a quasi-static network (A1): states δ (rad), P_f (W), Q_f (VAR) per
inverter; algebraic V, θ on buses without an inverter. Droop (2.1) on the filtered powers sets
each inverter's ω_i and bus voltage V_i (ideal source, A2). M4a uses δ_j relative to the first
inverter, state size (N − 1) + 2N; M4b uses absolute angles in the ω_nom frame (Doc 9 D-53 K66).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum

import numpy as np
import numpy.typing as npt

from mgengine.m1 import Vector, solve_m1
from mgengine.m2 import Limits, check
from mgengine.network import Complex, admittance
from mgengine.results import m1_details
from mgengine.types import Code, M1Result, Network, SolverConfig, Status

Matrix = npt.NDArray[np.float64]
MAX_COND = 1e12  # cond(g_y) and cond(Φ) limit (4.2.6, K63)


def one_inverter_per_bus(net: Network) -> bool:
    buses = [inv.bus for inv in net.inverters]
    return len(buses) == len(set(buses))  # K61


class Dae:
    """f(x, y) and g(x, y) of the M4 model for one set of in-service inverters."""

    def __init__(self, net: Network, relative: bool, omega_ref_rad_s: float = 0.0) -> None:
        index = {b: i for i, b in enumerate(net.buses)}
        self.net = net
        self.relative = relative
        self.omega_ref = omega_ref_rad_s  # frame of the absolute angles (M4b)
        self.Y = admittance(net)
        n = len(net.buses)
        self.p_load = np.zeros(n)
        self.q_load = np.zeros(n)
        for ld in net.loads:
            self.p_load[index[ld.bus]] += ld.p_w
            self.q_load[index[ld.bus]] += ld.q_var
        inv = net.inverters
        if any(i.tau_p_s is None or i.tau_q_s is None for i in inv):
            raise ValueError("M4 needs tau_p_s and tau_q_s on every inverter (A3)")
        self.inv_bus = np.array([index[i.bus] for i in inv], dtype=int)
        self.load_bus = np.array([b for b in range(n) if b not in set(self.inv_bus)], dtype=int)
        self.m = np.array([i.m_p_rad_s_per_w for i in inv])
        self.nq = np.array([i.n_q_v_per_var for i in inv])
        self.w_set = np.array([i.omega_set_rad_s for i in inv])
        self.v_set = np.array([i.v_set_v for i in inv])
        self.p_set = np.array([i.p_set_w for i in inv])
        self.q_set = np.array([i.q_set_var for i in inv])
        self.tau_p = np.array([float(i.tau_p_s or 0.0) for i in inv])
        self.tau_q = np.array([float(i.tau_q_s or 0.0) for i in inv])
        self.N = len(inv)
        self.nd = self.N - 1 if relative else self.N

    def split(self, x: Vector) -> tuple[Vector, Vector, Vector]:
        nd, N = self.nd, self.N
        delta = np.concatenate(([0.0], x[:nd])) if self.relative else x[:nd]
        return delta, x[nd : nd + N], x[nd + N :]

    def omega(self, x: Vector) -> Vector:
        _, pf, _ = self.split(x)
        w: Vector = self.w_set - self.m * (pf - self.p_set)  # (2.1) on filtered P
        return w

    def buses(self, x: Vector, y: Vector) -> tuple[Vector, Vector]:
        delta, _, qf = self.split(x)
        V = np.zeros(len(self.net.buses))
        theta = np.zeros(len(self.net.buses))
        V[self.inv_bus] = self.v_set - self.nq * (qf - self.q_set)  # (2.1) on filtered Q
        theta[self.inv_bus] = delta
        nl = len(self.load_bus)
        V[self.load_bus] = y[:nl]
        theta[self.load_bus] = y[nl:]
        return V, theta

    def injections(self, x: Vector, y: Vector) -> tuple[Complex, Vector, Vector]:
        """Net bus injection S = 3 V̄ conj(Y V̄) (4.7) plus the inverter output P_i, Q_i."""
        V, theta = self.buses(x, y)
        Vc = V.astype(np.complex128) * np.exp(1j * theta)
        S = 3.0 * Vc * np.conj(self.Y @ Vc)
        p_inv: Vector = S.real[self.inv_bus] + self.p_load[self.inv_bus]
        q_inv: Vector = S.imag[self.inv_bus] + self.q_load[self.inv_bus]
        return S, p_inv, q_inv

    def f(self, x: Vector, y: Vector) -> Vector:
        _, pf, qf = self.split(x)
        _, p_inv, q_inv = self.injections(x, y)
        w = self.omega(x)
        d_delta = w[1:] - w[0] if self.relative else w - self.omega_ref  # (4.19)
        return np.concatenate((d_delta, (p_inv - pf) / self.tau_p, (q_inv - qf) / self.tau_q))

    def g(self, x: Vector, y: Vector) -> Vector:
        S, _, _ = self.injections(x, y)
        lb = self.load_bus
        return np.concatenate((S.real[lb] + self.p_load[lb], S.imag[lb] + self.q_load[lb]))

    def initial(self, res: M1Result) -> tuple[Vector, Vector]:
        """Equilibrium from the M1 point: P_f, Q_f from (4.5), angles and load-bus V, θ."""
        assert res.v_v is not None and res.theta_rad is not None and res.omega_rad_s is not None
        V, theta = np.array(res.v_v), np.array(res.theta_rad)
        if self.relative:
            theta = theta - theta[self.inv_bus[0]]
        delta = theta[self.inv_bus][1:] if self.relative else theta[self.inv_bus]
        pf = self.p_set + (self.w_set - res.omega_rad_s) / self.m
        qf = self.q_set + (self.v_set - V[self.inv_bus]) / self.nq
        x = np.concatenate((delta, pf, qf))
        y = np.concatenate((V[self.load_bus], theta[self.load_bus]))
        return x, y


def fd_jacobian(fun: Callable[[Vector], Vector], z: Vector) -> Matrix:
    """Central finite differences (K60)."""
    cols = []
    for j in range(z.size):
        h = 1e-6 * max(1.0, abs(z[j]))
        e = np.zeros_like(z)
        e[j] = h
        cols.append((fun(z + e) - fun(z - e)) / (2 * h))
    return np.array(cols).T.reshape(fun(z).size, z.size)


class StabilityClass(StrEnum):
    STABLE = "STABLE"
    UNSTABLE = "UNSTABLE"
    MARGINAL = "MARGINAL"


def stability_class(eig: npt.NDArray[np.complex128]) -> StabilityClass:
    t = 1e-9 * float(np.max(np.abs(eig)))  # t_λ (4.2.6)
    worst = float(np.max(eig.real))
    if worst < -t:
        return StabilityClass.STABLE
    return StabilityClass.UNSTABLE if worst > t else StabilityClass.MARGINAL


@dataclass(frozen=True)
class Mode:
    index: int
    damping_ratio: float | None  # (4.20); None for λ = 0
    frequency_hz: float


@dataclass(frozen=True)
class DominantMode:
    index: int
    damping_ratio: float | None
    frequency_hz: float
    element_ids: tuple[str, ...]


@dataclass(frozen=True)
class Indicator:
    value: float | None
    evaluated: bool
    reason: str | None


@dataclass(frozen=True)
class Indicators:
    r_tau: Indicator
    kappa: Indicator
    r_in: Indicator
    epsilon_x: Indicator


@dataclass(frozen=True)
class M4aResult:
    status: Status
    code: Code
    eigenvalues: tuple[complex, ...] = ()
    modes: tuple[Mode, ...] = ()
    zeta_min: float | None = None
    dominant: tuple[DominantMode, ...] = ()
    state_names: tuple[str, ...] = ()
    participation: tuple[tuple[float, ...], ...] | None = None  # [mode][state], (4.21)
    participation_reason: str | None = None
    stability_class: StabilityClass | None = None
    indicators: Indicators | None = None
    outside_definition: bool = False
    damping_pass: bool | None = None  # K65


def _failed(code: Code) -> M4aResult:
    return M4aResult(Status.SOLVER_FAILED, code)


def _indicators(
    net: Network, eig_dom: complex | None, eps_x: float, omega_nom: float, tau_in_s: float | None
) -> Indicators:
    """(4.23) and ε_X (4.1); no thresholds until stage 1.6 (K64)."""
    tau_p = min(float(i.tau_p_s or 0.0) for i in net.inverters)
    tau_pq = min(min(float(i.tau_p_s or 0.0), float(i.tau_q_s or 0.0)) for i in net.inverters)
    if not net.lines or any(ln.r_ohm == 0.0 for ln in net.lines):
        why = "line without resistance: T_l undefined" if net.lines else "no lines"
        r_tau = kappa = Indicator(None, False, why)
    else:
        t_max = max(ln.x_ohm / (omega_nom * ln.r_ohm) for ln in net.lines)
        r_tau = Indicator(t_max / tau_p, True, None)
        kappa = (
            Indicator(t_max * abs(eig_dom), True, None)
            if eig_dom is not None
            else Indicator(None, False, "no dominant eigenvalue")
        )
    r_in = (
        Indicator(tau_in_s / tau_pq, True, None)
        if tau_in_s is not None
        else Indicator(None, False, "tau_in not given")
    )
    return Indicators(r_tau, kappa, r_in, Indicator(eps_x, True, None))


def solve_m4a(
    net: Network,
    limits: Limits,
    omega_nom_rad_s: float,
    cfg: SolverConfig | None = None,
    tau_in_s: float | None = None,
    damping_threshold_ratio: float | None = None,
    m1: M1Result | None = None,
) -> M4aResult:
    cfg = cfg or SolverConfig()
    if not one_inverter_per_bus(net):
        return M4aResult(Status.INPUT_INVALID, Code.MULTIPLE_INVERTERS_ON_BUS)
    res = m1 or solve_m1(net, cfg)
    if res.status is not Status.FEASIBLE:
        raise ValueError("M4a needs a FEASIBLE M1 point")
    dae = Dae(net, relative=True)
    x0, y0 = dae.initial(res)
    nx = x0.size
    tol = cfg.mismatch_tolerance_w
    _, p_inv, q_inv = dae.injections(x0, y0)
    _, pf, qf = dae.split(x0)
    residual = np.concatenate((dae.g(x0, y0), p_inv - pf, q_inv - qf))
    if residual.size and not np.max(np.abs(residual)) <= tol:
        return _failed(Code.EQUILIBRIUM_INVALID)

    def fz(z: Vector) -> Vector:
        return dae.f(z[:nx], z[nx:])

    def gz(z: Vector) -> Vector:
        return dae.g(z[:nx], z[nx:])

    z0 = np.concatenate((x0, y0))
    Jf = fd_jacobian(fz, z0)
    A = Jf[:, :nx]
    if y0.size:
        Jg = fd_jacobian(gz, z0)
        gy = Jg[:, nx:]
        if not np.all(np.isfinite(gy)) or np.linalg.cond(gy) > MAX_COND:
            return _failed(Code.ILL_CONDITIONED_JACOBIAN)
        A = A - Jf[:, nx:] @ np.linalg.solve(gy, Jg[:, :nx])  # (4.20)
    if not np.all(np.isfinite(A)):
        return _failed(Code.NON_FINITE)
    try:
        eig, phi = np.linalg.eig(A)
    except np.linalg.LinAlgError:
        return _failed(Code.EIGEN_SOLVER_FAILED)

    modes = []
    for k, lam in enumerate(eig):
        mag = abs(lam)
        zeta = -lam.real / mag if mag > 0.0 else None
        modes.append(
            Mode(k, None if zeta is None else float(zeta), float(abs(lam.imag) / (2 * np.pi)))
        )
    t_lam = 1e-9 * float(np.max(np.abs(eig)))
    osc = [m.damping_ratio for m in modes if abs(eig[m.index].imag) > t_lam]
    zeta_min = min((z for z in osc if z is not None), default=None)

    names = [f"delta/{i.id}" for i in net.inverters[1:]]
    names += [f"p_f/{i.id}" for i in net.inverters] + [f"q_f/{i.id}" for i in net.inverters]
    owner = [i.id for i in net.inverters[1:]] + [i.id for i in net.inverters] * 2
    participation, why = None, None
    if np.linalg.cond(phi) <= MAX_COND:
        psi = np.linalg.inv(phi)
        p = np.abs(phi * psi.T)  # p[k, i] = |φ_ki ψ_ik| (4.21)
        p = p / p.sum(axis=0)
        participation = tuple(tuple(float(v) for v in p[:, i]) for i in range(eig.size))
    else:
        why = "eigenvector matrix ill-conditioned"

    # K62: largest real part; of a conjugate pair keep Im ≥ 0; ties by index
    dom = max(range(eig.size), key=lambda k: (eig[k].real, eig[k].imag >= 0, -k))
    elements: tuple[str, ...] = ()
    if participation is not None:
        elements = (owner[int(np.argmax(participation[dom]))],)
    dominant = (DominantMode(dom, modes[dom].damping_ratio, modes[dom].frequency_hz, elements),)

    d = m1_details(net, res, omega_nom_rad_s)
    cons, _ = check(net, res, d, limits)
    return M4aResult(
        status=Status.FEASIBLE,
        code=Code.OK,
        eigenvalues=tuple(complex(v) for v in eig),
        modes=tuple(modes),
        zeta_min=zeta_min,
        dominant=dominant,
        state_names=tuple(names),
        participation=participation,
        participation_reason=why,
        stability_class=stability_class(eig),
        indicators=_indicators(
            net, complex(eig[dom]), d.epsilon_x_ratio, omega_nom_rad_s, tau_in_s
        ),
        outside_definition=any(c.violated for c in cons),
        damping_pass=(
            None
            if damping_threshold_ratio is None or zeta_min is None
            else zeta_min >= damping_threshold_ratio
        ),
    )
