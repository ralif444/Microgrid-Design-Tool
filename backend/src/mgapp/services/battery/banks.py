"""Stage-1 rules for BatteryBank (Doc 12 FR-75, FR-118; D-108): one issue per broken field,
code BATTERY_BANK_INVALID with the field path `battery_banks[i].<field>`."""

from __future__ import annotations

from collections.abc import Iterable

from mgapp.domain.battery import BatteryBank
from mgapp.domain.contract import ValidationIssue
from mgapp.domain.enums import IssueCode, IssueLevel

RATIOS = ("dc_efficiency_ratio", "depth_of_discharge_ratio", "initial_soc_ratio")


def bank_issues(
    banks: list[BatteryBank], inverter_ids: Iterable[str | None], prefix: str = "battery_banks"
) -> list[ValidationIssue]:
    known = set(inverter_ids)
    seen: set[str] = set()
    out: list[ValidationIssue] = []

    def add(i: int, b: BatteryBank, field: str, message: str) -> None:
        out.append(
            ValidationIssue(
                code=IssueCode.BATTERY_BANK_INVALID,
                level=IssueLevel.ENTITY,
                entity="BatteryBank",
                id=b.inverter_id,
                field=f"{prefix}[{i}].{field}",
                message=message,
            )
        )

    for i, b in enumerate(banks):
        if b.inverter_id not in known:
            add(i, b, "inverter_id", f"No inverter {b.inverter_id} in the design.")
        elif b.inverter_id in seen:
            add(i, b, "inverter_id", f"{b.inverter_id} already has a battery bank.")
        seen.add(b.inverter_id)
        for f in ("series_count", "parallel_count"):
            if getattr(b, f) < 1:
                add(i, b, f, "Enter a whole number of at least 1.")
        for f in RATIOS:
            v = getattr(b, f)
            if v is not None and not 0 < v <= 1:
                add(i, b, f, "Enter a ratio above 0 and at most 1, or leave it empty.")
        if b.module.energy_kwh is None or b.module.energy_kwh <= 0:
            add(i, b, "module.energy_kwh", "The module needs an energy above 0 kWh.")
        for f in ("discharge_power_kw", "c_rate_per_h"):
            v = getattr(b.module, f)
            if v is not None and v <= 0:
                add(i, b, f"module.{f}", "Enter a value above 0, or leave it empty.")
    return out
