"""X11 reactor sizing advice RS, FR-125 (ADR-017; .scratch/coupling-reactor/spec.md §3 F3).

Stub engine: damping grows with the reactor share of the base impedance, voltage falls with it,
so every outcome is reached quickly. Real Engine: the catalogue D2 example with the BLOCK
LR3 40-4 reactors (data sheet LR3 40-4/x, Doc-Nr 0001211845, 11.2025, sheet 2/8) must come out
FOUND, the bisection between 1 % and 2 % (agent sweep 2026-11-19, spec §2) and the confirmed
damping as in spec §6a (0.218).
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pytest
from api.conftest import SOLVER, Api

from mgapp.adapters.real_engine import RealEngine
from mgapp.domain.contract import AnalysisResult
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import AnalysisType, Status, StatusCode
from mgapp.services.guard import GuardedOutcome
from mgapp.services.reactor_sizing.service import base_ohm, compute

ROOT = Path(__file__).parents[2]
# BLOCK LR3 40-4/x data sheet sheet 2/8 (raw text): rated current, inductance, winding resistance
BLOCK = [
    {"entry_id": "RCT-BLOCK-LR3-40-4-70", "inductance_mh": 0.42, "resistance_mohm": 5.39,
     "rated_current_a": 70},
    {"entry_id": "RCT-BLOCK-LR3-40-4-80", "inductance_mh": 0.37, "resistance_mohm": 2.90,
     "rated_current_a": 80},
    {"entry_id": "RCT-BLOCK-LR3-40-4-100", "inductance_mh": 0.30, "resistance_mohm": 1.43,
     "rated_current_a": 100},
]  # fmt: skip


def d2() -> dict[str, Any]:
    doc = json.loads((ROOT / "frontend/public/examples/d2.mgproj.json").read_text("utf-8"))
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    snap["design_constraints"] = doc.get("design_constraints") or {}
    return snap


def params(**over: Any) -> dict[str, Any]:
    return {"damping_target_ratio": 0.05, "max_percent": 10, "reactor_x_over_r": 30,
            "reactors": BLOCK} | over  # fmt: skip


# ---- stub engine: zeta = -0.3 + 0.2 * p, V = 1 - 0.01 * p (p = reactor share in %) ----


def share(s: ProjectSnapshot) -> float:
    inv = s.inverters[0]
    lr = [ln for ln in s.lines if ln.kind == "REACTOR" and ln.from_bus_id == inv.bus_id]
    if not lr:
        return 0.0
    x = (lr[0].x_ohm_per_km or 0) * (lr[0].length_km or 0)
    return 100 * x / base_ohm(s, inv.rated_kva or 1)


def stub(s: ProjectSnapshot, t: AnalysisType = AnalysisType.M1, *_: Any) -> GuardedOutcome:
    p = share(s)
    if t is AnalysisType.M1:
        payload: dict[str, Any] = {"bus_results": [{"voltage_pu": 1 - 0.01 * p}]}
    else:
        z = -0.3 + 0.2 * p
        payload = {"stability_class": "STABLE" if z > 0 else "UNSTABLE", "zeta_min": z,
                   "modes": [{"damping_ratio": z, "frequency_hz": 10 - p}]}  # fmt: skip
    res = AnalysisResult(status=Status.FEASIBLE, status_code=StatusCode.OK, message="",
                         payload=payload)  # fmt: skip
    return GuardedOutcome(res, None, True)


def stub_run(p: dict[str, Any], vmin: float | None = None) -> dict[str, Any]:
    snap = d2()
    snap["design_constraints"] = {"voltage_min_pu": vmin} if vmin else {}
    res, _ = compute(ProjectSnapshot.model_validate(snap), p, None, stub, 30.0)  # type: ignore[arg-type]
    assert res.status is Status.FEASIBLE, res.message
    return res.payload or {}


def test_rs_stub_found_at_the_boundary_and_picks_the_smallest_fitting_part() -> None:
    out = stub_run(params())
    assert out["outcome"] == "FOUND"
    assert out["percent_of_base"] == pytest.approx(1.75, abs=0.02)  # zeta = 0.05 at p = 1.75
    picks = {i["inverter_id"]: i["entry_id"] for i in out["inverters"]}
    # INV1 75 kVA at 0.44 kV: 98.4 A -> only the 100 A part; INV2 50 kVA: 65.6 A -> 70 A part
    assert picks == {"INV1": "RCT-BLOCK-LR3-40-4-100", "INV2": "RCT-BLOCK-LR3-40-4-70"}
    assert {i["terminal_bus_id"] for i in out["inverters"]} == {"INV1T", "INV2T"}


def test_rs_stub_other_outcomes() -> None:
    assert stub_run(params(max_percent=1))["outcome"] == "NOT_FOUND_BELOW_CEILING"
    assert stub_run(params(), vmin=0.99)["outcome"] == "VOLTAGE_LIMITED"
    assert stub_run(params(reactors=[]))["outcome"] == "NO_CATALOGUE_PART"
    assert stub_run(params(damping_target_ratio=0.9, max_percent=1))["outcome"] == (
        "NOT_FOUND_BELOW_CEILING"
    )


def test_rs_parameters_invalid_and_needs_m1() -> None:
    api = Api(RealEngine())
    m1 = api.m1_ref(project_snapshot=d2())
    body = {"project_snapshot": d2(), "parameters": params(damping_target_ratio=1.5),
            "solver_config": dict(SOLVER), "depends_on": m1}  # fmt: skip
    res = api.post("RS", body).json()["result"]
    assert res["status"] == "INPUT_INVALID"
    assert res["diagnostics"]["issues"][0]["code"] == "REACTOR_SIZING_INVALID"
    res = api.post("RS", {**body, "parameters": params(), "depends_on": None}).json()["result"]
    assert res["status"] == "UNAVAILABLE"


@pytest.fixture(scope="module")
def real_rs() -> dict[str, Any]:
    api = Api(RealEngine())
    m1 = api.m1_ref(project_snapshot=d2())
    body = {"project_snapshot": d2(), "parameters": params(),
            "solver_config": dict(SOLVER), "depends_on": m1}  # fmt: skip
    res = api.post("RS", body).json()["result"]
    assert res["status"] == "FEASIBLE", res
    return res["payload"]


def test_rs_real_engine_d2_found_with_block_reactors(real_rs: dict[str, Any]) -> None:
    assert real_rs["base"]["stability_class"] == "UNSTABLE"
    assert real_rs["outcome"] == "FOUND"
    assert 1.0 < real_rs["percent_of_base"] < 2.0  # spec §2: boundary between 1 % and 2 %
    picks = {i["inverter_id"]: i["entry_id"] for i in real_rs["inverters"]}
    assert picks == {"INV1": "RCT-BLOCK-LR3-40-4-100", "INV2": "RCT-BLOCK-LR3-40-4-70"}
    conf = real_rs["confirmed"]
    assert conf["stability_class"] == "STABLE"
    assert conf["zeta_min"] == pytest.approx(0.218, abs=2e-3)  # spec §6a, BLOCK on both
    assert conf["min_voltage_pu"] == pytest.approx(0.9842, abs=2e-4)
    w = 2 * math.pi * 50
    inv1 = next(i for i in real_rs["inverters"] if i["inverter_id"] == "INV1")
    assert inv1["needed_inductance_mh"] == pytest.approx(
        real_rs["percent_of_base"] / 100 * 0.44**2 / 0.075 / w * 1000
    )
