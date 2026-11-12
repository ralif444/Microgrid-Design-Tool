"""B2 power adequacy per bank (Doc 12 Eq. 12.6 – 12.8, FR-76, FR-118; guideline §3.2).

P_i is `inverter_results[].p_kw` of the depends_on M1 payload. No default for η_dc (D-59 K105).
"""

from __future__ import annotations

from typing import Any

from mgapp.domain.battery import BatteryBank


def bank_summary(b: BatteryBank) -> dict[str, Any]:
    n = b.series_count * b.parallel_count
    e = b.module.energy_kwh
    return {
        "series_count": b.series_count,
        "parallel_count": b.parallel_count,
        "module_count": n,
        "energy_kwh": None if e is None else n * e,  # Eq. 12.14
    }


def _power(b: BatteryBank, p_kw: float | None) -> dict[str, Any]:
    m, n = b.module, b.series_count * b.parallel_count
    if m.discharge_power_kw is not None:  # Eq. 12.6
        cap, src = n * m.discharge_power_kw, "discharge_power"
    elif m.c_rate_per_h is not None and m.energy_kwh is not None:
        cap, src = m.c_rate_per_h * n * m.energy_kwh, "c_rate"
    else:
        cap, src = None, None
    out: dict[str, Any] = {
        "outcome": "NOT_EVALUATED",
        "reason": None,
        "capability_kw": cap,
        "capability_source": src,
        "inverter_p_kw": p_kw,
        "dc_side_power_kw": None,
        "margin_kw": None,
    }
    eta = b.dc_efficiency_ratio
    if eta is None:
        out["reason"] = "DC efficiency not set"
    elif cap is None:
        out["reason"] = "module has no power capability"
    elif p_kw is None:
        out["reason"] = "no M1 power for this inverter"
    elif p_kw < 0:  # [DESIGN CHOICE] guideline §3.2
        out["reason"] = "inverter absorbs power; charging is not modelled"
    else:
        dc = p_kw / eta  # Eq. 12.7
        margin = cap - dc  # Eq. 12.8
        out |= {"dc_side_power_kw": dc, "margin_kw": margin}
        out["outcome"] = "OK" if margin >= 0 else "SHORT"
    return out


def power_part(banks: list[BatteryBank], m1_payload: dict[str, Any]) -> list[dict[str, Any]]:
    p = {r["inverter_id"]: r["p_kw"] for r in m1_payload.get("inverter_results", [])}
    return [
        {
            "inverter_id": b.inverter_id,
            "bank": bank_summary(b),
            "power": _power(b, p.get(b.inverter_id)),
        }
        for b in banks
    ]
