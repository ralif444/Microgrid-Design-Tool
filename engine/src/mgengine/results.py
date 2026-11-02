"""M1 detailed results from a solved operating point (FR-23, Tabel 4.6; Doc 9 D-50).

Line flows and currents per D-50 K34, inverter outputs from the droop law (4.5), ε_X from (4.1),
power-sharing deviations from the same outputs (Doc 12 Eq. 12.10-12.13, derived output, no new
model equation; Doc 9 D-63).
SI units per phase like the solver; conversion to app units is the adapter's job (K37).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from mgengine.types import M1Result, Network


@dataclass(frozen=True)
class LineFlow:
    line_id: str
    p_from_w: float
    q_from_var: float
    p_to_w: float
    q_to_var: float
    current_a: float  # phase RMS
    losses_w: float


@dataclass(frozen=True)
class InverterOutput:
    inverter_id: str
    p_w: float
    q_var: float
    s_va: float
    loading_ratio: float  # S / rated_va


@dataclass(frozen=True)
class Sharing:
    inverter_id: str
    dp_w: float  # P_i - P_i^ideal (12.11)
    dq_var: float  # Q_i - Q_i^ideal (12.10)
    e_p_ratio: float  # |ΔP_i| / S_r,i (12.12)
    e_q_ratio: float  # |ΔQ_i| / S_r,i (12.12)
    q_droop_not_rating_proportional: bool  # (12.13)


# Numerical-equality tolerance of (12.13), not an engineering threshold (Doc 12 §3.8).
SHARING_FLAG_TOLERANCE = 1e-6


@dataclass(frozen=True)
class M1Details:
    lines: tuple[LineFlow, ...]
    inverters: tuple[InverterOutput, ...]
    total_load_w: float
    total_load_var: float
    total_losses_w: float
    epsilon_x_ratio: float
    sharing: tuple[Sharing, ...]
    e_q_max_ratio: float  # max_i e_Q,i (12.12)


def sharing(net: Network, outputs: tuple[InverterOutput, ...]) -> tuple[Sharing, ...]:
    """Doc 12 (12.10)-(12.13) over all inverters; with one inverter every deviation is 0."""
    s_tot = sum(inv.rated_va for inv in net.inverters)
    p_tot = sum(o.p_w for o in outputs)
    q_tot = sum(o.q_var for o in outputs)
    nqs = [inv.n_q_v_per_var * inv.rated_va for inv in net.inverters]
    nqs_mean = sum(nqs) / len(nqs)
    out = []
    for inv, o, nq_s in zip(net.inverters, outputs, nqs, strict=True):
        share = inv.rated_va / s_tot
        dp = o.p_w - share * p_tot
        dq = o.q_var - share * q_tot
        flag = abs(nq_s - nqs_mean) / nqs_mean > SHARING_FLAG_TOLERANCE
        out.append(Sharing(inv.id, dp, dq, abs(dp) / inv.rated_va, abs(dq) / inv.rated_va, flag))
    return tuple(out)


def m1_details(net: Network, res: M1Result, omega_nom_rad_s: float) -> M1Details:
    """Needs an operating point (FEASIBLE or PHYSICALLY_INADMISSIBLE, D-50 K33)."""
    if res.v_v is None or res.theta_rad is None or res.omega_rad_s is None:
        raise ValueError(f"no operating point for status {res.status}")
    omega = res.omega_rad_s
    index = {b: i for i, b in enumerate(net.buses)}
    phasor = [
        v * complex(math.cos(t), math.sin(t)) for v, t in zip(res.v_v, res.theta_rad, strict=True)
    ]

    lines = []
    for ln in net.lines:
        vi, vk = phasor[index[ln.from_bus]], phasor[index[ln.to_bus]]
        current = (vi - vk) / complex(ln.r_ohm, ln.x_ohm)
        s_from = 3 * vi * current.conjugate()
        s_to = 3 * vk * (-current).conjugate()
        lines.append(
            LineFlow(
                ln.id,
                s_from.real,
                s_from.imag,
                s_to.real,
                s_to.imag,
                abs(current),
                s_from.real + s_to.real,
            )
        )

    inverters = []
    for inv in net.inverters:
        p = inv.p_set_w + (inv.omega_set_rad_s - omega) / inv.m_p_rad_s_per_w
        q = inv.q_set_var + (inv.v_set_v - res.v_v[index[inv.bus]]) / inv.n_q_v_per_var
        s = math.hypot(p, q)
        inverters.append(InverterOutput(inv.id, p, q, s, s / inv.rated_va))

    shares = sharing(net, tuple(inverters))
    return M1Details(
        lines=tuple(lines),
        inverters=tuple(inverters),
        total_load_w=sum(ld.p_w for ld in net.loads),
        total_load_var=sum(ld.q_var for ld in net.loads),
        total_losses_w=sum(lf.losses_w for lf in lines),
        epsilon_x_ratio=abs(omega - omega_nom_rad_s) / omega_nom_rad_s,
        sharing=shares,
        e_q_max_ratio=max(sh.e_q_ratio for sh in shares),
    )
