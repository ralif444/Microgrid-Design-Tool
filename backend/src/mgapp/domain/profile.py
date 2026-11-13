"""Load scale per clock hour from the LoadProfile (Doc 12 Eq. 12.9; D-113 K335, K336).

Shared by the M3b axis kind LOAD_PROFILE_HOUR in both adapters and by the battery service (B3).
"""

from __future__ import annotations

from mgapp.domain.contract import Warning
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import WarningCode

HOUR_AXIS = "LOAD_PROFILE_HOUR"


def has_daily_profile(s: ProjectSnapshot) -> bool:
    values = (s.load_profile.values or []) if s.load_profile else []
    return len(values) == 24 and sorted(v.hour for v in values if v.hour is not None) == list(
        range(24)
    )


def table_total_kw(s: ProjectSnapshot) -> float:
    return sum(ld.p_kw or 0.0 for ld in s.loads or [])


def profile_lambdas(s: ProjectSnapshot) -> list[float] | None:
    """λ_h = P_h / Σ P_k^0 for h = 0 … 23, or None without a daily profile or table power."""
    total = table_total_kw(s)
    if not has_daily_profile(s) or total <= 0:
        return None
    assert s.load_profile is not None and s.load_profile.values is not None
    by_hour = {v.hour: v.p_kw or 0.0 for v in s.load_profile.values}
    return [by_hour[h] / total for h in range(24)]


def hour_peak_warning(s: ProjectSnapshot) -> Warning | None:
    """PROFILE_PEAK_ABOVE_LOADS for an M3b hour sweep when some λ_h > 1 (FR-79)."""
    lam = profile_lambdas(s) or []
    over = [h for h, x in enumerate(lam) if x > 1]
    if not over:
        return None
    return Warning(
        code=WarningCode.PROFILE_PEAK_ABOVE_LOADS,
        message=f"The LoadProfile is above the sum of the Load table at hour(s) "
        f"{', '.join(map(str, over))}; those hours scale every Load above its table value "
        "(Eq. 12.9).",
        path="payload.points",
    )
