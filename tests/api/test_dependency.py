"""Seam 1: dependency check on depends_on (FR-37, FR-38, FR-40, FR-39, FR-41)."""

from __future__ import annotations

from collections.abc import Callable

import pytest
from api.conftest import Api
from api.test_status_and_runrecord import assert_record

from mgapp.adapters.fake_engine import Outcome, ScriptEntry
from mgapp.domain.enums import AnalysisType

DEPENDENT = ["M2", "M3a", "M3b", "M3c", "M3d", "M4a", "M4b"]


def _calls(api: Api) -> list:
    return list(api.engine.call_log)  # type: ignore[attr-defined]


@pytest.mark.parametrize("t", DEPENDENT)
def test_fr_38_39_missing_m1_is_dependency_not_met(api: Api, t: str) -> None:
    resp = api.run(t)
    r = resp["result"]
    assert (r["status"], r["status_code"]) == ("UNAVAILABLE", "DEPENDENCY_NOT_MET")
    assert "M1" in r["message"]
    assert_record(resp, engine_called=False)
    assert _calls(api) == []


def test_fr_38_m1_not_feasible(api_factory: Callable[..., Api]) -> None:
    api = api_factory(script={AnalysisType.M1: ScriptEntry(Outcome.SOLVER_FAILED)})
    ref = api.m1_ref()
    n = len(_calls(api))
    r = api.run("M2", depends_on=ref)["result"]
    assert r["status_code"] == "DEPENDENCY_NOT_MET" and "M1" in r["message"]
    assert len(_calls(api)) == n


def test_fr_40_stale_m1_worded_as_stale(api: Api) -> None:
    ref = api.m1_ref()
    snap = api.body("M2")["project_snapshot"]
    snap["inverters"][0]["rated_kva"] = 12.0
    r = api.run("M2", depends_on=ref, project_snapshot=snap)["result"]
    assert r["status_code"] == "DEPENDENCY_NOT_MET"
    assert "stale" in r["message"].lower()


def test_fr_38_altered_result_hash(api: Api) -> None:
    ref = api.m1_ref()
    ref["result_payload"]["system_frequency_hz"] = 49.0
    r = api.run("M2", depends_on=ref)["result"]
    assert r["status_code"] == "DEPENDENCY_NOT_MET"
    assert "stale" not in r["message"].lower()


def test_fr_37_valid_m1_lets_m2_run(api: Api) -> None:
    r = api.run("M2", depends_on=api.m1_ref())["result"]
    assert r["status"] == "FEASIBLE"


def test_fr_41_m3_m4_allowed_after_m2_infeasible(api_factory: Callable[..., Api]) -> None:
    api = api_factory(script={AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)})
    ref = api.m1_ref()
    assert api.run("M2", depends_on=ref)["result"]["status"] == "INFEASIBLE"
    assert api.run("M4a", depends_on=ref)["result"]["status"] == "FEASIBLE"
