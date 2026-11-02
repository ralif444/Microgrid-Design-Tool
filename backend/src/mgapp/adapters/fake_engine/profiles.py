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

PROFILES: dict[str, dict[AnalysisType, ScriptEntry]] = {
    "default": {},
    "m1-solver-failed": {AnalysisType.M1: ScriptEntry(Outcome.SOLVER_FAILED)},
    "m1-inadmissible": {AnalysisType.M1: ScriptEntry(Outcome.PHYSICALLY_INADMISSIBLE)},
    "m2-infeasible": {AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)},
    "m4a-indicators": {AnalysisType.M4A: ScriptEntry(payload_patch={"indicators": _INDICATORS})},
}
