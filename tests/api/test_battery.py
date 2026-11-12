"""Seam 1: POST /api/analyses/BA, power part (Doc 12 FR-76, FR-77, FR-116; ADR-015; D-109).

Banks travel in `parameters`, never in the snapshot. Fictitious TEST ONLY module values.
"""

from __future__ import annotations

import copy
import time
from typing import Any

import pytest
from api.conftest import Api, CountingEngine
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine, Outcome, ScriptEntry
from mgapp.adapters.real_engine import RealEngine
from mgapp.domain.contract import AnalysisRequest, AnalysisResult, EngineIdentity
from mgapp.domain.enums import AnalysisType
from mgapp.services.limits import Limits

REF = {"entry_id": "MOD-T1", "provenance": {}, "catalog_schema_version": 1}


def bank(inv: str = "INV1", power_kw: float = 2.5, **over: Any) -> dict[str, Any]:
    module = {"catalog_ref": REF, "energy_kwh": 5, "discharge_power_kw": power_kw}
    return {
        "inverter_id": inv,
        "module": module,
        "series_count": 8,
        "parallel_count": 2,
        "dc_efficiency_ratio": 0.95,
        "depth_of_discharge_ratio": 0.8,
        "initial_soc_ratio": 1.0,
    } | over


def ba(api: Api, m1: dict[str, Any] | None, **params: Any) -> dict[str, Any]:
    body = api.body("M1", parameters={"banks": [bank()], "start_hour": 0} | params)
    if m1 is not None:
        body["depends_on"] = m1
    r = api.post("BA", body)
    assert r.status_code == 200, r.text
    return r.json()


def test_fr_116_ba_depends_on_m1_missing_or_stale() -> None:
    api = Api(FakeEngine())
    missing = ba(api, None)["result"]
    assert (missing["status"], missing["status_code"]) == ("UNAVAILABLE", "DEPENDENCY_NOT_MET")
    m1 = api.m1_ref()
    snap = two_bus_snapshot()
    snap["loads"][0]["p_kw"] = 6.0
    body = api.body("M1", parameters={"banks": [bank()], "start_hour": 0}, project_snapshot=snap)
    stale = api.post("BA", body | {"depends_on": m1}).json()["result"]
    assert stale["status_code"] == "DEPENDENCY_NOT_MET"


def test_fr_116_power_part_is_app_side_and_hashes_banks_in_parameters() -> None:
    engine = CountingEngine(FakeEngine())
    api = Api(engine)
    m1 = api.m1_ref()
    calls = len(engine.call_log)
    out = ba(api, m1)
    res, rec = out["result"], out["run_record"]
    assert res["status"] == "FEASIBLE" and len(engine.call_log) == calls  # no engine call
    assert res["diagnostics"] == {"computed_by": "app", "engine_calls": 0}
    assert (rec["engine_version"], rec["engine_git_commit"], rec["engine_kind"]) == (
        None,
        None,
        None,
    )
    assert rec["snapshot_hash"] == m1["snapshot_hash"]  # banks are not in the snapshot (FR-75)
    assert rec["parameters"]["banks"][0]["inverter_id"] == "INV1"
    assert res["payload"]["caveat_text"].startswith("Discharge only: recharging is not modelled.")
    assert [b["power"]["outcome"] for b in res["payload"]["banks"]] == ["OK"]


def test_fr_77_ba_status_feasible_with_short_bank() -> None:
    api = Api(RealEngine())
    m1 = api.m1_ref()
    m2_before = api.run("M2", depends_on=m1)["result"]
    out = ba(api, m1, banks=[bank(power_kw=0.0001), bank("INV2")])["result"]
    assert out["status"] == "FEASIBLE"
    assert [b["power"]["outcome"] for b in out["payload"]["banks"]] == ["SHORT", "OK"]
    assert [w["code"] for w in out["warnings"]] == ["BATTERY_POWER_SHORT"]
    assert api.run("M2", depends_on=m1)["result"] == m2_before


def test_fr_116_ba_input_rules() -> None:
    api = Api(FakeEngine())
    m1 = api.m1_ref()
    for params, field in (
        ({"banks": []}, "banks"),
        ({"start_hour": 24}, "start_hour"),
        ({"start_hour": 1.5}, "start_hour"),
        ({"banks": [bank("INV9")]}, "banks[0].inverter_id"),
        ({"banks": [bank(module=None)]}, "banks[0].module"),  # wrong shape, field named
    ):
        res = ba(api, copy.deepcopy(m1), **params)["result"]
        assert res["status"] == "INPUT_INVALID", params
        assert [(i["code"], i["field"]) for i in res["diagnostics"]["issues"]] == [
            ("BATTERY_BANK_INVALID", field)
        ]


# ---- B3 autonomy part (FR-117; ADR-015 §4, Q1 - Q3; D-110). Profile PF-T of the verification
# framework §2 scaled to the 10 kW of the test design: λ = 0.4, 0.6, 1.0, 0.4 per block.
LAM = [0.4] * 6 + [0.6] * 12 + [1.0] * 4 + [0.4] * 2


def profiled(lam: list[float] = LAM) -> dict[str, Any]:
    snap = two_bus_snapshot()
    snap["load_profile"] = {
        "id": "PF-T",
        "values": [{"hour": h, "p_kw": 10 * x} for h, x in enumerate(lam)],
    }
    return snap


class Recording:
    """Fake Engine that keeps every request; M1 call number `fail_at` (1-based) fails."""

    def __init__(self, fail_at: int | None = None, delay_s: float = 0.0) -> None:
        self.ok, self.requests = FakeEngine(), []
        self.bad = FakeEngine(script={AnalysisType.M1: ScriptEntry(Outcome.SOLVER_FAILED)})
        self.fail_at, self.delay_s = fail_at, delay_s

    def identity(self) -> EngineIdentity:
        return self.ok.identity()

    def run(self, request: AnalysisRequest) -> AnalysisResult:
        self.requests.append(request)
        time.sleep(self.delay_s)
        return (self.bad if len(self.requests) == self.fail_at else self.ok).run(request)


def ba_on(api: Api, snap: dict[str, Any], **params: Any) -> dict[str, Any]:
    m1 = api.m1_ref(project_snapshot=snap)
    body = api.body(
        "M1",
        project_snapshot=snap,
        parameters={"banks": [bank()], "start_hour": 0} | params,
        depends_on=m1,
    )
    return api.post("BA", body).json()


def test_fr_117_ba_calls_engine_24_times_with_scaled_loads() -> None:
    eng = Recording()
    out = ba_on(Api(eng), profiled(), start_hour=18)
    res, rec = out["result"], out["run_record"]
    hour_calls = eng.requests[1:]  # the first is the depends_on M1
    assert len(hour_calls) == 24 and {r.analysis_type for r in hour_calls} == {AnalysisType.M1}
    assert [r.project_snapshot.loads[0].p_kw for r in hour_calls[:5]] == pytest.approx(
        [5.0, 5.0, 5.0, 5.0, 2.0]  # clock hours 18 - 21 at λ = 1.0, then 22 at 0.4
    )
    assert hour_calls[0].project_snapshot.loads[1].power_factor == 1.0
    assert [h["clock_hour"] for h in res["payload"]["hours"]] == [*range(18, 24), *range(18)]
    assert res["diagnostics"] == {"computed_by": "app", "engine_calls": 24}
    assert rec["engine_kind"] == "FAKE"  # Q1: identity recorded when the engine was called
    assert "ENGINE_KIND_FAKE" in [w["code"] for w in res["warnings"]]  # Q3
    a = res["payload"]["banks"][0]["autonomy"]
    assert (a["outcome"], a["end_soc_ratio"]) == ("NOT_DEPLETED", 1.0)  # Fake powers are 0


def test_fr_117_ba_stops_at_first_non_feasible_hour() -> None:
    eng = Recording(fail_at=1 + 4)  # the 4th hour call fails
    res = ba_on(Api(eng), profiled())["result"]
    assert res["status"] == "FEASIBLE" and res["diagnostics"]["engine_calls"] == 4
    assert [(h["clock_hour"], h["m1_status_code"]) for h in res["payload"]["hours"]][-1] == (
        3,
        "NO_CONVERGENCE",
    )
    a = res["payload"]["banks"][0]["autonomy"]
    assert a["outcome"] == "NOT_EVALUATED" and len(a["curve"]) == 3
    assert a["reason"] == "M1 at clock hour 3 gave NO_CONVERGENCE"


def test_fr_117_ba_overall_time_budget_gives_timeout() -> None:
    eng = Recording(delay_s=0.02)
    api = Api(eng, Limits(time_budget_s=0.1))
    res = ba_on(api, profiled())["result"]
    assert (res["status"], res["status_code"]) == ("UNAVAILABLE", "TIMEOUT")
    assert 0 < res["diagnostics"]["engine_calls"] < 24


def test_fr_117_profile_peak_above_loads_warns() -> None:
    res = ba_on(Api(FakeEngine()), profiled([1.2] + LAM[1:]))["result"]
    assert "PROFILE_PEAK_ABOVE_LOADS" in [w["code"] for w in res["warnings"]]
    assert "PROFILE_PEAK_ABOVE_LOADS" not in [
        w["code"] for w in ba_on(Api(FakeEngine()), profiled())["result"]["warnings"]
    ]


def test_fr_117_real_engine_curve_is_sum_of_hour_powers() -> None:
    """On the Real Engine the curve is the running sum of the hour M1 powers (Eq. 12.16); the
    hand values V5, V6 on D2 follow in BESS-5."""
    eng = CountingEngine(RealEngine())
    res = ba_on(Api(eng), profiled(), banks=[bank(), bank("INV2")])["result"]
    hours = res["payload"]["hours"]
    assert len(hours) == 24 and all(h["m1_status"] == "FEASIBLE" for h in hours)
    for b in res["payload"]["banks"]:
        a = b["autonomy"]
        assert a["usable_energy_kwh"] == pytest.approx(0.95 * 80 * 0.8)
        cum = [c["cumulative_energy_kwh"] for c in a["curve"]]
        p = [c["inverter_p_kw"] for c in a["curve"]]
        assert cum == pytest.approx([sum(p[: j + 1]) for j in range(len(p))])
