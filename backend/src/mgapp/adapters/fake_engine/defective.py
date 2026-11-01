"""Defective Fake profile (Doc 8 §4.2, manuscript 4.5.1).

Each defect breaks exactly one of the nine contract behaviours. The contract suite must
FAIL on every defect; this is the negative test of the suite itself.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from mgapp.adapters.fake_engine.engine import FakeEngine, FakeEngineDefectError
from mgapp.domain.contract import AnalysisRequest, AnalysisResult, EngineIdentity
from mgapp.domain.enums import AnalysisType, Status, StatusCode


class Defect(StrEnum):
    C1_EMPTY_MESSAGE = "C1"  # empty status_code and message
    C2_M1_INFEASIBLE = "C2"  # M1 returns INFEASIBLE
    C3_INFEASIBLE_NO_CONSTRAINT = "C3"  # INFEASIBLE without limiting constraints
    C4_PAYLOAD_ON_FAILURE = "C4"  # SOLVER_FAILED with a payload
    C5_PAYLOAD_SHAPE = "C5"  # payload with a field outside Doc 3 §6
    C6_NON_DETERMINISTIC = "C6"  # result changes between equal calls
    C7_MUTATES_REQUEST = "C7"  # modifies the request object
    C8_EMPTY_IDENTITY = "C8"  # empty engine version
    C9_RAISES = "C9"  # raises instead of returning a Status


@dataclass
class DefectiveFakeEngine:
    defect: Defect
    _inner: FakeEngine = field(default_factory=FakeEngine)
    _calls: int = 0

    def identity(self) -> EngineIdentity:
        ident = self._inner.identity()
        if self.defect is Defect.C8_EMPTY_IDENTITY:
            return ident.model_copy(update={"engine_version": ""})
        return ident

    def run(self, request: AnalysisRequest) -> AnalysisResult:
        self._calls += 1
        d = self.defect
        res = self._inner.run(request)
        if d is Defect.C1_EMPTY_MESSAGE:
            return res.model_copy(update={"status_code": "", "message": ""})
        if d is Defect.C2_M1_INFEASIBLE and request.analysis_type is AnalysisType.M1:
            return res.model_copy(
                update={"status": Status.INFEASIBLE, "status_code": StatusCode.CONSTRAINT_VIOLATED}
            )
        if d is Defect.C3_INFEASIBLE_NO_CONSTRAINT and request.analysis_type is AnalysisType.M2:
            return res.model_copy(
                update={
                    "status": Status.INFEASIBLE,
                    "status_code": StatusCode.CONSTRAINT_VIOLATED,
                    "limiting_constraints": [],
                }
            )
        if d is Defect.C4_PAYLOAD_ON_FAILURE and request.analysis_type is AnalysisType.M1:
            return res.model_copy(
                update={"status": Status.SOLVER_FAILED, "status_code": StatusCode.NO_CONVERGENCE}
            )
        if d is Defect.C5_PAYLOAD_SHAPE and res.payload is not None:
            return res.model_copy(update={"payload": {**res.payload, "unexpected_field": 1}})
        if d is Defect.C6_NON_DETERMINISTIC:
            return res.model_copy(update={"diagnostics": {"call": self._calls}})
        if d is Defect.C7_MUTATES_REQUEST:
            request.parameters["mutated_by_engine"] = True
            return res
        if d is Defect.C9_RAISES:
            raise FakeEngineDefectError("defective profile C9")
        return res
