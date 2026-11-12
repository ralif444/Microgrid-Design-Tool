"""Seam 1 (WP 1.2.1): POST /api/projects/validate and PS on the Fake Engine.

FR-03, FR-17, FR-18 (load rows), FR-06, FR-07 (PS advice; storage staging is tested on the
engine, Doc 9 D-45 K6), Doc 6 §3.4 (ValidationReport).
"""

from __future__ import annotations

from typing import Any

import pytest
from conftest import Api
from fixtures.designs import two_bus_snapshot


def _validate(api: Api, body: Any) -> dict[str, Any]:
    r = api.client.post("/api/projects/validate", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _issues(report: dict[str, Any]) -> set[tuple[str, str | None, str | None]]:
    return {(i["code"], i["id"], i["field"]) for i in report["issues"]}


def test_fr_03_valid_load_rows_with_q_or_pf_accepted(api: Api) -> None:
    rep = _validate(api, {"project_snapshot": two_bus_snapshot()})
    assert rep["valid"] is True
    assert rep["issues"] == []
    assert api.engine.call_log == []  # type: ignore[attr-defined]


@pytest.mark.parametrize(
    ("load", "expected"),
    [
        ({"p_kw": -1.0, "q_kvar": 0.0}, ("NEGATIVE_POWER", "LD1", "p_kw")),
        ({"p_kw": None, "q_kvar": 0.0}, ("EMPTY_REQUIRED", "LD1", "p_kw")),
        (
            {"p_kw": 1.0, "power_factor": 1.2, "pf_direction": "LAGGING"},
            ("PF_OUT_OF_RANGE", "LD1", "power_factor"),
        ),
        ({"p_kw": 1.0}, ("LOAD_Q_AMBIGUOUS", "LD1", None)),
        ({"p_kw": 1.0, "power_factor": 0.9}, ("PF_DIRECTION_MISSING", "LD1", "pf_direction")),
    ],
)
def test_fr_18_fr_17_load_rows_rejected_naming_field_zero_calls(
    api: Api, load: dict[str, Any], expected: tuple[str, str, str | None]
) -> None:
    snap = two_bus_snapshot()
    snap["loads"][0] = {"id": "LD1", "bus_id": "B1", **load}
    rep = _validate(api, {"project_snapshot": snap})
    assert rep["valid"] is False
    assert expected in _issues(rep)
    assert all(i["message"] for i in rep["issues"])
    assert api.engine.call_log == []  # type: ignore[attr-defined]


def test_validate_target_selects_rules(api: Api) -> None:
    snap = two_bus_snapshot()
    snap["inverters"] = []
    m1 = _validate(api, {"project_snapshot": snap})
    ps = _validate(api, {"project_snapshot": snap, "target_analysis_type": "PS"})
    assert ("NO_INVERTER", None, None) in _issues(m1)
    assert ps["valid"] is True


def test_validate_parameters_checked_only_when_given(api: Api) -> None:
    snap = two_bus_snapshot()
    base = {"project_snapshot": snap, "target_analysis_type": "PS"}
    assert _validate(api, base)["valid"] is True
    bad = _validate(api, {**base, "parameters": {"unit_count": 1, "redundancy": 1}})
    assert "PS_PARAMETER_INVALID" in {i["code"] for i in bad["issues"]}


def test_validate_hash_equals_m1_snapshot_hash(api: Api) -> None:
    rep = _validate(api, {"project_snapshot": two_bus_snapshot()})
    assert rep["snapshot_hash"] == api.run("M1")["run_record"]["snapshot_hash"]


def test_validate_off_schema_body_is_a_report_not_422(api: Api) -> None:
    rep = _validate(api, {"project_snapshot": {"loads": "not a list"}})
    assert rep["valid"] is False
    assert [i["code"] for i in rep["issues"]] == ["MALFORMED_REQUEST"]
    assert len(rep["snapshot_hash"]) == 64


def test_fr_06_fr_07_ps_advice_with_basis_assumptions_and_runrecord(api: Api) -> None:
    resp = api.run("PS")
    res = resp["result"]
    assert res["status"] == "FEASIBLE"
    p = res["payload"]
    for item in (p["required_inverter_kva"], p["inverter_plan"]):
        assert item["basis"]
        assert isinstance(item["assumptions"], list)
    assert p["storage_energy"] is None  # no LoadProfile or autonomy in the fixture
    assert resp["run_record"]["analysis_type"] == "PS"


def test_fr_06_ps_redundancy_with_one_unit_input_invalid(api: Api) -> None:
    resp = api.run(
        "PS", parameters={"inverter_margin_ratio": 0.2, "unit_count": 1, "redundancy": 1}
    )
    assert resp["result"]["status"] == "INPUT_INVALID"
    assert resp["result"]["status_code"] == "PS_PARAMETER_INVALID"
    assert api.engine.call_log == []  # type: ignore[attr-defined]


def _profile(n: int) -> dict[str, Any]:
    return {"id": "LP1", "values": [{"hour": h, "p_kw": 1.0} for h in range(n)]}


@pytest.mark.parametrize(("n", "valid"), [(24, True), (23, False), (25, False)])
def test_fr_04_load_profile_needs_24_points(api: Api, n: int, valid: bool) -> None:
    snap = two_bus_snapshot() | {"load_profile": _profile(n)}
    rep = _validate(api, {"project_snapshot": snap})
    assert rep["valid"] is valid, rep
    if not valid:
        assert ("PROFILE_LENGTH", "LP1", "values") in _issues(rep)


def test_fr_20_all_violations_in_one_response(api: Api) -> None:
    snap = two_bus_snapshot()
    snap["loads"][0]["p_kw"] = -1.0
    snap["loads"][1]["p_kw"] = None
    rep = _validate(api, {"project_snapshot": snap})
    assert {("NEGATIVE_POWER", "LD1", "p_kw"), ("EMPTY_REQUIRED", "LD2", "p_kw")} <= _issues(rep)
    assert all(i["message"] for i in rep["issues"])


def test_m3c_scenario_of_another_design_is_input_invalid(api: Api) -> None:
    """D-112: a scenario must hold the base lines; an extra line was an ENGINE_ERROR on REAL
    and FEASIBLE on FAKE. A removed inverter (N−1, FR-80) stays allowed."""
    other = two_bus_snapshot()
    other["buses"].append({"id": "B3"})
    other["lines"].append(dict(other["lines"][0], id="L2", from_bus_id="B2", to_bus_id="B3"))
    scen = [
        {"scenario_id": "S1", "label": "base", "project_snapshot": two_bus_snapshot()},
        {"scenario_id": "S2", "label": "other", "project_snapshot": other},
    ]
    r = api.run("M3c", scenarios=scen)["result"]
    assert r["status"] == "INPUT_INVALID"
    assert [(i["code"], i["entity"], i["id"]) for i in r["diagnostics"]["issues"]] == [
        ("SCENARIO_PATH_INVALID", "Scenario S2: Line", "L2"),
    ]
    assert api.engine.call_log == []  # type: ignore[attr-defined]
