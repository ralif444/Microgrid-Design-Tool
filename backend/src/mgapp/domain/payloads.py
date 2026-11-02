"""Result payload schemas per analysis_type (Doc 3 §6). Equation numbers: manuscript.

Used by the contract suite to check behaviour C5 (payload fields match Doc 3 §6).
"""

from __future__ import annotations

from enum import StrEnum

from mgapp.domain.base import Model
from mgapp.domain.contract import LimitingConstraint
from mgapp.domain.enums import AnalysisType, ConstraintKind, Status


class Basis(Model):
    basis: str
    assumptions: list[str]


# ------------------------------------------------------------------ PS (§6.1)
class RequiredInverter(Basis):
    value_kva: float


class InverterPlan(Basis):
    unit_count: int
    redundancy: int
    unit_rating_kva: float
    installed_kva: float


class StorageStage(StrEnum):
    AC = "AC"
    DC = "DC"
    NOMINAL = "NOMINAL"


class StorageEnergy(Basis):
    e_ac_kwh: float
    e_dc_kwh: float | None
    e_nom_kwh: float | None
    stage: StorageStage


class PsPayload(Model):
    load_apparent_kva: float
    required_inverter_kva: RequiredInverter
    inverter_plan: InverterPlan
    storage_energy: StorageEnergy | None
    profile_peak_kw: float | None


# ------------------------------------------------------------------ M1 (§6.2)
class BusResult(Model):
    bus_id: str
    voltage_kv: float
    voltage_pu: float
    angle_deg: float


class InverterResult(Model):
    inverter_id: str
    p_kw: float
    q_kvar: float
    s_kva: float
    loading_ratio: float


class LineResult(Model):
    line_id: str
    p_from_kw: float
    q_from_kvar: float
    p_to_kw: float
    q_to_kvar: float
    current_a: float
    losses_kw: float


class M1Payload(Model):
    system_frequency_hz: float
    bus_results: list[BusResult]
    inverter_results: list[InverterResult]
    line_results: list[LineResult]
    total_load_kw: float
    total_load_kvar: float
    total_losses_kw: float
    iterations: int
    epsilon_x_ratio: float


# ------------------------------------------------------------------ M2 (§6.3, §3.9)
class Verdict(StrEnum):
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"


class NotEvaluated(Model):
    kind: ConstraintKind
    element_id: str


class InverterSizing(Model):
    inverter_id: str
    s_kva: float
    required_rating_kva: float
    headroom_kva: float
    rating_margin_short: bool


class LineSizing(Model):
    line_id: str
    current_a: float
    required_current_a: float


class SizingStorage(Model):
    e_ac_kwh: float
    e_dc_kwh: float | None
    e_nom_kwh: float | None
    stage: StorageStage
    basis: str


class SizingCheck(Model):
    per_inverter: list[InverterSizing]
    per_line: list[LineSizing]
    storage: SizingStorage | None
    basis: str
    assumptions: list[str]


class Loadability(Model):
    lambda_c: float | None
    lambda_s: float | None
    lambda_ub: float | None
    resolution: float
    grid_step: float
    stop_reason: str


class M2Payload(Model):
    verdict: Verdict
    constraint_margins: list[LimitingConstraint]
    not_evaluated: list[NotEvaluated]
    sizing_check: SizingCheck
    loadability: Loadability


# ------------------------------------------------------------------ M3 (§6.4-6.7)
class OutputMetric(StrEnum):
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


class Sensitivity(Model):
    parameter_path: str
    metric: OutputMetric
    value: float | None  # None = not reported, see reason (D-55 K87)
    normalised_value: float | None  # None when y0 or p0 is 0 (D-52 K53)
    unit: str
    scheme: Scheme | None
    status_change: bool
    reason: str | None = None


class Ranking(Model):
    metric: OutputMetric
    parameter_path: str
    rank: int


class M3aPayload(Model):
    sensitivities: list[Sensitivity]
    ranking: list[Ranking]


class KeyMetrics(Model):
    system_frequency_hz: float | None
    min_voltage_pu: float | None
    max_loading_ratio: float | None
    total_losses_kw: float | None
    epsilon_x_ratio: float | None
    lambda_c: float | None = None
    zeta_min: float | None = None
    re_lambda_dom_per_s: float | None = None
    r_tau: float | None = None
    kappa: float | None = None


class Eigenvalue(Model):
    real_per_s: float
    imag_per_s: float


class SweepPoint(Model):
    value: float | None = None
    x_value: float | None = None
    y_value: float | None = None
    status: Status
    status_code: str
    limiting_constraint: LimitingConstraint | None
    key_metrics: KeyMetrics
    eigenvalues: list[Eigenvalue] | None = None


class M3bPayload(Model):
    points: list[SweepPoint]
    first_infeasible_value: float | None


class ScenarioResult(Model):
    scenario_id: str
    status: Status
    status_code: str
    key_metrics: KeyMetrics
    limiting_constraints: list[LimitingConstraint]


class Delta(Model):
    metric: OutputMetric
    scenario_id: str
    reference_scenario_id: str
    delta: float
    unit: str
    relative_delta_ratio: float | None = (
        None  # delta / reference; None when reference is 0 (D-52 K55)
    )


class M3cPayload(Model):
    scenario_results: list[ScenarioResult]
    deltas: list[Delta]


class M3dPayload(Model):
    grid: list[SweepPoint]
    feasible_fraction: float


# ------------------------------------------------------------------ M4 (§6.8-6.9)
class Mode(Model):
    eigenvalue_index: int
    damping_ratio: float | None  # None for λ = 0 (Eq. 4.20 undefined, D-55 K87)
    frequency_hz: float


class DominantMode(Mode):
    associated_element_ids: list[str]


class Participation(Model):
    state_names: list[str]
    factors: list[list[float]]


class StabilityClass(StrEnum):
    STABLE = "STABLE"
    MARGINAL = "MARGINAL"
    UNSTABLE = "UNSTABLE"


class Indicator(Model):
    value: float | None
    evaluated: bool
    reason: str | None


class Indicators(Model):
    r_tau: Indicator
    kappa: Indicator
    r_in: Indicator
    epsilon_x: Indicator


class M4aPayload(Model):
    eigenvalues: list[Eigenvalue]
    modes: list[Mode]
    zeta_min: float | None
    dominant_modes: list[DominantMode]
    participation: Participation | None
    stability_class: StabilityClass
    indicators: Indicators
    outside_definition: bool
    damping_pass: bool | None = None  # ζ_min ≥ damping_threshold_ratio (D-53 K65)


class ElementSeries(Model):
    values: list[float]


class BusSeries(ElementSeries):
    bus_id: str


class InverterSeries(ElementSeries):
    inverter_id: str


class TransientClass(StrEnum):
    RECOVERED_STABLE = "RECOVERED_STABLE"
    CRITERIA_VIOLATED = "CRITERIA_VIOLATED"
    UNSTABLE = "UNSTABLE"


class M4bPayload(Model):
    time_s: list[float]
    system_frequency_hz: list[float]
    bus_voltage_kv: list[BusSeries]
    inverter_p_kw: list[InverterSeries]
    inverter_q_kvar: list[InverterSeries]
    max_rocof_hz_per_s: float
    transient_class: TransientClass | None  # None without settling criteria (D-53 K67)
    settled: bool | None
    class_reason: str | None = None


PAYLOAD_MODEL: dict[AnalysisType, type[Model]] = {
    AnalysisType.PS: PsPayload,
    AnalysisType.M1: M1Payload,
    AnalysisType.M2: M2Payload,
    AnalysisType.M3A: M3aPayload,
    AnalysisType.M3B: M3bPayload,
    AnalysisType.M3C: M3cPayload,
    AnalysisType.M3D: M3dPayload,
    AnalysisType.M4A: M4aPayload,
    AnalysisType.M4B: M4bPayload,
}
