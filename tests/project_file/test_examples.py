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
    # D-116: equal per-unit droop on the catalogue units shares P in proportion to rating (75 : 50)
    p1, p2 = (i["p_kw"] for i in p["inverter_results"])
    assert p1 / p2 == pytest.approx(1.5, rel=1e-9)
    assert p["system_frequency_hz"] == pytest.approx(50 - (50 / 7500) * p1, abs=1e-9)  # f = f* - kP·P
    assert p["system_frequency_hz"] == pytest.approx(49.89088, abs=1e-5)
    assert not any(s["q_droop_not_rating_proportional"] for s in p["sharing"])
