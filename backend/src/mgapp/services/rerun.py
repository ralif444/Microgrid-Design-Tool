"""Re-run orchestrator (component 11; Doc 4 §7, Doc 6 §3.8, manuscript 4.3.5).

Verify -> send the stored input through the same pipeline -> new RunRecord with
`replay_of_record_id` -> compare. REPRODUCED iff status and result_hash are equal; otherwise
DIFFERS with the differences listed. Exact comparison, no tolerance (Doc 9 A-25). The
imported record is never modified.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from mgapp.domain.base import Model
from mgapp.domain.contract import Warning
from mgapp.domain.enums import WarningCode
from mgapp.domain.run_record import AnalysisResponse
from mgapp.services.file_check import (
    EngineComparison,
    FileCheckResult,
    check_record,
    compare_engine,
)
from mgapp.services.pipeline import Pipeline


class Outcome(StrEnum):
    REPRODUCED = "REPRODUCED"
    DIFFERS = "DIFFERS"


class DiffKind(StrEnum):
    STATUS = "STATUS"
    STATUS_CODE = "STATUS_CODE"
    VALUE = "VALUE"
    MISSING_FIELD = "MISSING_FIELD"
    EXTRA_FIELD = "EXTRA_FIELD"


class Difference(Model):
    path: str
    kind: DiffKind
    stored: Any = None
    current: Any = None


class ReproductionReport(Model):
    outcome: Outcome
    differences: list[Difference]
    version_mismatch: EngineComparison | None
    solver_tolerance: Any = None  # informational only; never used to pass a comparison


class RerunResponse(Model):
    file_check: FileCheckResult
    analysis: AnalysisResponse | None
    reproduction: ReproductionReport | None


_MISSING = object()


def diff(path: str, stored: Any, current: Any, out: list[Difference]) -> None:
    """Leaf differences between two JSON values; current lacks a key -> MISSING_FIELD."""
    if isinstance(stored, dict) and isinstance(current, dict):
        for k in sorted(stored.keys() | current.keys()):
            p = f"{path}.{k}"
            a, b = stored.get(k, _MISSING), current.get(k, _MISSING)
            if b is _MISSING:
                out.append(Difference(path=p, kind=DiffKind.MISSING_FIELD, stored=a))
            elif a is _MISSING:
                out.append(Difference(path=p, kind=DiffKind.EXTRA_FIELD, current=b))
            else:
                diff(p, a, b, out)
    elif isinstance(stored, list) and isinstance(current, list):
        for i in range(max(len(stored), len(current))):
            p = f"{path}[{i}]"
            if i >= len(current):
                out.append(Difference(path=p, kind=DiffKind.MISSING_FIELD, stored=stored[i]))
            elif i >= len(stored):
                out.append(Difference(path=p, kind=DiffKind.EXTRA_FIELD, current=current[i]))
            else:
                diff(p, stored[i], current[i], out)
    elif stored != current:  # 1 == 1.0, as in the canonical number rule
        out.append(Difference(path=path, kind=DiffKind.VALUE, stored=stored, current=current))


def rerun(raw: Any, pipeline: Pipeline) -> RerunResponse:
    fc, rec = check_record(raw)
    if rec is None:
        return RerunResponse(file_check=fc, analysis=None, reproduction=None)
    body: dict[str, Any] = {
        "project_snapshot": rec.snapshot,
        "parameters": rec.parameters,
        "solver_config": rec.solver_config,
    }
    if rec.depends_on is not None:
        body["depends_on"] = rec.depends_on
    if rec.scenarios is not None:
        body["scenarios"] = rec.scenarios
    resp = pipeline.run_raw(rec.analysis_type, body, replay_of=rec.record_id)

    comparison = compare_engine(rec, pipeline.engine_identity())
    if comparison.differs:  # warn and still run (FR-51); warnings are outside result_hash
        resp.result.warnings.append(
            Warning(
                code=WarningCode.ENGINE_VERSION_MISMATCH,
                message="The stored record was made with a different engine version; "
                "results may differ.",
            )
        )
    old, new = rec.result, resp.result
    diffs: list[Difference] = []
    if old.status != new.status:
        diffs.append(
            Difference(path="status", kind=DiffKind.STATUS, stored=old.status, current=new.status)
        )
    if old.status_code != new.status_code:
        diffs.append(
            Difference(
                path="status_code",
                kind=DiffKind.STATUS_CODE,
                stored=old.status_code,
                current=new.status_code,
            )
        )
    diff("payload", old.payload, new.payload, diffs)
    same = old.status == new.status and rec.result_hash == resp.run_record.result_hash
    return RerunResponse(
        file_check=fc,
        analysis=resp,
        reproduction=ReproductionReport(
            outcome=Outcome.REPRODUCED if same else Outcome.DIFFERS,
            differences=diffs,
            version_mismatch=comparison if comparison.differs else None,
        ),
    )
