"""Seam 4 (WP 1.5.1 P2): example Project files as regression fixtures (Doc 12 FR-85; D-64).

Every example opens and validates; D2 on the Real Engine gives the operating point of the engine
hand check (engine/tests/test_results.py, D-63 K124), which also checks the unit conversion of
the Doc 13 droop gains into contract units.
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
NAMES = ["d1", "d2", "d2s", "d2h"]
SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}


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
    assert p["system_frequency_hz"] == pytest.approx(49.87736, abs=1e-5)
    assert [i["p_kw"] for i in p["inverter_results"]] == pytest.approx([15.4113, 9.6321], abs=1e-4)
    assert p["sharing"][0]["q_deviation_kvar"] == pytest.approx(-0.3700, abs=1e-4)
