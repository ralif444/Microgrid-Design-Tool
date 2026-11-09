"""WP 1.1.2: Engine Port and Fake Engine controls (NFR-07, NFR-14; Doc 8 §5)."""

from __future__ import annotations

import time

import pytest
from contract.helpers import request_for

from mgapp.adapters.fake_engine import (
    Call,
    FakeEngine,
    FakeEngineDefectError,
    Outcome,
    ScriptEntry,
)
from mgapp.domain.enums import ENGINE_TYPES, AnalysisType, EngineKind, Status, WarningCode
from mgapp.domain.payloads import PAYLOAD_MODEL
from mgapp.engine_port import EnginePort

EXPECTED_STATUS = {
    Outcome.FEASIBLE: Status.FEASIBLE,
    Outcome.INFEASIBLE: Status.INFEASIBLE,
    Outcome.SOLVER_FAILED: Status.SOLVER_FAILED,
    Outcome.PHYSICALLY_INADMISSIBLE: Status.PHYSICALLY_INADMISSIBLE,
    Outcome.INPUT_INVALID: Status.INPUT_INVALID,
    Outcome.NOT_APPLICABLE: Status.UNAVAILABLE,
}


def test_fake_engine_implements_engine_port() -> None:
    assert isinstance(FakeEngine(), EnginePort)


def test_identity_is_fake() -> None:
    ident = FakeEngine().identity()
    assert ident.engine_kind is EngineKind.FAKE
    assert ident.engine_version and ident.engine_git_commit


@pytest.mark.parametrize("t", list(ENGINE_TYPES))
def test_default_profile_is_feasible_with_valid_payload(t: AnalysisType) -> None:
    res = FakeEngine().run(request_for(t))
    assert res.status is Status.FEASIBLE
    assert res.payload is not None
    PAYLOAD_MODEL[t].model_validate(res.payload)


@pytest.mark.parametrize("outcome", list(Outcome))
def test_nfr_07_every_status_on_demand(outcome: Outcome) -> None:
    t = AnalysisType.M2 if outcome is Outcome.INFEASIBLE else AnalysisType.M1
    eng = FakeEngine(script={t: ScriptEntry(outcome)})
    res = eng.run(request_for(t))
    assert res.status is EXPECTED_STATUS[outcome]
    assert res.status_code and res.message


@pytest.mark.parametrize("outcome", list(Outcome))
def test_every_fake_result_carries_engine_kind_fake_warning(outcome: Outcome) -> None:
    res = FakeEngine(script={AnalysisType.M2: ScriptEntry(outcome)}).run(
        request_for(AnalysisType.M2)
    )
    assert WarningCode.ENGINE_KIND_FAKE in [w.code for w in res.warnings]


def test_m2_infeasible_has_two_limiting_constraints() -> None:
    eng = FakeEngine(script={AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)})
    res = eng.run(request_for(AnalysisType.M2))
    assert len(res.limiting_constraints) >= 2
    assert all(lc.margin < 0 for lc in res.limiting_constraints)
    assert res.payload is not None and res.payload["verdict"] == "INFEASIBLE"


def test_call_log_records_calls() -> None:
    eng = FakeEngine()
    eng.run(request_for(AnalysisType.M1))
    eng.run(request_for(AnalysisType.PS))
    assert eng.call_log == [Call(AnalysisType.M1), Call(AnalysisType.PS)]


def test_delay_entry_delays_answer() -> None:
    eng = FakeEngine(script={AnalysisType.M1: ScriptEntry(delay_s=0.05)})
    t0 = time.perf_counter()
    eng.run(request_for(AnalysisType.M1))
    assert time.perf_counter() - t0 >= 0.05


def test_raise_mode_raises() -> None:
    eng = FakeEngine(script={AnalysisType.M1: ScriptEntry(raise_error=True)})
    with pytest.raises(FakeEngineDefectError):
        eng.run(request_for(AnalysisType.M1))


def test_nfr_14_deterministic() -> None:
    eng = FakeEngine()
    a = eng.run(request_for(AnalysisType.M3B))
    b = eng.run(request_for(AnalysisType.M3B))
    assert a == b
