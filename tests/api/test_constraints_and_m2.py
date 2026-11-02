"""Seam 1 (WP 1.2.2): DesignConstraints in the snapshot and M2 on the Fake Engine.

FR-15 (constraints in the snapshot hash; inverted band), FR-16 (not-evaluated list and
warning), FR-24 (verdict, loadability, margins required), FR-25 (typed limiting constraints),
FR-27 (SizingCheck separate).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from conftest import Api
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.fake_engine import Outcome, ScriptEntry
from mgapp.domain.enums import AnalysisType


def _hash(api: Api, snap: dict[str, Any]) -> str:
    r = api.client.post("/api/projects/validate", json={"project_snapshot": snap})
    assert r.status_code == 200, r.text
    return str(r.json()["snapshot_hash"])


def test_fr_15_constraint_change_changes_snapshot_hash(api: Api) -> None:
    snap = two_bus_snapshot()
    before = _hash(api, snap)
    snap["design_constraints"] = {"voltage_min_pu": 0.95}
    assert _hash(api, snap) != before


def test_fr_15_inverted_band_input_invalid(api: Api) -> None:
    snap = two_bus_snapshot()
    snap["design_constraints"] = {"voltage_min_pu": 1.05, "voltage_max_pu": 0.95}
    r = api.run("M1", project_snapshot=snap)["result"]
    assert r["status"] == "INPUT_INVALID"
    assert r["status_code"] == "BAND_INVERTED"


def test_fr_16_fr_24_fr_27_m2_feasible_with_not_evaluated(api: Api) -> None:
    res = api.run("M2", depends_on=api.m1_ref())["result"]
    assert res["status"] == "FEASIBLE"
    p = res["payload"]
    assert p["verdict"] == "FEASIBLE"
    assert {"lambda_c", "lambda_s", "resolution"} <= p["loadability"].keys()
    # the fixture has no limits: every check is listed as not evaluated, never as satisfied
    assert p["not_evaluated"]
    assert p["constraint_margins"] == []
    assert "CONSTRAINT_NOT_EVALUATED" in {w["code"] for w in res["warnings"]}
    assert {"per_inverter", "per_line", "basis", "assumptions"} <= p["sizing_check"].keys()


def test_fr_16_no_warning_when_every_limit_is_set(api: Api) -> None:
    snap = two_bus_snapshot()
    snap["design_constraints"] = {
        "voltage_min_pu": 0.95,
        "voltage_max_pu": 1.05,
        "frequency_min_hz": 49.75,
        "frequency_max_hz": 50.25,
        "inverter_loading_limit_ratio": 1.0,
        "line_current_limit_a": 100.0,
    }  # FIXTURE ONLY: plumbing values, see fixtures/designs.py
    res = api.run("M2", project_snapshot=snap, depends_on=api.m1_ref(project_snapshot=snap))
    assert res["result"]["payload"]["not_evaluated"] == []
    assert "CONSTRAINT_NOT_EVALUATED" not in {w["code"] for w in res["result"]["warnings"]}


def test_fr_24_missing_margins_input_invalid(api: Api) -> None:
    ref = api.m1_ref()
    res = api.run("M2", depends_on=ref, parameters={"line_margin_ratio": 0.1})["result"]
    assert res["status"] == "INPUT_INVALID"
    assert res["status_code"] == "SIZING_MARGIN_INVALID"


def test_fr_25_infeasible_lists_typed_limiting_constraints(
    api_factory: Callable[..., Api],
) -> None:
    api = api_factory({AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)})
    res = api.run("M2", depends_on=api.m1_ref())["result"]
    assert res["status"] == "INFEASIBLE"
    lcs = res["limiting_constraints"]
    assert len(lcs) == 2
    for lc in lcs:
        assert lc["kind"] and lc["element_id"] and lc["unit"]
        assert lc["margin"] < 0
    assert res["payload"]["verdict"] == "INFEASIBLE"
