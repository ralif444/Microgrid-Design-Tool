"""PS: saran kapasitas awal from load data alone (manuscript 4.2.2, (4.2)–(4.4), (4.13)).

VA, W and Wh throughout (Doc 9 D-51 K46, K47); the adapter converts to kVA and kWh and writes
the basis and assumption texts. Parameter ranges are checked by the app (K48).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import StrEnum

from mgengine.types import Load

UNIT_STEP_VA = 100.0  # (4.3): rounding up to multiples of 0.1 kVA
_ROUND_TOL = 1e-9  # K47: an exact multiple must not move up one step by float error


class StorageStage(StrEnum):
    AC = "AC"
    DC = "DC"
    NOMINAL = "NOMINAL"


@dataclass(frozen=True)
class StorageEnergy:
    e_ac_wh: float
    e_dc_wh: float | None
    e_nom_wh: float | None
    stage: StorageStage  # furthest stage whose parameters exist


@dataclass(frozen=True)
class PsResult:
    load_apparent_va: float
    required_inverter_va: float
    unit_count: int
    redundancy: int
    unit_rating_va: float
    installed_va: float
    storage: StorageEnergy | None  # None without profile or autonomy_h
    profile_peak_w: float | None
    profile_peak_above_loads: bool


def storage_energy(e_ac_wh: float, eta_dc: float | None, dod: float | None) -> StorageEnergy:
    """(4.13): E_dc = E_ac/η_dc, E_nom = E_dc/DoD, as far as the parameters exist."""
    if eta_dc is None:
        return StorageEnergy(e_ac_wh, None, None, StorageStage.AC)
    e_dc = e_ac_wh / eta_dc
    if dod is None:
        return StorageEnergy(e_ac_wh, e_dc, None, StorageStage.DC)
    return StorageEnergy(e_ac_wh, e_dc, e_dc / dod, StorageStage.NOMINAL)


def worst_window_wh(profile_w: tuple[float, ...], autonomy_h: int) -> float:
    """(4.4): largest energy over autonomy_h consecutive hours, wrapping past midnight."""
    n = len(profile_w)
    return max(sum(profile_w[(h0 + k) % n] for k in range(autonomy_h)) for h0 in range(n))


def ps(
    loads: tuple[Load, ...],
    inverter_margin_ratio: float,
    unit_count: int,
    redundancy: int,
    profile_w: tuple[float, ...] | None = None,
    autonomy_h: int | None = None,
    dc_efficiency_ratio: float | None = None,
    depth_of_discharge_ratio: float | None = None,
) -> PsResult:
    s_load = abs(sum(complex(ld.p_w, ld.q_var) for ld in loads))  # (4.2), vector sum
    s_req = s_load * (1.0 + inverter_margin_ratio)
    steps = s_req / (UNIT_STEP_VA * (unit_count - redundancy))
    s_unit = UNIT_STEP_VA * math.ceil(steps - _ROUND_TOL)  # (4.3)
    storage = None
    if profile_w is not None and autonomy_h is not None:
        storage = storage_energy(
            worst_window_wh(profile_w, autonomy_h), dc_efficiency_ratio, depth_of_discharge_ratio
        )
    peak = max(profile_w) if profile_w is not None else None
    return PsResult(
        load_apparent_va=s_load,
        required_inverter_va=s_req,
        unit_count=unit_count,
        redundancy=redundancy,
        unit_rating_va=s_unit,
        installed_va=unit_count * s_unit,
        storage=storage,
        profile_peak_w=peak,
        profile_peak_above_loads=peak is not None and peak > sum(ld.p_w for ld in loads),
    )
