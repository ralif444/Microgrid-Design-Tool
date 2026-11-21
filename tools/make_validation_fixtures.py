"""REAL engine runs for the offline M5 script (Doc 13 §5, §8), written as JSON.

The validation package must not import `mgapp` (manuscript 4.3.8), so its inputs are produced
here, through the app's own HTTP surface:
- test fixtures: the D2-LR M1, M4a and SM-01 M4b RunRecords;
- `validation/predictions/limiter_v1.json`: the layer-2 inverter-side current at the M1 point of
  every reference design and its peak in every SM/DR/TS case of the guided examples, against
  the 1.5 p.u. limit, written before any PSIM run (Doc 13 §5).

Usage: uv run --project backend python tools/make_validation_fixtures.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from mgapp.adapters.real_engine import RealEngine
from mgapp.main import create_app

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "validation"))
from m5 import layer2  # noqa: E402  (pure numpy/stdlib, no app import)

EXAMPLES = ROOT / "frontend" / "public" / "examples"
OUT = ROOT / "validation" / "tests" / "fixtures"
SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}
SETTLING = {"frequency_band_hz": 0.05, "voltage_band_kv": 0.0088, "window_s": 0.5}  # Doc 13 §6
DESIGNS = {"d1": None, "d2": "guided-d2", "d2-lr": "guided-d2-lr", "d2-lf": None, "d2s": None,
           "d2h": None}  # fmt: skip


def snapshot(name: str) -> dict[str, Any]:
    """The guided Project where one exists, so its design limits set the transient class."""
    doc = json.loads((EXAMPLES / f"{name}.mgproj.json").read_text("utf-8"))
    keys = ("buses", "lines", "loads", "inverters", "design_constraints")
    snap: dict[str, Any] = {k: doc[k] for k in keys}
    return snap | {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}


def main() -> None:
    c = TestClient(create_app(engine=RealEngine(), serve_static=False))

    def post(t: str, snap: dict[str, Any], **body: Any) -> dict[str, Any]:
        body = {"project_snapshot": snap, "parameters": {}, "solver_config": SOLVER} | body
        rec: dict[str, Any] = c.post(f"/api/analyses/{t}", json=body).json()["run_record"]
        assert rec["engine_kind"] == "REAL", rec["result"]
        return rec

    start: dict[str, Any] = {}
    cases: list[dict[str, Any]] = []
    fixtures: dict[str, dict[str, Any]] = {}
    for name, guided in DESIGNS.items():
        snap = snapshot(guided or name)
        m1 = post("M1", snap)
        assert m1["result"]["status_code"] == "OK", m1["result"]
        pay = m1["result"]["payload"]
        start[name] = {}
        for inv in snap["inverters"]:
            op = next(i for i in pay["inverter_results"] if i["inverter_id"] == inv["id"])
            vb = next(b for b in pay["bus_results"] if b["bus_id"] == inv["bus_id"])
            l2 = layer2.scaled(inv["rated_kva"] * 1e3, 440.0, 50.0)
            i0 = layer2.bridge_current_a(
                op["p_kw"] * 1e3, op["q_kvar"] * 1e3, vb["voltage_kv"] * 1e3, l2, 50.0
            )
            start[name][inv["id"]] = {"start_a": i0, "limit_a": l2["i_limit_a_rms"]}
        if guided is None:
            continue
        ref = {k: m1[k] for k in ("record_id", "snapshot_hash", "result_hash")}
        ref |= {"analysis_type": "M1", "status": m1["result"]["status"], "result_payload": pay}
        ex = json.loads((EXAMPLES / f"{guided}.example.json").read_text("utf-8"))
        for preset in ex["screens"]["transient"]["presets"]:
            params = preset["fields"] | {"settling": SETTLING}
            rec = post("M4b", snap, depends_on=ref, parameters=params)
            p = rec["result"]["payload"]
            cases.append(
                {"design": name, "case": preset["id"], "transient_class": p["transient_class"],
                 "end_s": p["time_s"][-1], "inverters": layer2.limiter_prediction(rec)}
            )  # fmt: skip
            if name == "d2-lr" and preset["id"] == "SM-01":
                fixtures["d2-lr_sm01_m4b"] = rec
        if name == "d2-lr":
            fixtures["d2-lr_m1"] = m1
            fixtures["d2-lr_m4a"] = post("M4a", snap, depends_on=ref)

    OUT.mkdir(parents=True, exist_ok=True)
    for fname, rec in fixtures.items():
        (OUT / f"{fname}.runrecord.json").write_text(json.dumps(rec), "utf-8")
    pred = ROOT / "validation" / "predictions" / "limiter_v1.json"
    pred.parent.mkdir(exist_ok=True)
    out = {"source": "Doc 13 §5, §7; m5.layer2 (Pogaku 2007 scaled, limit 1.5 p.u.)",
           "engine_version": fixtures["d2-lr_m1"]["engine_version"],
           "m1_start": start, "cases": cases}  # fmt: skip
    pred.write_text(json.dumps(out, indent=1), "utf-8")


if __name__ == "__main__":
    main()
