"""WP 1.4.3: measure PS, M1, M2 request time on the Real Engine (NFR-04, Doc 9 A-01).

Usage: python tools/measure_time.py [repeats]   (default 10)

Cases are the Doc 13 §4 reference designs D1, D2, D2S, D2H (440 V, 50 Hz), converted to
contract units (Hz/kW = m_p / (2π·10⁻³), kV/kvar = n_q·√3, Doc 3 §1). Limits are the
reference-design study settings of Doc 3 §3.7 (0.95–1.05 p.u., 49.75–50.25 Hz, μ = 1).
Each request goes through the full HTTP pipeline; the largest wall time per type is reported.
"""

from __future__ import annotations

import math
import subprocess
import sys
import time

from _common import BACKEND, uv

# Doc 13 §4: (id, bus, kVA, m_p rad/(s·W), n_q V/VAR)
D1_INV = [("INV1", "B1", 50.0, 5e-5, 5e-4)]
D2_INV = [("INV1", "B1", 70.0, 5e-5, 5e-4), ("INV2", "B3", 45.0, 8e-5, 7e-4)]
# (id, from, to, R Ω, X Ω)
D1_LINES = [("L1", "B1", "B2", 0.02, 0.04)]
D2_LINES = [*D1_LINES, ("L2", "B2", "B3", 0.025, 0.045)]
CASES = {  # load at B2: kW, kvar
    "D1": (["B1", "B2"], D1_LINES, D1_INV, 20.0, 8.0),
    "D2": (["B1", "B2", "B3"], D2_LINES, D2_INV, 25.0, 10.0),
    "D2S": (["B1", "B2", "B3"], D2_LINES, D2_INV, 60.0, 24.0),
    "D2H": (["B1", "B2", "B3"], D2_LINES, D2_INV, 100.0, 40.0),
}


def snapshot(case: str) -> dict:
    buses, lines, invs, p, q = CASES[case]
    return {
        "nominal_voltage_kv": 0.44,
        "nominal_frequency_hz": 50.0,
        "buses": [{"id": b} for b in buses],
        "lines": [
            {"id": i, "from_bus_id": f, "to_bus_id": t, "r_ohm_per_km": r, "x_ohm_per_km": x,
             "length_km": 1.0}
            for i, f, t, r, x in lines
        ],
        "loads": [{"id": "LD1", "bus_id": "B2", "p_kw": p, "q_kvar": q}],
        "inverters": [
            {"id": i, "bus_id": b, "rated_kva": s,
             "frequency_droop_hz_per_kw": mp / (2 * math.pi * 1e-3),
             "voltage_droop_kv_per_kvar": nq * math.sqrt(3),
             "frequency_setpoint_hz": 50.0, "voltage_setpoint_kv": 0.44,
             "tau_p_s": 0.05, "tau_q_s": 0.05}
            for i, b, s, mp, nq in invs
        ],
        "design_constraints": {
            "voltage_min_pu": 0.95, "voltage_max_pu": 1.05,
            "frequency_min_hz": 49.75, "frequency_max_hz": 50.25,
            "inverter_loading_limit_ratio": 1.0,
        },
    }  # fmt: skip


def inner(repeats: int) -> int:
    from fastapi.testclient import TestClient

    from mgapp.config import EngineChoice, Settings
    from mgapp.main import create_app

    c = TestClient(create_app(Settings(engine=EngineChoice.REAL), serve_static=False))
    print(f"engine {c.get('/api/meta').json()['engine']}, repeats {repeats}")
    worst = {"PS": 0.0, "M1": 0.0, "M2": 0.0}
    for case in CASES:
        snap = snapshot(case)
        base = {"project_snapshot": snap, "solver_config": {}}  # contract defaults (Doc 3 §5.1)
        params = {
            "PS": {"inverter_margin_ratio": 0.2, "unit_count": 1, "redundancy": 0},
            "M1": {},
            "M2": {"inverter_margin_ratio": 0.2, "line_margin_ratio": 0.2},
        }  # margins only steer advisory sizing, not run time
        m1 = c.post("/api/analyses/M1", json={**base, "parameters": {}}).json()
        rec = m1["run_record"]
        ref = {
            "record_id": rec["record_id"], "analysis_type": "M1",
            "snapshot_hash": rec["snapshot_hash"], "status": rec["result"]["status"],
            "result_hash": rec["result_hash"], "result_payload": rec["result"]["payload"],
        }  # fmt: skip
        for t in worst:
            body = {**base, "parameters": params[t]}
            if t == "M2":
                body["depends_on"] = ref
            times, status = [], ""
            for _ in range(repeats):
                t0 = time.perf_counter()
                r = c.post(f"/api/analyses/{t}", json=body).json()["result"]
                times.append(time.perf_counter() - t0)
                status = f"{r['status']}/{r['status_code']}"
                assert r["status"] != "INPUT_INVALID", r["diagnostics"]
            worst[t] = max(worst[t], max(times))
            print(f"{case:4} {t:3} {status:28} max {max(times):.4f} s  min {min(times):.4f} s")
    print("worst per type:", {k: round(v, 4) for k, v in worst.items()})
    return 0


def main(argv: list[str]) -> int:
    if argv[:1] == ["--inner"]:
        return inner(int(argv[1]))
    repeats = argv[0] if argv else "10"
    cmd = [uv(), "run", "--project", str(BACKEND), "python", __file__, "--inner", repeats]
    return subprocess.call(cmd, cwd=BACKEND)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
