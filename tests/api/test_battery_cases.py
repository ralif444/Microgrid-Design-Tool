"""Seam 1: hand cases V1 - V6 on the Real Engine as regression fixtures (BESS-5; Doc 12 FR-74,
FR-76, FR-117; docs/BESS_VERIFICATION_FRAMEWORK.md §3, §4; D-111).

Data: tests/fixtures/FAKE_battery_TEST_ONLY.json (fictitious, TEST ONLY). Three checks per case:
the input chain (M1 powers equal §3.0 to their 6 printed decimals), the published hand values
(within 5e-5 of their 4 printed decimals) and the rule chain (the formulas applied to the powers
the tool used, within 1e-9). The B1 counts of V1, V2 run in the client test (battery.test.ts);
here V1 checks the PS energy they start from.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from api.conftest import SOLVER, Api
from fixtures.designs import PARAMETERS

from mgapp.adapters.real_engine import RealEngine

ROOT = Path(__file__).parents[2]
FIX = json.loads((ROOT / "tests/fixtures/FAKE_battery_TEST_ONLY.json").read_text(encoding="utf-8"))
CASES, SET = FIX["cases"], FIX["settings"]
PRINTED = 5e-5


def d2(lam: float = 1.0, profile: bool = True) -> dict[str, Any]:
    doc = json.loads((ROOT / FIX["design"]).read_text(encoding="utf-8"))
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    snap["design_constraints"] = doc.get("design_constraints") or {}
    for ld in snap["loads"]:
        ld["p_kw"] *= lam
        if ld.get("q_kvar") is not None:
            ld["q_kvar"] *= lam
    pf = FIX["profile_pf_t_kw"]
    snap["load_profile"] = (
        {"id": "PF-T", "values": [{"hour": h, "p_kw": v} for h, v in enumerate(pf)]}
        if profile
        else None
    )
    return snap


def bank(case: dict[str, Any]) -> dict[str, Any]:
    ref = {"entry_id": case["module"], "provenance": {}, "catalog_schema_version": 1}
    m = FIX["modules"][case["module"]]
    module = {k: m[k] for k in ("energy_kwh", "voltage_min_v", "voltage_max_v")}
    module |= {k: m[k] for k in ("discharge_power_kw", "c_rate_per_h")}
    return {
        "inverter_id": case["inverter_id"],
        "module": {"catalog_ref": ref, **module},
        "series_count": case["series_count"],
        "parallel_count": case["parallel_count"],
        **{k: SET[k] for k in ("dc_efficiency_ratio", "depth_of_discharge_ratio")},
        "initial_soc_ratio": SET["initial_soc_ratio"],
    }


@pytest.fixture(scope="module")
def real() -> Api:
    return Api(RealEngine())


@pytest.fixture(scope="module")
def ba(real: Api) -> dict[str, Any]:
    """One BA run on D2 + PF-T with the four banks of V3 - V6 (one per inverter per run)."""
    m1 = real.m1_ref(project_snapshot=d2())
    out: dict[str, Any] = {}
    for names in (("V3", "V5"), ("V4", "V6")):  # V3 and V6 are both on INV1
        banks = [bank(CASES[n]) for n in names]
        body = real.body(
            "M1",
            project_snapshot=d2(),
            parameters={"banks": banks, "start_hour": SET["start_hour"]},
            depends_on=m1,
        )
        res = real.post("BA", body).json()
        assert res["result"]["status"] == "FEASIBLE", res["result"]
        for n, row in zip(names, res["result"]["payload"]["banks"], strict=True):
            out[n] = row
        out["hours"] = res["result"]["payload"]["hours"]
    return out


@pytest.mark.parametrize("row", FIX["m1_powers_3_0"], ids=lambda r: f"lambda={r['lambda']}")
def test_input_chain_m1_powers_equal_3_0(real: Api, row: dict[str, Any]) -> None:
    p = real.run("M1", project_snapshot=d2(row["lambda"], profile=False))["result"]["payload"]
    got = {r["inverter_id"]: r["p_kw"] for r in p["inverter_results"]}
    assert got["INV1"] == pytest.approx(row["INV1"], abs=5e-7)
    assert got["INV2"] == pytest.approx(row["INV2"], abs=5e-7)
    assert p["system_frequency_hz"] == pytest.approx(row["frequency_hz"], abs=5e-7)


def test_v1_ps_storage_energy(real: Api) -> None:
    c = CASES["V1"]
    params = dict(PARAMETERS["PS"]) | {
        "autonomy_h": SET["autonomy_h"],
        "dc_efficiency_ratio": SET["dc_efficiency_ratio"],
        "depth_of_discharge_ratio": SET["depth_of_discharge_ratio"],
    }
    body = {"project_snapshot": d2(), "parameters": params, "solver_config": SOLVER}
    e = real.post("PS", body).json()["result"]["payload"]["storage_energy"]
    assert e["e_ac_kwh"] == pytest.approx(c["e_ac_kwh"], abs=PRINTED)
    assert e["e_dc_kwh"] == pytest.approx(c["e_dc_kwh"], abs=PRINTED)
    assert e["e_nom_kwh"] == pytest.approx(c["e_nom_kwh"], abs=PRINTED)


@pytest.mark.parametrize("name", ["V3", "V4"])
def test_v3_v4_power_part(ba: dict[str, Any], name: str) -> None:
    c, p = CASES[name], ba[name]["power"]
    assert (p["outcome"], p["capability_source"]) == (c["outcome"], c["capability_source"])
    for k in ("capability_kw", "dc_side_power_kw", "margin_kw"):
        assert p[k] == pytest.approx(c[k], abs=PRINTED), k
    eta = SET["dc_efficiency_ratio"]
    assert p["dc_side_power_kw"] == pytest.approx(p["inverter_p_kw"] / eta, abs=1e-9)
    assert p["margin_kw"] == pytest.approx(p["capability_kw"] - p["dc_side_power_kw"], abs=1e-9)


def test_v5_depletes_within_24_h(ba: dict[str, Any]) -> None:
    c, a = CASES["V5"], ba["V5"]["autonomy"]
    assert (a["outcome"], a["depletion_clock_hour"]) == (c["outcome"], c["depletion_clock_hour"])
    assert a["usable_energy_kwh"] == pytest.approx(c["usable_energy_kwh"], abs=1e-9)
    assert a["curve"][11]["cumulative_energy_kwh"] == pytest.approx(c["cum_kwh_at_11"], abs=PRINTED)
    assert a["curve"][11]["soc_ratio"] == pytest.approx(c["soc_at_11"], abs=PRINTED)
    assert a["autonomy_h"] == pytest.approx(c["autonomy_h"], abs=PRINTED)
    prev, p12 = a["curve"][11]["cumulative_energy_kwh"], a["curve"][12]["inverter_p_kw"]
    assert a["autonomy_h"] == pytest.approx(12 + (a["usable_energy_kwh"] - prev) / p12, abs=1e-9)


def test_v6_not_depleted(ba: dict[str, Any]) -> None:
    c, a = CASES["V6"], ba["V6"]["autonomy"]
    assert a["outcome"] == c["outcome"] and len(a["curve"]) == 24
    assert a["usable_energy_kwh"] == pytest.approx(c["usable_energy_kwh"], abs=1e-9)
    cum = a["curve"][-1]["cumulative_energy_kwh"]
    assert cum == pytest.approx(c["cum_kwh_at_23"], abs=PRINTED)
    assert cum == pytest.approx(sum(x["inverter_p_kw"] for x in a["curve"]), abs=1e-9)
    assert a["end_soc_ratio"] == pytest.approx(c["end_soc_ratio"], abs=PRINTED)
    assert a["end_soc_ratio"] == pytest.approx(1 - cum / (0.95 * 320), abs=1e-9)


def test_hours_follow_pf_t(ba: dict[str, Any]) -> None:
    lam = [h["lambda"] for h in ba["hours"]]
    assert lam == pytest.approx([v / 25 for v in FIX["profile_pf_t_kw"]])
    assert all(h["m1_status"] == "FEASIBLE" for h in ba["hours"])
