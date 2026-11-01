"""Engine Port contract suite: nine behaviours (Doc 8 §4.2, manuscript 4.3.2 and 4.5.1).

One suite for every adapter. `run_suite(engine)` returns the list of violations; an empty
list means the adapter conforms. The same function runs on the Real Engine adapter from
stage 1.4 without change (NFR-08).
"""

from __future__ import annotations

import copy
import os
from dataclasses import dataclass
from pathlib import Path

from contract.helpers import request_for
from pydantic import ValidationError

from mgapp.domain.contract import AnalysisRequest, AnalysisResult
from mgapp.domain.enums import (
    ALLOWED_STATUS,
    CONSTRAINT_UNIT,
    PAYLOAD_NULL,
    PAYLOAD_REQUIRED,
    AnalysisType,
    Status,
)
from mgapp.domain.payloads import PAYLOAD_MODEL
from mgapp.engine_port import EnginePort


@dataclass(frozen=True)
class Violation:
    behaviour: str  # C1..C9
    analysis_type: str
    detail: str


def _call(engine: EnginePort, req: AnalysisRequest, out: list[Violation]) -> AnalysisResult | None:
    """C9: failures surface as Statuses, never as exceptions."""
    try:
        return engine.run(req)
    except Exception as exc:  # noqa: BLE001 - any exception is a contract breach
        out.append(Violation("C9", req.analysis_type.value, f"raised {type(exc).__name__}"))
        return None


def check_result(t: AnalysisType, res: AnalysisResult) -> list[Violation]:
    v: list[Violation] = []
    tv = t.value
    # C1: exactly one Status with non-empty code and message.
    if not res.status_code.strip() or not res.message.strip():
        v.append(Violation("C1", tv, "empty status_code or message"))
    # C2: Status within the allowed set; M1 never INFEASIBLE.
    if res.status not in ALLOWED_STATUS[t]:
        v.append(Violation("C2", tv, f"status {res.status} not allowed"))
    # C3: INFEASIBLE carries valid limiting constraints with negative margins.
    if res.status is Status.INFEASIBLE:
        if not res.limiting_constraints:
            v.append(Violation("C3", tv, "INFEASIBLE without limiting_constraints"))
        for lc in res.limiting_constraints:
            if lc.unit != CONSTRAINT_UNIT[lc.kind] or not lc.element_id or lc.margin >= 0:
                v.append(Violation("C3", tv, f"invalid limiting constraint {lc.kind}"))
    # C4: payload presence follows the Status table.
    if res.status in PAYLOAD_REQUIRED and res.payload is None:
        v.append(Violation("C4", tv, f"{res.status} without payload"))
    if res.status in PAYLOAD_NULL and res.payload is not None:
        v.append(Violation("C4", tv, f"{res.status} with payload"))
    # C5: payload fields match Doc 3 §6.
    if res.status in PAYLOAD_REQUIRED and res.payload is not None:
        try:
            PAYLOAD_MODEL[t].model_validate(res.payload)
        except ValidationError as exc:
            v.append(Violation("C5", tv, f"payload shape: {exc.error_count()} errors"))
    return v


def run_suite(
    engine: EnginePort,
    workdir: Path,
    types: list[AnalysisType] | None = None,
) -> list[Violation]:
    types = types or list(AnalysisType)
    out: list[Violation] = []

    # C8: identity non-empty and stable.
    try:
        a, b = engine.identity(), engine.identity()
        if not (a.engine_version and a.engine_git_commit) or a != b:
            out.append(Violation("C8", "-", "identity empty or unstable"))
    except Exception as exc:  # noqa: BLE001
        out.append(Violation("C8", "-", f"identity raised {type(exc).__name__}"))

    cwd = Path.cwd()
    os.chdir(workdir)
    try:
        before = set(workdir.iterdir())
        first: dict[AnalysisType, AnalysisResult] = {}
        for t in types:
            req = request_for(t)
            snapshot = copy.deepcopy(req.model_dump())
            res = _call(engine, req, out)
            # C7: request not mutated.
            if req.model_dump() != snapshot:
                out.append(Violation("C7", t.value, "request mutated"))
            if res is None:
                continue
            out += check_result(t, res)
            first[t] = res
        # C6: determinism and statelessness: repeated calls in reversed order are equal.
        for t in reversed(types):
            if t not in first:
                continue
            again = _call(engine, request_for(t), out)
            if again is not None and again != first[t]:
                out.append(Violation("C6", t.value, "result differs between equal calls"))
        # C7: no RunRecord or file produced.
        if set(workdir.iterdir()) != before:
            out.append(Violation("C7", "-", "engine wrote files"))
    finally:
        os.chdir(cwd)
    return out
