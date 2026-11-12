"""B3 discharge autonomy per bank (Doc 12 Eq. 12.9, 12.14 – 12.18, FR-117, FR-118; guideline §3.3).

`hour_walk` sends one M1 per hour through the given `run_m1` (the execution guard, ADR-015) on the
base snapshot with loads scaled by Eq. (12.9); `autonomy` is pure algebra over the powers it got.
SoC is a post-processed sum: it never feeds back into an M1 run, so no state enters the model.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from mgapp.domain.battery import BatteryBank
from mgapp.domain.contract import EngineIdentity
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import Status, StatusCode
from mgapp.domain.profile import has_daily_profile, profile_lambdas
from mgapp.services.guard import GuardedOutcome

NO_PROFILE = "no daily load profile"


def lambdas(s: ProjectSnapshot) -> tuple[list[float] | None, str | None]:
    """Eq. (12.9) per clock hour 0 – 23, or None with the reason."""
    if not has_daily_profile(s):
        return None, NO_PROFILE
    lam = profile_lambdas(s)
    return (lam, None) if lam is not None else (None, "the Load table has no active power to scale")


def scaled(s: ProjectSnapshot, lam: float) -> ProjectSnapshot:
    """Base snapshot with every Load's P and Q times λ (Eq. 12.9); a power factor stays as is."""
    loads = [
        ld.model_copy(
            update={
                "p_kw": None if ld.p_kw is None else lam * ld.p_kw,
                "q_kvar": None if ld.q_kvar is None else lam * ld.q_kvar,
            }
        )
        for ld in s.loads or []
    ]
    return s.model_copy(update={"loads": loads})


@dataclass
class Walk:
    hours: list[dict[str, Any]] = field(default_factory=list)
    powers: list[dict[str, float]] = field(default_factory=list)  # per FEASIBLE step
    failed: dict[str, Any] | None = None  # the first hour that is not FEASIBLE
    timed_out: bool = False
    identity: EngineIdentity | None = None
    calls: int = 0


def hour_walk(
    s: ProjectSnapshot,
    lam: list[float],
    start_hour: int,
    run_m1: Callable[[ProjectSnapshot], GuardedOutcome],
    budget_s: float,
) -> Walk:
    """24 M1 calls in start-hour order; stop at the first non-FEASIBLE hour (ADR-015 §4).

    One overall budget, checked between calls (ADR-015 Q2); a call's own TIMEOUT also ends the
    request (D-110 K324).
    """
    w = Walk()
    t0 = time.monotonic()
    for j in range(24):
        if time.monotonic() - t0 > budget_s:
            w.timed_out = True
            return w
        h = (start_hour + j) % 24
        out = run_m1(scaled(s, lam[h]))
        w.calls += 1
        w.identity = w.identity or out.identity
        r = out.result
        if r.status_code == StatusCode.TIMEOUT.value:
            w.timed_out = True
            return w
        pay = r.payload or {}
        w.hours.append(
            {
                "clock_hour": h,
                "lambda": lam[h],
                "m1_status": r.status,
                "m1_status_code": r.status_code,
                "system_frequency_hz": pay.get("system_frequency_hz"),
            }
        )
        if r.status != Status.FEASIBLE:
            w.failed = {"step": j, "clock_hour": h, "status_code": r.status_code}
            return w
        w.powers.append({x["inverter_id"]: x["p_kw"] for x in pay.get("inverter_results", [])})
    return w


def autonomy(
    b: BatteryBank,
    start_hour: int,
    powers: list[dict[str, float]],
    failed: dict[str, Any] | None,
    reason_all: str | None,
) -> dict[str, Any]:
    eta, dod, soc0 = b.dc_efficiency_ratio, b.depth_of_discharge_ratio, b.initial_soc_ratio
    e_mod = b.module.energy_kwh
    e_bank = None if e_mod is None else b.series_count * b.parallel_count * e_mod  # Eq. 12.14
    out: dict[str, Any] = {
        "outcome": "NOT_EVALUATED",
        "reason": None,
        "usable_energy_kwh": None,
        "start_hour": start_hour,
        "autonomy_h": None,
        "depletion_clock_hour": None,
        "end_soc_ratio": None,
        "curve": [],
    }
    missing = [
        n
        for n, v in (
            ("DC efficiency", eta),
            ("depth of discharge", dod),
            ("initial state of charge", soc0),
        )
        if v is None
    ]
    if missing:
        out["reason"] = f"{', '.join(missing)} not set"
        return out
    assert eta is not None and dod is not None and soc0 is not None and e_bank is not None
    if soc0 - (1 - dod) <= 1e-9:  # slack: 1 - 0.8 is 0.19999999999999996 (D-110 K325)
        out["reason"] = "initial state of charge is at or below the discharge limit"
        return out
    e_use = eta * e_bank * (soc0 - (1 - dod))  # Eq. 12.15
    out["usable_energy_kwh"] = e_use
    if reason_all is not None:
        out["reason"] = reason_all
        return out
    cum = 0.0
    curve: list[dict[str, Any]] = []
    for j, step in enumerate(powers):
        h = (start_hour + j) % 24
        p = step.get(b.inverter_id)
        if p is None:
            return out | {"reason": f"no M1 power for this inverter at clock hour {h}"}
        if p < 0:  # guideline §3.3; hours after depletion are not used (D-110 K325)
            return out | {
                "reason": f"inverter absorbs power at clock hour {h}; charging is not modelled"
            }
        prev, cum = cum, cum + p  # Eq. 12.16, Δt = 1 h
        curve.append(
            {
                "step": j,
                "clock_hour": h,
                "inverter_p_kw": p,
                "cumulative_energy_kwh": cum,
                "soc_ratio": soc0 - cum / (eta * e_bank),  # Eq. 12.17
            }
        )
        if cum > e_use:  # Eq. 12.18
            return out | {
                "outcome": "DEPLETED",
                "autonomy_h": j + (e_use - prev) / p,
                "depletion_clock_hour": h,
                "curve": curve,
            }
    if failed is not None:  # a bank depleted before the failed hour returned above (D-110 K324)
        return out | {
            "reason": f"M1 at clock hour {failed['clock_hour']} gave {failed['status_code']}",
            "curve": curve,
        }
    return out | {
        "outcome": "NOT_DEPLETED",
        "end_soc_ratio": curve[-1]["soc_ratio"],
        "curve": curve,
    }
