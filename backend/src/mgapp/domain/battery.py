"""BatteryBank (Doc 12 FR-75; D-106 K304, K306; D-108).

Design data for the battery advice only: stored in the Project-file field `battery_banks`,
outside the canonical snapshot, never sent to the engine (A2). Shapes only here; the ranges are
stage-1 rules (`services/battery/banks.py`), so a wrong value is reported, not refused.
"""

from __future__ import annotations

from mgapp.domain.base import Model
from mgapp.domain.catalog import CatalogRef


class BankModule(Model):
    """Values copied from a BATTERY_MODULE entry with its catalog_ref (FR-69 pattern)."""

    catalog_ref: CatalogRef
    energy_kwh: float | None = None
    voltage_min_v: float | None = None
    voltage_max_v: float | None = None
    discharge_power_kw: float | None = None
    c_rate_per_h: float | None = None


class BatteryBank(Model):
    inverter_id: str
    module: BankModule
    series_count: int
    parallel_count: int
    dc_efficiency_ratio: float | None = None  # empty → not evaluated, no default (FR-118)
    depth_of_discharge_ratio: float | None = None
    initial_soc_ratio: float | None = None
