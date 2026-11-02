"""Seam 1, REAL only (WP 1.4.2): startup selection and unit conversion through HTTP.

Expected values follow from the fixture (fixtures/designs.py) by hand: two equal inverters
with droop 0.05 Hz/kW share 10 kW, so f = 50 − 0.05 · 5 = 49.75 Hz (Eq. 4.5); the network
carries no flow (each bus serves its own 5 kW load).
"""

from __future__ import annotations

import pytest
from api.conftest import Api
from fastapi.testclient import TestClient
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.real_engine import RealEngine
from mgapp.config import EngineChoice, Settings
from mgapp.main import create_app


@pytest.fixture
def real() -> Api:
    return Api(RealEngine())


def test_real_selected_at_startup() -> None:
    c = TestClient(create_app(Settings(engine=EngineChoice.REAL), serve_static=False))
    assert c.get("/api/meta").json()["engine"]["engine_kind"] == "REAL"


def test_m1_contract_units(real: Api) -> None:
    p = real.run("M1")["result"]["payload"]
    assert p["system_frequency_hz"] == pytest.approx(49.75, abs=1e-9)
    assert [b["voltage_kv"] for b in p["bus_results"]] == pytest.approx([0.4, 0.4], abs=1e-9)
    assert [i["p_kw"] for i in p["inverter_results"]] == pytest.approx([5.0, 5.0], abs=1e-9)
    assert p["inverter_results"][0]["loading_ratio"] == pytest.approx(0.5, abs=1e-9)
    assert p["epsilon_x_ratio"] == pytest.approx(0.25 / 50, abs=1e-9)  # (4.1)


def test_ps_kva(real: Api) -> None:
    p = real.run("PS")["result"]["payload"]  # m_inv 0.2, n 2, r 0
    assert p["load_apparent_kva"] == pytest.approx(10.0)
    assert p["required_inverter_kva"]["value_kva"] == pytest.approx(12.0)
    assert p["inverter_plan"]["unit_rating_kva"] == pytest.approx(6.0)  # (4.3)


def test_m2_infeasible_frequency_in_hz(real: Api) -> None:
    snap = two_bus_snapshot()
    snap["design_constraints"] = {"frequency_min_hz": 49.8}  # FIXTURE ONLY: above 49.75 Hz
    res = real.run("M2", project_snapshot=snap, depends_on=real.m1_ref(project_snapshot=snap))
    r = res["result"]
    assert r["status"] == "INFEASIBLE" and r["status_code"] == "CONSTRAINT_VIOLATED"
    (lc,) = r["limiting_constraints"]
    assert (lc["kind"], lc["unit"]) == ("FREQUENCY_MIN", "Hz")
    assert lc["value"] == pytest.approx(49.75, abs=1e-9)
    assert lc["margin"] == pytest.approx(-0.05, abs=1e-9)
    assert lc["normalised_margin"] == pytest.approx(-0.05 / 49.8, abs=1e-12)  # (4.18) one-sided


# ------------------------------------------------------------------ WP 1.5.4: M3, M4
# Both buses carry equal loads and inverters, so no power flows and f = 50 − 0.025 · P_total
# (two inverters at 0.05 Hz/kW share the load, Eq. 4.5).


def _dep(real: Api, t: str, snap: dict | None = None, **params: object) -> dict:
    snap = snap or two_bus_snapshot()
    body = {"project_snapshot": snap, "depends_on": real.m1_ref(project_snapshot=snap)}
    if params:
        body["parameters"] = params
    return real.run(t, **body)["result"]


def test_m3a_load_sensitivity_hz_per_kw(real: Api) -> None:
    r = _dep(real, "M3a", parameter_paths=["loads/LD1/p_kw"],
             output_metrics=["SYSTEM_FREQUENCY"], step_absolute=0.5)  # fmt: skip
    (s,) = r["payload"]["sensitivities"]
    # ±0.5 kW moves ±0.25 kW across L1 either way: equal losses, so the central difference is exact
    assert (s["scheme"], s["unit"], s["status_change"]) == ("CENTRAL", "Hz/kW", False)
    assert s["value"] == pytest.approx(-0.025, abs=1e-9)
    assert s["normalised_value"] == pytest.approx(-0.025 * 5 / 49.75, abs=1e-9)
    assert r["payload"]["ranking"] == [
        {"metric": "SYSTEM_FREQUENCY", "parameter_path": "loads/LD1/p_kw", "rank": 1}
    ]


def test_m3a_empty_parameter_not_reported(real: Api) -> None:
    r = _dep(real, "M3a", parameter_paths=["inverters/INV1/p_setpoint_kw"],
             output_metrics=["SYSTEM_FREQUENCY"], step_relative=0.1)  # fmt: skip
    (s,) = r["payload"]["sensitivities"]
    assert (s["value"], s["scheme"], s["reason"]) == (None, None, "parameter has no value")


def test_m3b_load_scale_frequency(real: Api) -> None:
    axis = {"kind": "LOAD_SCALE", "range_min": 0.5, "range_max": 1.5, "step_count": 3}
    p = _dep(real, "M3b", axis=axis)["payload"]
    assert [pt["value"] for pt in p["points"]] == pytest.approx([0.5, 1.0, 1.5])
    f = [pt["key_metrics"]["system_frequency_hz"] for pt in p["points"]]
    assert f == pytest.approx([49.875, 49.75, 49.625], abs=1e-9)
    assert p["first_infeasible_value"] is None


def test_m3b_first_infeasible_value(real: Api) -> None:
    snap = two_bus_snapshot()
    snap["design_constraints"] = {"frequency_min_hz": 49.7}  # FIXTURE ONLY
    axis = {"kind": "LOAD_SCALE", "range_min": 1.0, "range_max": 1.4, "step_count": 3}
    p = _dep(real, "M3b", snap, axis=axis)["payload"]  # f = 49.75, 49.70, 49.65
    assert [pt["status"] for pt in p["points"]] == ["FEASIBLE", "FEASIBLE", "INFEASIBLE"]
    assert p["first_infeasible_value"] == pytest.approx(1.4)
    lc = p["points"][2]["limiting_constraint"]
    assert (lc["kind"], lc["unit"]) == ("FREQUENCY_MIN", "Hz")


def test_m3c_delta_in_hz(real: Api) -> None:
    s2 = two_bus_snapshot()
    for ld in s2["loads"]:
        ld["p_kw"] = 6.0
    scen = [
        {"scenario_id": "S1", "label": "base", "project_snapshot": two_bus_snapshot()},
        {"scenario_id": "S2", "label": "6 kW", "project_snapshot": s2},
    ]
    snap = two_bus_snapshot()
    r = real.run("M3c", project_snapshot=snap, scenarios=scen,
                 depends_on=real.m1_ref(project_snapshot=snap))["result"]  # fmt: skip
    d = next(x for x in r["payload"]["deltas"] if x["metric"] == "SYSTEM_FREQUENCY")
    assert (d["scenario_id"], d["reference_scenario_id"], d["unit"]) == ("S2", "S1", "Hz")
    assert d["delta"] == pytest.approx(-0.05, abs=1e-9)
    assert d["relative_delta_ratio"] == pytest.approx(-0.05 / 49.75, abs=1e-12)


def test_m4a_state_count_and_warning(real: Api) -> None:
    r = _dep(real, "M4a")
    assert r["status"] == "FEASIBLE"
    assert len(r["payload"]["eigenvalues"]) == (2 - 1) + 2 * 2  # (N − 1) + 2N, Doc 3 §6.8
    assert r["payload"]["damping_pass"] is None  # no threshold given
    assert [w["code"] for w in r["warnings"]] == ["VALIDITY_NOT_CALIBRATED"]


def test_m4a_two_inverters_on_one_bus_input_invalid(real: Api) -> None:
    snap = two_bus_snapshot()
    snap["inverters"][1]["bus_id"] = "B1"
    r = _dep(real, "M4a", snap)
    assert (r["status"], r["status_code"]) == ("INPUT_INVALID", "MULTIPLE_INVERTERS_ON_BUS")
    assert r["diagnostics"]["issues"][0]["code"] == "MULTIPLE_INVERTERS_ON_BUS"


M4B = {
    "disturbance": {"kind": "LOAD_STEP", "element_id": "LD1", "magnitude": 1.0,
                    "start_time_s": 0.1, "duration_s": None},
    "simulation_end_s": 1.0,
}  # fmt: skip


def _one_inverter() -> dict:
    snap = two_bus_snapshot()  # the two-inverter fixture is small-signal unstable (Re λ > 0)
    del snap["inverters"][1]
    return snap


def test_m4b_final_frequency_matches_m1_after_step(real: Api) -> None:
    after = _one_inverter()
    after["loads"][0]["p_kw"] = 6.0
    f_after = real.run("M1", project_snapshot=after)["result"]["payload"]["system_frequency_hz"]
    f_before = real.run("M1", project_snapshot=_one_inverter())["result"]["payload"]
    p = _dep(real, "M4b", _one_inverter(), **M4B)["payload"]
    assert p["system_frequency_hz"][0] == pytest.approx(f_before["system_frequency_hz"], abs=1e-9)
    assert p["system_frequency_hz"][-1] == pytest.approx(f_after, abs=1e-6)  # 18 τ after the step
    assert (p["transient_class"], p["settled"]) == (None, None)
    assert p["class_reason"] == "settling criteria not given"


def test_m4b_settled_class(real: Api) -> None:
    settling = {"frequency_band_hz": 0.001, "voltage_band_kv": 0.001, "window_s": 0.2}
    p = _dep(real, "M4b", _one_inverter(), **M4B, settling=settling)["payload"]  # FIXTURE ONLY
    assert (p["transient_class"], p["settled"]) == ("RECOVERED_STABLE", True)


def test_m4b_bad_settling_is_input_invalid(real: Api) -> None:
    r = _dep(real, "M4b", **M4B, settling={"frequency_band_hz": 0.0})
    assert r["status"] == "INPUT_INVALID"
    assert r["diagnostics"]["issues"][0]["code"] == "DISTURBANCE_INVALID"


def test_fr_81_fr_82_sharing_from_the_engine(real: Api) -> None:
    from mgapp.domain.entities import DesignConstraints

    p = real.run("M1", project_snapshot=two_bus_snapshot())["result"]["payload"]
    # Equal ratings and droops: rating-proportional P sharing, no flag (Doc 12 Eq. 12.11, 12.13).
    assert [s["inverter_id"] for s in p["sharing"]] == ["INV1", "INV2"]
    assert [s["p_deviation_kw"] for s in p["sharing"]] == pytest.approx([0.0, 0.0], abs=1e-6)
    assert not any(s["q_droop_not_rating_proportional"] for s in p["sharing"])
    q = [i["q_kvar"] for i in p["inverter_results"]]
    assert p["sharing"][0]["q_deviation_kvar"] == pytest.approx((q[0] - q[1]) / 2, abs=1e-9)
    axis = {"kind": "LOAD_SCALE", "range_min": 0.5, "range_max": 1.5, "step_count": 3}
    pts = _dep(real, "M3b", axis=axis)["payload"]["points"]
    assert all(pt["key_metrics"]["max_q_sharing_error_pu"] is not None for pt in pts)
    assert not any("sharing" in f for f in DesignConstraints.model_fields)
