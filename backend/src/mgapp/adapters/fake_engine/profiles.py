"""Named Fake Engine fixture profiles for E2E runs (Doc 8 §5), selected at startup by
MGAPP_FAKE_PROFILE. Never selectable per request.
"""

from __future__ import annotations

from mgapp.adapters.fake_engine.engine import Outcome, ScriptEntry
from mgapp.domain.enums import AnalysisType

# Placeholder indicator values (not engineering values) so the panel E2E sees three evaluated
# indicators and one not evaluated with a reason (Doc 12 FR-61).
_INDICATORS = {
    "r_tau": {"value": 0.11, "evaluated": True, "reason": None},
    "kappa": {"value": 0.22, "evaluated": True, "reason": None},
    "r_in": {"value": None, "evaluated": False, "reason": "tau_in_s not given"},
    "epsilon_x": {"value": 0.44, "evaluated": True, "reason": None},
}


# Placeholder margins (not engineering values): one below MARGIN_WARN, one above, for the
# FR-26 "Near limit" E2E.
def _margin(element: str, value: float, normalised: float) -> dict[str, object]:
    return {
        "kind": "BUS_VOLTAGE_MIN",
        "element_id": element,
        "value": value,
        "limit": 0.9,
        "unit": "pu",
        "margin": round(value - 0.9, 6),
        "normalised_margin": normalised,
    }


_MARGINS = [_margin("B1", 0.92, 0.02), _margin("B2", 1.0, 0.1)]


# Placeholder 24-hour sweep (not engineering values) for the FR-79 E2E (D-113 K337): the worst
# FEASIBLE hours are 19 (frequency, voltage), 20 (loading) and 21 (losses); hour 22 is the first
# that is not FEASIBLE and carries the most extreme values, which must not count as worst.
def _hour(h: int) -> dict[str, object]:
    peak = {19: 3, 20: 2, 21: 1}.get(h, 0)
    bad = h == 22
    return {
        "value": h,
        "status": "SOLVER_FAILED" if bad else "FEASIBLE",
        "status_code": "NO_CONVERGENCE" if bad else "OK",
        "limiting_constraint": None,
        "key_metrics": {
            "system_frequency_hz": 49.0 if bad else 50.0 - 0.01 * (h % 6) - 0.1 * (h == 19),
            "min_voltage_pu": 0.5 if bad else 0.99 - 0.01 * peak,
            "max_loading_ratio": 2.0 if bad else 0.5 + 0.1 * (h == 20),
            "total_losses_kw": 9.0 if bad else 0.1 + 0.05 * (h == 21),
            "epsilon_x_ratio": None,
        },
    }


_HOURS = {"points": [_hour(h) for h in range(24)], "first_infeasible_value": 22}

PROFILES: dict[str, dict[AnalysisType, ScriptEntry]] = {
    "default": {},
    "m1-solver-failed": {AnalysisType.M1: ScriptEntry(Outcome.SOLVER_FAILED)},
    "m1-inadmissible": {AnalysisType.M1: ScriptEntry(Outcome.PHYSICALLY_INADMISSIBLE)},
    "m2-infeasible": {AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)},
    "m4a-indicators": {AnalysisType.M4A: ScriptEntry(payload_patch={"indicators": _INDICATORS})},
    "m2-near-limit": {AnalysisType.M2: ScriptEntry(payload_patch={"constraint_margins": _MARGINS})},
    "m3b-hours": {AnalysisType.M3B: ScriptEntry(payload_patch=_HOURS)},
}
