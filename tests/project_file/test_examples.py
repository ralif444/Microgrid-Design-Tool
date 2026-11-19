"""Seam 4 (WP 1.5.1 P2): example Project files as regression fixtures (Doc 12 FR-85; D-64).

Every example opens and validates; D2 on the Real Engine shares P in proportion to the catalogue
ratings and sits on its droop line, which also checks the conversion of the % droop (D-116) into
contract units.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from mgapp.adapters.real_engine import RealEngine
from mgapp.main import create_app

EXAMPLES = Path(__file__).parents[2] / "frontend" / "public" / "examples"
NAMES = ["d1", "d2", "d2-lr", "d2-lf", "d2s", "d2h"]
SOLVER = {
    "mismatch_tolerance_w": 0.001,
    "max_iterations": 50,
    "initial_guess": "DEFAULT",
}


def example(name: str) -> dict[str, Any]:
    return json.loads((EXAMPLES / f"{name}.mgproj.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(create_app(engine=RealEngine(), serve_static=False))


@pytest.mark.parametrize("name", NAMES)
def test_example_opens_and_validates(client: TestClient, name: str) -> None:
    out = client.post("/api/projects/import", json=example(name)).json()
    assert out["file_check"]["accepted"] and out["validation"]["valid"], out


def test_d2_example_matches_the_engine_hand_check(client: TestClient) -> None:
    doc = example("d2")
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters", "load_profile")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    snap["design_constraints"] = {}
    body = {"project_snapshot": snap, "parameters": {}, "solver_config": SOLVER}
    p = client.post("/api/analyses/M1", json=body).json()["result"]["payload"]
    # D-116: equal per-unit droop on the catalogue units shares P in proportion to rating (75 : 50)
    p1, p2 = (i["p_kw"] for i in p["inverter_results"])
    assert p1 / p2 == pytest.approx(1.5, rel=1e-9)
    assert p["system_frequency_hz"] == pytest.approx(
        50 - (50 / 7500) * p1, abs=1e-9
    )  # f = f* - kP·P
    assert p["system_frequency_hz"] == pytest.approx(49.89088, abs=1e-5)
    assert not any(s["q_droop_not_rating_proportional"] for s in p["sharing"])


def m1_m4a(client: TestClient, name: str) -> tuple[dict[str, Any], dict[str, Any]]:
    doc = example(name)
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    m1 = client.post(
        "/api/analyses/M1",
        json={"project_snapshot": snap, "parameters": {}, "solver_config": SOLVER},
    ).json()
    rec = m1["run_record"]
    ref = {k: rec[k] for k in ("record_id", "snapshot_hash", "result_hash")}
    ref |= {"analysis_type": "M1", "status": rec["result"]["status"]}
    ref["result_payload"] = rec["result"]["payload"]
    body = {
        "project_snapshot": snap,
        "parameters": {},
        "solver_config": SOLVER,
        "depends_on": ref,
    }
    p = client.post("/api/analyses/M4a", json=body).json()["result"]["payload"]
    return m1, p


@pytest.mark.parametrize("name", ["d2-lr", "d2s", "d2h"])
def test_reactor_examples_are_small_signal_stable(client: TestClient, name: str) -> None:  # FR-122
    """X11 (ADR-017, D-119): the BLOCK coupling reactors make the catalogue D2 family stable
    (spec §6a: D2-LR zeta_min 0.218, lowest bus 0.9842 p.u.); the as-built D2 stays UNSTABLE."""
    m1, p = m1_m4a(client, name)
    assert p["stability_class"] == "STABLE"
    if name == "d2-lr":
        assert p["zeta_min"] == pytest.approx(0.218, abs=1e-3)
        vmin = min(b["voltage_pu"] for b in m1["result"]["payload"]["bus_results"])
        assert vmin == pytest.approx(0.9842, abs=1e-4)


def test_d2_lf_benchmark_lengths_stay_unstable(client: TestClient) -> None:
    """D2-LF (Doc 13 §4, D-120): CIGRE LV benchmark feeder lengths (175 m, 140 m of N2XY 4x16)
    alone do not stabilise D2 under plain droop (agent run 2026-11-19: zeta_min -0.0435)."""
    m1, p = m1_m4a(client, "d2-lf")
    assert p["stability_class"] == "UNSTABLE"
    assert p["zeta_min"] == pytest.approx(-0.0435, abs=1e-3)
    vmin = min(b["voltage_pu"] for b in m1["result"]["payload"]["bus_results"])
    assert vmin == pytest.approx(0.9729, abs=1e-4)


def m4b(client: TestClient, name: str, step_kw: float) -> dict[str, Any]:
    doc = example(name)
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    rec = client.post(
        "/api/analyses/M1",
        json={"project_snapshot": snap, "parameters": {}, "solver_config": SOLVER},
    ).json()["run_record"]
    ref = {k: rec[k] for k in ("record_id", "snapshot_hash", "result_hash")}
    ref |= {"analysis_type": "M1", "status": rec["result"]["status"]}
    ref["result_payload"] = rec["result"]["payload"]
    dist = {"kind": "LOAD_STEP", "element_id": "L1", "magnitude": step_kw, "start_time_s": 1.0,
            "duration_s": None}  # fmt: skip
    body = {"project_snapshot": snap, "solver_config": SOLVER, "depends_on": ref,
            "parameters": {"disturbance": dist, "simulation_end_s": 3.0}}  # fmt: skip
    return client.post("/api/analyses/M4b", json=body).json()["result"]["payload"]


def test_m4b_on_d2_and_d2_lr_after_the_engine_fix(client: TestClient) -> None:
    """D-121 (Doc 13 open point 7): SM-01 step (+3 %, 0.815 kW). The unstable as-built D2 now
    integrates past the step and loses the network only once the oscillation has grown
    (agent run 2026-11-19: t = 1.5975 s); D2-LR runs to the end."""
    ab = m4b(client, "d2", 0.815)
    assert ab["transient_class"] == "UNSTABLE" and "lost" in ab["class_reason"]
    assert ab["time_s"][-1] == pytest.approx(1.5975, abs=0.01)
    assert min(ab["system_frequency_hz"]) < 45  # grown far beyond the step
    lr = m4b(client, "d2-lr", 0.815)
    assert lr["time_s"][-1] == pytest.approx(3.0)
    assert {s["line_id"] for s in lr["line_current_a"]} == {"LN1", "LN2", "LR1", "LR2"}
