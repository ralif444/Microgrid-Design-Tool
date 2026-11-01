"""Design entities as carried in `project_snapshot` (Doc 3 §3).

Wire models are lenient on presence (fields may be null or missing) so that stage-1
validation can report *all* rule breaches with Doc 3 §4 codes (FR-20). Wrong JSON types
or unknown fields still fail parsing and become INPUT_INVALID / MALFORMED_REQUEST.
"""

from __future__ import annotations

from mgapp.domain.base import Model
from mgapp.domain.enums import PfDirection


class Bus(Model):
    id: str | None = None
    name: str | None = None  # label; not in the canonical snapshot
    diagram_x: float | None = None  # layout only; not in the canonical snapshot
    diagram_y: float | None = None


class Line(Model):
    id: str | None = None
    from_bus_id: str | None = None
    to_bus_id: str | None = None
    r_ohm_per_km: float | None = None  # Ω/km
    x_ohm_per_km: float | None = None  # Ω/km
    length_km: float | None = None  # km
    current_limit_a: float | None = None  # A; overrides DesignConstraints.line_current_limit_a
    # Server-derived (Doc 3 §3.3); any client value is overwritten during canonicalisation.
    r_ohm: float | None = None  # Ω
    x_ohm: float | None = None  # Ω


class Load(Model):
    id: str | None = None
    bus_id: str | None = None
    p_kw: float | None = None  # kW, three-phase
    q_kvar: float | None = None  # kvar
    power_factor: float | None = None  # 0 < pf <= 1
    pf_direction: PfDirection | None = None


class HourValue(Model):
    hour: int | None = None  # h, 0-23
    p_kw: float | None = None  # kW


class LoadProfile(Model):
    id: str | None = None
    values: list[HourValue] | None = None


class Inverter(Model):
    id: str | None = None
    bus_id: str | None = None
    rated_kva: float | None = None  # kVA
    frequency_droop_hz_per_kw: float | None = None  # Hz/kW
    voltage_droop_kv_per_kvar: float | None = None  # kV/kvar
    frequency_setpoint_hz: float | None = None  # Hz
    voltage_setpoint_kv: float | None = None  # kV line-to-line
    p_setpoint_kw: float | None = None  # kW; absent = 0
    q_setpoint_kvar: float | None = None  # kvar; absent = 0
    tau_p_s: float | None = None  # s; required for M4a/M4b, no default
    tau_q_s: float | None = None  # s; required for M4a/M4b, no default


class DesignConstraints(Model):
    """No numeric defaults; an empty limit makes its check "not evaluated" (Doc 3 §3.7)."""

    voltage_min_pu: float | None = None
    voltage_max_pu: float | None = None
    frequency_min_hz: float | None = None
    frequency_max_hz: float | None = None
    inverter_loading_limit_ratio: float | None = None
    line_current_limit_a: float | None = None
    balance_tolerance_kw: float | None = None


class ProjectSnapshot(Model):
    """Design data sent with every analysis request (Doc 3 §7 canonical snapshot content)."""

    nominal_voltage_kv: float | None = None  # kV line-to-line
    nominal_frequency_hz: float | None = None  # Hz
    buses: list[Bus] = []
    lines: list[Line] = []
    loads: list[Load] = []
    load_profile: LoadProfile | None = None
    inverters: list[Inverter] = []
    design_constraints: DesignConstraints = DesignConstraints()
