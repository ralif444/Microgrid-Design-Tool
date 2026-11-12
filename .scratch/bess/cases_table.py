"""Prints the framework §4 step-5 table (hand value, tool value, difference) for V1, V3 - V6 on REAL.

    uv run --project backend python .scratch/bess/cases_table.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).parents[2]
sys.path[:0] = [str(ROOT / "tests"), str(ROOT / "tests" / "api")]

from api.conftest import SOLVER, Api  # noqa: E402
from fixtures.designs import PARAMETERS  # noqa: E402
from test_battery_cases import CASES, FIX, SET, bank, d2  # noqa: E402

from mgapp.adapters.real_engine import RealEngine  # noqa: E402

api = Api(RealEngine())
rows: list[tuple[str, str, float, float, str]] = []
ps_params = dict(PARAMETERS["PS"]) | {k: SET[k] for k in ("autonomy_h", "dc_efficiency_ratio", "depth_of_discharge_ratio")}
ps = api.post("PS", {"project_snapshot": d2(), "parameters": ps_params, "solver_config": SOLVER}).json()
e = ps["result"]["payload"]["storage_energy"]
rid = f"{ps['run_record']['record_id']} / {ps['run_record']['result_hash'][:12]}"
for k in ("e_ac_kwh", "e_dc_kwh", "e_nom_kwh"):
    rows.append(("V1", k, CASES["V1"][k], e[k], rid))
m1 = api.m1_ref(project_snapshot=d2())
for names in (("V3", "V5"), ("V4", "V6")):
    body = api.body("M1", project_snapshot=d2(), parameters={"banks": [bank(CASES[n]) for n in names], "start_hour": 0}, depends_on=m1)
    res = api.post("BA", body).json()
    rid = f"{res['run_record']['record_id']} / {res['run_record']['result_hash'][:12]}"
    for n, b in zip(names, res["result"]["payload"]["banks"], strict=True):
        c, p, a = CASES[n], b["power"], b["autonomy"]
        if n in ("V3", "V4"):
            for k in ("capability_kw", "dc_side_power_kw", "margin_kw"):
                rows.append((n, k, c[k], p[k], rid))
            rows.append((n, "outcome", c["outcome"], p["outcome"], rid))
        elif n == "V5":
            got = {"usable_energy_kwh": a["usable_energy_kwh"], "cum_kwh_at_11": a["curve"][11]["cumulative_energy_kwh"], "soc_at_11": a["curve"][11]["soc_ratio"], "autonomy_h": a["autonomy_h"], "depletion_clock_hour": a["depletion_clock_hour"], "outcome": a["outcome"]}
            rows += [(n, k, c[k], v, rid) for k, v in got.items()]
        else:
            got = {"usable_energy_kwh": a["usable_energy_kwh"], "cum_kwh_at_23": a["curve"][-1]["cumulative_energy_kwh"], "end_soc_ratio": a["end_soc_ratio"], "outcome": a["outcome"]}
            rows += [(n, k, c[k], v, rid) for k, v in got.items()]
print("| Case | Quantity | Hand (framework §3) | Tool (REAL) | Difference | Pass | RunRecord / result hash |")
print("|---|---|---|---|---|---|---|")
for n, k, hand, tool, r in rows:
    if isinstance(hand, str) or isinstance(tool, str):
        ok, diff, t = hand == tool, "—", tool
    else:
        d = tool - hand
        ok, diff, t = abs(d) <= 5e-5, f"{d:+.2e}", f"{tool:.6f}"
    print(f"| {n} | {k} | {hand} | {t} | {diff} | {'pass' if ok else 'FAIL'} | {r} |")
