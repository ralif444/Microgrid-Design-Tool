"""WP 1.7.1: measure run time per study size and request/record sizes on the Real Engine.

Usage: python tools/measure_limits.py

Basis for SWEEP_CAP, SCENARIO_CAP, M3A_PARAMETER_CAP, M4B_DURATION_CAP_S and the body limit
(Doc 9 A-02, A-53; Doc 6 §8). Designs are the Doc 13 §4 reference designs of measure_time.py.
Study settings below (axis ranges, step sizes, the 1 kW load step) are measurement settings,
not engineering results; only the wall times and byte sizes are reported.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time

from _common import BACKEND, uv
from measure_time import snapshot

LOAD_SCALE = {"kind": "LOAD_SCALE", "range_min": 0.5, "range_max": 1.5}
M4_POINT_METRICS = ["ZETA_MIN", "RE_LAMBDA_DOM", "INDICATORS"]


def inner() -> int:
    from fastapi.testclient import TestClient
    from mgapp.config import EngineChoice, Settings
    from mgapp.main import create_app
    from mgapp.services.limits import Limits

    # Measurement needs the raw run time, so the budget is lifted here only.
    limits = Limits(time_budget_s=3600.0, sweep_cap=100_000)
    app = create_app(
        Settings(engine=EngineChoice.REAL), serve_static=False, limits=limits
    )
    c = TestClient(app)
    print(f"engine {c.get('/api/meta').json()['engine']}")
    snap = snapshot("D2")
    m1 = c.post(
        "/api/analyses/M1",
        json={"project_snapshot": snap, "parameters": {}, "solver_config": {}},
    )
    rec = m1.json()["run_record"]
    dep = {
        "record_id": rec["record_id"], "analysis_type": "M1", "snapshot_hash": rec["snapshot_hash"],
        "status": rec["result"]["status"], "result_hash": rec["result_hash"],
        "result_payload": rec["result"]["payload"],
    }  # fmt: skip

    def run(
        t: str, label: str, scenarios: list | None = None, **params: object
    ) -> dict:
        body = {"project_snapshot": snap, "parameters": params, "solver_config": {},
                "depends_on": dep}  # fmt: skip
        if scenarios is not None:
            body["scenarios"] = scenarios
        raw = json.dumps(body).encode()
        t0 = time.perf_counter()
        out = c.post(
            f"/api/analyses/{t}",
            content=raw,
            headers={"content-type": "application/json"},
        )
        wall = time.perf_counter() - t0
        res = out.json()
        r = res["result"]
        size = len(json.dumps(res["run_record"]).encode())
        print(f"{t:3} {label:38} {r['status']}/{r['status_code']:22} {wall:8.3f} s  "
              f"request {len(raw) / 1024:8.1f} KiB  RunRecord {size / 1024:9.1f} KiB")  # fmt: skip
        return res

    for n in (100, 1000):
        run("M3b", f"LOAD_SCALE {n} points", axis={**LOAD_SCALE, "step_count": n})
    for n in (20, 50):
        run("M3b", f"LOAD_SCALE {n} points, LAMBDA_C per point",
            axis={**LOAD_SCALE, "step_count": n}, point_metrics=["LAMBDA_C"])  # fmt: skip
    for n in (200, 1000):
        run("M3b", f"LOAD_SCALE {n} points, M4a per point",
            axis={**LOAD_SCALE, "step_count": n}, point_metrics=M4_POINT_METRICS)  # fmt: skip
    run("M3d", "LOAD_SCALE x P-f droop, 33 x 27 = 891",
        axis_x={**LOAD_SCALE, "step_count": 33},
        axis_y={"kind": "SCALE_FACTOR", "element_set": ["inverters/INV1", "inverters/INV2"],
                "field": "frequency_droop_hz_per_kw",
                "range_min": 0.5, "range_max": 1.5, "step_count": 27})  # fmt: skip
    paths = [
        f"inverters/{i}/{f}"
        for i in ("INV1", "INV2")
        for f in ("frequency_droop_hz_per_kw", "voltage_droop_kv_per_kvar", "rated_kva")
    ]
    paths += [
        "loads/LD1/p_kw",
        "loads/LD1/q_kvar",
        "lines/L1/r_ohm_per_km",
        "lines/L2/r_ohm_per_km",
    ]
    run("M3a", f"{len(paths)} parameters, step 1 %", parameter_paths=paths,
        output_metrics=["SYSTEM_FREQUENCY", "MIN_BUS_VOLTAGE"], step_relative=0.01)  # fmt: skip
    for n in (2, 10, 50, 200):
        scen = [{"scenario_id": f"S{k}", "label": f"copy {k}", "project_snapshot": snap}
                for k in range(1, n + 1)]  # fmt: skip
        run("M3c", f"{n} scenarios", scenarios=scen)
    run("M4a", "D2")
    for end in (1.0, 5.0, 20.0):
        run("M4b", f"1 kW load step, end {end} s", simulation_end_s=end,
            disturbance={"kind": "LOAD_STEP", "element_id": "LD1", "magnitude": 1.0,
                         "start_time_s": 0.1, "duration_s": None})  # fmt: skip
    return 0


def main(argv: list[str]) -> int:
    if argv[:1] == ["--inner"]:
        return inner()
    cmd = [uv(), "run", "--project", str(BACKEND), "python", __file__, "--inner"]
    return subprocess.call(cmd, cwd=BACKEND)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
