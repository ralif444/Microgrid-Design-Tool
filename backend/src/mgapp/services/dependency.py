"""Dependency checker (component 8; Doc 3 §5.4, manuscript 4.3.3).

M2, M3a-d, M4a-b need a valid M1 RunRecordRef:
(1) status FEASIBLE; (2) snapshot_hash equal to the request (M3c: base) snapshot hash;
(3) SHA-256 of canonical {status, result_payload} equal to result_hash.
CB needs a valid M2 RunRecordRef instead: status FEASIBLE or INFEASIBLE, then (2), (3) (D-102).
Detects accidental change, not tampering.
"""

from __future__ import annotations

from dataclasses import dataclass

from mgapp.domain.contract import RunRecordRef
from mgapp.domain.enums import AnalysisType, Status
from mgapp.services.canonical import sha256_hex

MSG_MISSING = (
    "This analysis needs a valid M1 power-flow result first. Run M1 (power flow) and try again."
)
MSG_NOT_FEASIBLE = (
    "The M1 result this analysis depends on did not find an operating point. "
    "Fix the design and run M1 again."
)
MSG_STALE = "The M1 result is stale: the design changed after M1 was run. Run M1 again."
MSG_ALTERED = (
    "The M1 result this analysis depends on was changed after it was produced. Run M1 again."
)


@dataclass(frozen=True)
class DependencyFailure:
    reason: str  # MISSING, NOT_FEASIBLE, STALE, ALTERED
    message: str


def result_hash(status: Status | str, payload: object) -> str:
    return sha256_hex({"status": str(status), "payload": payload})


CB_MSG_MISSING = (
    "Cable sizing needs a current M2 constraint-check result. Run M2 (constraint check) and "
    "try again."
)
CB_MSG_STALE = "The M2 result is stale: the design changed after M2 was run. Run M2 again."
CB_MSG_ALTERED = (
    "The M2 result cable sizing depends on was changed after it was produced. Run M2 again."
)


def check_dependency(
    ref: RunRecordRef | None, base_snapshot_hash: str, t: AnalysisType | None = None
) -> DependencyFailure | None:
    if t is AnalysisType.CB:  # needs M2, FEASIBLE or INFEASIBLE (D-102 K280)
        if ref is None or ref.analysis_type is not AnalysisType.M2:
            return DependencyFailure("MISSING", CB_MSG_MISSING)
        if ref.status not in (Status.FEASIBLE, Status.INFEASIBLE):
            return DependencyFailure("MISSING", CB_MSG_MISSING)
        msgs = (CB_MSG_ALTERED, CB_MSG_STALE)
    else:
        if ref is None or ref.analysis_type is not AnalysisType.M1:
            return DependencyFailure("MISSING", MSG_MISSING)
        if ref.status is not Status.FEASIBLE:
            return DependencyFailure("NOT_FEASIBLE", MSG_NOT_FEASIBLE)
        msgs = (MSG_ALTERED, MSG_STALE)
    if result_hash(ref.status, ref.result_payload) != ref.result_hash:
        return DependencyFailure("ALTERED", msgs[0])
    if ref.snapshot_hash != base_snapshot_hash:
        return DependencyFailure("STALE", msgs[1])
    return None
