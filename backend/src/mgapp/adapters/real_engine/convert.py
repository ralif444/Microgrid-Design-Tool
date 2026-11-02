"""Contract units → engine SI per phase, and back (Doc 3 §1; Doc 9 D-51 K40, K43, D-54).

The only place the √3 and 2π factors appear (Engine Port rule 7).
"""

from __future__ import annotations

import math

from mgengine.m2 import Kind, Limits
from mgengine.types import Inverter, Line, Load, Network, SolverConfig

from mgapp.domain import contract
from mgapp.domain.entities import Load as LoadEntity
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import PfDirection

SQRT3 = math.sqrt(3.0)
TWO_PI = 2.0 * math.pi


def num(x: float | None) -> float:
    if x is None:
        raise ValueError("value missing after stage-1 validation")
    return x


def v_phase(kv_ll: float | None) -> float:
    """kV line-to-line → V phase."""
    return num(kv_ll) * 1e3 / SQRT3


def load_q_kvar(ld: LoadEntity) -> float:
    """q_kvar as entered, else P·tan(acos pf), negative for LEADING (D-54 K83)."""
    if ld.q_kvar is not None:
        return ld.q_kvar
    q = num(ld.p_kw) * math.tan(math.acos(num(ld.power_factor)))
    return -q if ld.pf_direction is PfDirection.LEADING else q


def network(s: ProjectSnapshot) -> Network:
    """Snapshot → Network; the first bus is the angle reference (D-49 K29)."""
    return Network(
        buses=tuple(str(b.id) for b in s.buses),
        lines=tuple(
            Line(
                str(ln.id),
                str(ln.from_bus_id),
                str(ln.to_bus_id),
                num(ln.r_ohm_per_km) * num(ln.length_km),  # Doc 3 §3.3
                num(ln.x_ohm_per_km) * num(ln.length_km),
            )
            for ln in s.lines
        ),
        loads=tuple(
            Load(str(ld.bus_id), num(ld.p_kw) * 1e3, load_q_kvar(ld) * 1e3, str(ld.id))
            for ld in s.loads
        ),
        inverters=tuple(
            Inverter(
                str(i.id),
                str(i.bus_id),
                m_p_rad_s_per_w=TWO_PI * 1e-3 * num(i.frequency_droop_hz_per_kw),
                n_q_v_per_var=num(i.voltage_droop_kv_per_kvar) / SQRT3,  # D-54 K74
                omega_set_rad_s=TWO_PI * num(i.frequency_setpoint_hz),
                v_set_v=v_phase(i.voltage_setpoint_kv),
                rated_va=num(i.rated_kva) * 1e3,
                p_set_w=(i.p_setpoint_kw or 0.0) * 1e3,
                q_set_var=(i.q_setpoint_kvar or 0.0) * 1e3,
                tau_p_s=i.tau_p_s,
                tau_q_s=i.tau_q_s,
            )
            for i in s.inverters
        ),
    )


def omega_nom(s: ProjectSnapshot) -> float:
    return TWO_PI * num(s.nominal_frequency_hz)


def solver(cfg: contract.SolverConfig) -> SolverConfig:
    return SolverConfig(
        mismatch_tolerance_w=cfg.mismatch_tolerance_w, max_iterations=cfg.max_iterations
    )


def _times(x: float | None, k: float) -> float | None:
    return None if x is None else x * k


def limits(s: ProjectSnapshot) -> Limits:
    """DesignConstraints → SI limits; per-line current limit resolved here (D-51 K43)."""
    c, vb = s.design_constraints, v_phase(s.nominal_voltage_kv)
    return Limits(
        v_min_v=_times(c.voltage_min_pu, vb),
        v_max_v=_times(c.voltage_max_pu, vb),
        omega_min_rad_s=_times(c.frequency_min_hz, TWO_PI),
        omega_max_rad_s=_times(c.frequency_max_hz, TWO_PI),
        loading_max_ratio=c.inverter_loading_limit_ratio,
        line_current_max_a=tuple(
            ln.current_limit_a if ln.current_limit_a is not None else c.line_current_limit_a
            for ln in s.lines
        ),
        balance_tolerance_w=_times(c.balance_tolerance_kw, 1e3),
    )


def to_contract(kind: Kind, s: ProjectSnapshot) -> float:
    """Factor from engine SI to the LimitingConstraint unit (Doc 3 §5.3)."""
    if kind in (Kind.BUS_VOLTAGE_MIN, Kind.BUS_VOLTAGE_MAX):
        return 1.0 / v_phase(s.nominal_voltage_kv)  # V → p.u.
    if kind in (Kind.FREQUENCY_MIN, Kind.FREQUENCY_MAX):
        return 1.0 / TWO_PI  # rad/s → Hz
    if kind is Kind.POWER_BALANCE:
        return 1e-3  # W → kW
    return 1.0  # ratio, A
