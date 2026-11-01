"""Request builders for engine-level tests (contract seam)."""

from __future__ import annotations

from fixtures.designs import PARAMETERS, scenarios, two_bus_snapshot

from mgapp.domain.contract import AnalysisRequest, ScenarioSnapshot
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import AnalysisType


def request_for(t: AnalysisType) -> AnalysisRequest:
    scen = None
    if t is AnalysisType.M3C:
        scen = [ScenarioSnapshot.model_validate(s) for s in scenarios()]
    return AnalysisRequest(
        analysis_type=t,
        project_snapshot=ProjectSnapshot.model_validate(two_bus_snapshot()),
        parameters=dict(PARAMETERS[t.value]),
        scenarios=scen,
    )
