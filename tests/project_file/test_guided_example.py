"""Doc 12 X9 FR-99 – FR-101 (D-92): the guided example files.

The guided Project is D2 plus the Doc 3 §3.7 limits and the Doc 13 §4 scenarios; it opens and
validates, and every parameter path in its settings and scenarios resolves (Doc 3 §3.10). On the
Real Engine every step runs with the example values (EX-7).
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from mgapp.adapters.fake_engine import FakeEngine
from mgapp.adapters.real_engine import RealEngine
from mgapp.main import create_app

EXAMPLES = Path(__file__).parents[2] / "frontend" / "public" / "examples"


def load(name: str) -> dict[str, Any]:
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


def test_fr_99_guided_project_opens_and_validates() -> None:
    client = TestClient(create_app(engine=FakeEngine(), serve_static=False))
    out = client.post("/api/projects/import", json=load("guided-d2.mgproj.json")).json()
    assert out["file_check"]["accepted"] and out["validation"]["valid"], out


def test_fr_101_guided_design_is_d2_with_sourced_limits_and_scenarios() -> None:
    guided, d2 = load("guided-d2.mgproj.json"), load("d2.mgproj.json")
    for key in ("buses", "lines", "loads", "inverters", "load_profile"):
        assert guided[key] == d2[key], key
    assert guided["design_constraints"] == {  # Doc 3 §3.7 reference-design study settings
        "voltage_min_pu": 0.95,
        "voltage_max_pu": 1.05,
        "frequency_min_hz": 49.75,
        "frequency_max_hz": 50.25,
        "inverter_loading_limit_ratio": 1.0,
    }
    loads = {
        s["name"]: {o["parameter_path"]: o["value"] for o in s["overrides"]}
        for s in guided["scenarios"]
    }
    assert loads == {  # Doc 13 §4 D2S and D2H; the reference is first (Doc 3 §6.6, D-92 K234)
        "D2 base": {},
        "D2S load × 2.4": {"loads/L1/p_kw": 60.0, "loads/L1/q_kvar": 24.0},
        "D2H load × 4.0": {"loads/L1/p_kw": 100.0, "loads/L1/q_kvar": 40.0},
    }
    assert guided["scenarios"][0]["name"] == "D2 base"


def test_fr_100_every_example_path_resolves_on_the_guided_project() -> None:
    guided, settings = load("guided-d2.mgproj.json"), load("guided-d2.example.json")
    assert settings["project"] == "guided-d2" and settings["example_settings_version"] == 1

    def resolves(path: str) -> bool:
        coll, ident, field = path.split("/")
        return any(
            r["id"] == ident and isinstance(r.get(field), (int, float)) for r in guided[coll]
        )

    paths = settings["screens"]["sensitivity"]["fields"]["parameter_paths"]["value"]
    paths += [o["parameter_path"] for s in guided["scenarios"] for o in s["overrides"]]
    assert paths and all(resolves(p) for p in paths), paths
    ids = {r["id"] for c in ("loads", "inverters") for r in guided[c]}
    assert all(
        p["fields"]["disturbance"]["element_id"] in ids
        for p in settings["screens"]["transient"]["presets"]
    )


# ------------------------------------------------------------------ EX-7: REAL end to end
SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}
NEEDS_VALUE = {"M3a", "M3b", "M3d"}  # the example leaves a required field empty (D-92 K231)


def with_overrides(snap: dict[str, Any], overrides: list[dict[str, Any]]) -> dict[str, Any]:
    out = copy.deepcopy(snap)
    for o in overrides:
        coll, ident, field = o["parameter_path"].split("/")
        next(r for r in out[coll] if r["id"] == ident)[field] = o["value"]
    return out


def test_fr_104_guided_example_end_to_end_on_the_real_engine() -> None:
    """EX-7: every step with the example values, in the S-02 order (D-98 K254)."""
    doc, screens = load("guided-d2.mgproj.json"), load("guided-d2.example.json")["screens"]
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters", "load_profile")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    snap["design_constraints"] = doc["design_constraints"]
    client = TestClient(create_app(engine=RealEngine(), serve_static=False))

    def run(t: str, params: dict[str, Any], **extra: Any) -> dict[str, Any]:
        body = {"project_snapshot": snap, "parameters": params, "solver_config": SOLVER}
        r = client.post(f"/api/analyses/{t}", json=body | extra)
        assert r.status_code == 200, r.text
        return r.json()

    def fields(screen: str) -> dict[str, Any]:
        return {k: f["value"] for k, f in screens[screen]["fields"].items()}

    status = {"PS": run("PS", fields("sizing"))["result"]["status"]}
    m1 = run("M1", {})
    p = m1["result"]["payload"]  # the D2 hand check of D-64 / D-63 K124
    assert p["system_frequency_hz"] == pytest.approx(49.87736, abs=1e-5)
    assert [i["p_kw"] for i in p["inverter_results"]] == pytest.approx([15.4113, 9.6321], abs=1e-4)
    rec = m1["run_record"]
    dep = {"depends_on": {
        "record_id": rec["record_id"], "analysis_type": "M1", "snapshot_hash": rec["snapshot_hash"],
        "status": rec["result"]["status"], "result_hash": rec["result_hash"],
        "result_payload": rec["result"]["payload"],
    }}  # fmt: skip
    status["M1"] = m1["result"]["status"]
    status["M2"] = run("M2", fields("constraint-check"), **dep)["result"]["status"]
    for t, screen in (("M3a", "sensitivity"), ("M3b", "sweep"), ("M3d", "envelope")):
        status[t] = run(t, fields(screen), **dep)["result"]["status"]
    scenarios = [
        {"scenario_id": s["id"], "label": s["name"],
         "project_snapshot": with_overrides(snap, s["overrides"])}
        for s in doc["scenarios"]
    ]  # fmt: skip
    status["M3c"] = run("M3c", {}, scenarios=scenarios, **dep)["result"]["status"]
    status["M4a"] = run("M4a", {}, **dep)["result"]["status"]
    for preset in screens["transient"]["presets"]:
        status[f"M4b {preset['id']}"] = run("M4b", preset["fields"], **dep)["result"]["status"]

    invalid = {t for t, s in status.items() if s == "INPUT_INVALID"}
    assert invalid == NEEDS_VALUE, status
    assert all(s == "FEASIBLE" for t, s in status.items() if t not in NEEDS_VALUE), status
