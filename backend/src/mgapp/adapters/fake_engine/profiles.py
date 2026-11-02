"""Named Fake Engine fixture profiles for E2E runs (Doc 8 §5), selected at startup by
MGAPP_FAKE_PROFILE. Never selectable per request.
"""

from __future__ import annotations

from mgapp.adapters.fake_engine.engine import Outcome, ScriptEntry
from mgapp.domain.enums import AnalysisType

PROFILES: dict[str, dict[AnalysisType, ScriptEntry]] = {
    "default": {},
    "m1-solver-failed": {AnalysisType.M1: ScriptEntry(Outcome.SOLVER_FAILED)},
    "m1-inadmissible": {AnalysisType.M1: ScriptEntry(Outcome.PHYSICALLY_INADMISSIBLE)},
    "m2-infeasible": {AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)},
}
