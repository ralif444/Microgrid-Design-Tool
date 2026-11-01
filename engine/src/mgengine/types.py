"""Engine data types in SI units per phase (manuscript 4.2.1(d); Doc 9 D-49 K28).

V is the phase RMS voltage (V); P and Q are three-phase totals (W, VAR), matching the factor 3
in (4.7); R and X are per-phase line totals (Ω); ω is the angular frequency (rad/s). Status
and code strings match the app contract (Doc 3 §5.4) so the Real Engine adapter maps them 1:1.
Input checks (negative values, topology, empty data) belong to the app's data-contract layer
(manuscript 3.6); the engine only guards against non-finite numbers.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


@dataclass(frozen=True)
class Line:
    id: str
    from_bus: str
    to_bus: str
    r_ohm: float
    x_ohm: float


@dataclass(frozen=True)
class Load:
    bus: str
    p_w: float
    q_var: float


@dataclass(frozen=True)
class Inverter:
    """Grid-forming droop inverter, droop law (2.1) / injection form (4.5)."""

    id: str
    bus: str
    m_p_rad_s_per_w: float
    n_q_v_per_var: float
    omega_set_rad_s: float
    v_set_v: float
    rated_va: float  # three-phase apparent power rating (D-50 K35)
    p_set_w: float = 0.0
    q_set_var: float = 0.0


@dataclass(frozen=True)
class Network:
    buses: tuple[str, ...]  # the first bus is the angle reference (D-49 K29)
    lines: tuple[Line, ...]
    loads: tuple[Load, ...]
    inverters: tuple[Inverter, ...]


@dataclass(frozen=True)
class SolverConfig:
    """Manuscript 4.2.3: |F_P| < 1e-3 W and |F_Q| < 1e-3 VAR; 50 iterations by default."""

    mismatch_tolerance_w: float = 1e-3  # applies to W and VAR rows
    max_iterations: int = 50
    max_condition_number: float = 1e12


class Status(StrEnum):
    FEASIBLE = "FEASIBLE"
    SOLVER_FAILED = "SOLVER_FAILED"
    PHYSICALLY_INADMISSIBLE = "PHYSICALLY_INADMISSIBLE"


class Code(StrEnum):
    OK = "OK"
    MAX_ITERATIONS_REACHED = "MAX_ITERATIONS_REACHED"
    ILL_CONDITIONED_JACOBIAN = "ILL_CONDITIONED_JACOBIAN"
    NON_FINITE = "NON_FINITE"
    OPERATING_POINT_NOT_PHYSICAL = "OPERATING_POINT_NOT_PHYSICAL"
    CONSTRAINT_VIOLATED = "CONSTRAINT_VIOLATED"


@dataclass(frozen=True)
class M1Result:
    status: Status
    code: Code
    iterations: int
    # Operating point; present for FEASIBLE and PHYSICALLY_INADMISSIBLE, None for SOLVER_FAILED.
    v_v: tuple[float, ...] | None
    theta_rad: tuple[float, ...] | None
    omega_rad_s: float | None
    max_mismatch: float  # largest |F| entry at the last evaluated point (W or VAR)
