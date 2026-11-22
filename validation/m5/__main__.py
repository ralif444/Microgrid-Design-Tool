"""CLI (Doc 13 §8 steps 5-7).

python -m m5 sheet RECORD.json OUTDIR [--layer2]   input sheet JSON + PSIM parameter file
python -m m5 steady M1_RECORD.json PSIM.csv LAYER  Eq. 13.5 per quantity
python -m m5 series M4B_RECORD.json PSIM.csv LAYER NRMSE and settling per signal
python -m m5 class M4B_RECORD.json PSIM.csv        transient class, engine rule on the PSIM run
python -m m5 mode M4B_RECORD.json PSIM.csv LAYER [SIGNAL] [UNTIL_S]
                                                   dominant mode after the step (SM cases);
                                                   UNTIL_S ends the fit window (D2-AB: first
                                                   predicted limiter crossing, Doc 13 §5)
python -m m5 eig M4A_RECORD.json PSIM.csv LAYER SIGNAL T_FROM T_TO
                                                   PSIM mode in [T_FROM, T_TO] against the M4a
                                                   dominant eigenvalue (D2-AB growth window)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

from m5 import compare, psim, sheet


def main(argv: list[str]) -> int:
    cmd, rec_path, *rest = argv
    rec = json.loads(Path(rec_path).read_text(encoding="utf-8"))
    if cmd == "sheet":
        odir = Path(rest[0])
        odir.mkdir(parents=True, exist_ok=True)
        s = sheet.input_sheet(rec, with_layer2="--layer2" in rest)
        (odir / "sheet.json").write_text(json.dumps(s, indent=1), encoding="utf-8")
        (odir / "params.txt").write_text(sheet.psim_params(s), encoding="utf-8")
        return 0
    sheet.input_sheet(rec)  # same refusal rules (REAL, OK) before any comparison
    data, policy = psim.read_psim(rest[0]), compare.load_policy()
    payload = rec["result"]["payload"]
    out: dict[str, object] = {"policy_sha256": policy["sha256"]}
    if cmd == "steady":
        data = psim.add_derived(data, rec["snapshot"])
        out["rows"] = compare.steady(psim.m1_values(payload), data, policy, int(rest[1]))
    elif cmd == "series":
        t0 = rec["parameters"]["disturbance"]["start_time_s"]
        v_nom = rec["snapshot"]["nominal_voltage_kv"] * 1e3
        eng = psim.engine_series(payload)
        out["rows"] = compare.series(eng, data, t0, policy, int(rest[1]), v_nom)
    elif cmd == "eig":
        layer, name, t_from, t_to = int(rest[1]), rest[2], float(rest[3]), float(rest[4])
        dt = 2.5e-3  # the engine output step tau/20 (Doc 13 §5)
        t = np.arange(t_from, t_to + 1e-12, dt)
        out |= {"signal": name, "window_s": [t_from, float(t[-1])]}
        out |= compare.eig(psim.resample(data, name, t), dt, payload, policy, layer)
    elif cmd == "class":
        p = rec["parameters"]
        t0, end = p["disturbance"]["start_time_s"], p["simulation_end_s"]
        dt = payload["time_s"][1] - payload["time_s"][0]  # engine output step, tau/20
        if data["time"][-1] < end - dt:  # PSIM stopped: a set-up error or a blow-up, look at it
            out |= {"engine": payload["transient_class"], "psim": "RUN_ENDED_EARLY"}
            print(json.dumps(out, indent=1))
            return 1
        t = np.arange(0.0, min(end, data["time"][-1]) + 1e-12, dt)
        sig = {"time": t} | {
            k: psim.resample(data, k, t) for k in data if k == "f_sys" or k.startswith("V_")
        }
        snap = rec["snapshot"]
        cls = compare.transient_class(
            sig, t0, policy["settling"], snap.get("design_constraints") or {},
            snap["nominal_voltage_kv"] * 1e3,
        )  # fmt: skip
        eng = payload["transient_class"]
        out |= {"engine": eng, "psim": cls, "match": eng == cls}
    elif cmd == "mode":
        layer, name = int(rest[1]), rest[2] if len(rest) > 2 else "f_INV1"
        eng = psim.engine_series(payload)
        t0 = rec["parameters"]["disturbance"]["start_time_s"]
        until = float(rest[3]) if len(rest) > 3 else float(eng["time"][-1])
        w = (eng["time"] >= t0) & (eng["time"] <= until)
        t = eng["time"][w]
        out |= {"signal": name, "window_s": [float(t[0]), float(t[-1])]}
        out |= compare.mode(eng[name][w], psim.resample(data, name, t), t[1] - t[0], policy, layer)
    else:
        raise SystemExit(f"unknown command {cmd!r}")
    print(json.dumps(out, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
