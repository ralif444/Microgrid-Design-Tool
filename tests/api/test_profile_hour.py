"""Seam 1: M3b axis kind LOAD_PROFILE_HOUR (P11; Doc 12 FR-78, Eq. 12.9; Doc 3 §6.5; D-113).

Profile: PF-T of tests/fixtures/FAKE_battery_TEST_ONLY.json (fictitious, TEST ONLY), scaled from the
25 kW of D2 to the 10 kW of the test design, so λ_h = 0.4, 0.6, 1.0, 0.4 per block.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from api.conftest import Api
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine

FIX = json.loads(
    (Path(__file__).parents[1] / "fixtures/FAKE_battery_TEST_ONLY.json").read_text(encoding="utf-8")
)
LAM = [v / 25 for v in FIX["profile_pf_t_kw"]]
HOUR = {"kind": "LOAD_PROFILE_HOUR", "range_min": 0, "range_max": 23, "step_count": 24}


def profiled(lam: list[float] = LAM) -> dict[str, Any]:
    snap = two_bus_snapshot()
    snap["load_profile"] = {
        "id": "PF-T",
        "values": [{"hour": h, "p_kw": 10 * x} for h, x in enumerate(lam)],
    }
    return snap


def m3b(api: Api, snap: dict[str, Any], axis: dict[str, Any] = HOUR) -> dict[str, Any]:
    m1 = api.m1_ref(project_snapshot=snap)
    out = api.run("M3b", project_snapshot=snap, parameters={"axis": axis}, depends_on=m1)
    return out["result"]


def issues(res: dict[str, Any]) -> list[tuple[str, str]]:
    return [(i["code"], i["field"]) for i in res["diagnostics"]["issues"]]


def test_fr_78_hour_axis_24_points(api: Api) -> None:
    res = m3b(api, profiled())
    assert res["status"] == "FEASIBLE"
    pts = res["payload"]["points"]
    assert [p["value"] for p in pts] == list(range(24))
    assert all(p["status"] for p in pts)  # each hour has its own Status
    assert "PROFILE_PEAK_ABOVE_LOADS" not in [w["code"] for w in res["warnings"]]


def test_fr_78_real_hour_equals_load_scale_lambda(api: Api) -> None:
    """Hour h is the LOAD_SCALE point at λ_h (Eq. 12.9): hours 18 and 0 equal λ = 1.0 and 0.4."""
    if api.engine.identity().engine_kind != "REAL":
        pytest.skip("the Fake Engine gives the same canned metrics at every hour")
    pts = m3b(api, profiled())["payload"]["points"]
    scale = {"kind": "LOAD_SCALE", "range_min": 0.4, "range_max": 1.0, "step_count": 2}
    ref = m3b(api, profiled(), scale)["payload"]["points"]
    assert pts[18]["key_metrics"] == ref[1]["key_metrics"]
    assert pts[0]["key_metrics"]["system_frequency_hz"] == pytest.approx(
        ref[0]["key_metrics"]["system_frequency_hz"], abs=1e-12
    )


def test_fr_78_no_profile_input_invalid() -> None:
    res = m3b(Api(FakeEngine()), two_bus_snapshot())
    assert res["status"] == "INPUT_INVALID"
    assert issues(res) == [("PROFILE_LENGTH", "load_profile")]


@pytest.mark.parametrize(
    "axis",
    [
        HOUR | {"range_max": 22},
        HOUR | {"step_count": 12},
        HOUR | {"range_min": 1, "range_max": 24},
    ],
)
def test_fr_78_hour_axis_range_is_fixed(axis: dict[str, Any]) -> None:
    res = m3b(Api(FakeEngine()), profiled(), axis)
    assert issues(res) == [("SWEEP_RANGE_INVALID", "axis")]


def test_fr_78_hour_axis_is_m3b_only() -> None:
    api = Api(FakeEngine())
    m1 = api.m1_ref(project_snapshot=profiled())
    scale = {"kind": "LOAD_SCALE", "range_min": 0.5, "range_max": 1.5, "step_count": 2}
    res = api.run(
        "M3d",
        project_snapshot=profiled(),
        parameters={"axis_x": HOUR, "axis_y": scale},
        depends_on=m1,
    )["result"]
    assert issues(res) == [("SWEEP_RANGE_INVALID", "axis_x")]


def test_fr_79_lambda_above_one_warns(api: Api) -> None:
    res = m3b(api, profiled([1.2] + LAM[1:]))
    warn = [w for w in res["warnings"] if w["code"] == "PROFILE_PEAK_ABOVE_LOADS"]
    assert len(warn) == 1 and "hour" in warn[0]["message"]
