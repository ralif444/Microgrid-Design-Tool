"""Doc 12 X9 FR-99 – FR-101 (D-92): the guided example files.

The guided Project is D2 plus the Doc 3 §3.7 limits and the Doc 13 §4 scenarios; it opens and
validates, and every parameter path in its settings and scenarios resolves (Doc 3 §3.10).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from mgapp.adapters.fake_engine import FakeEngine
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
