"""Input sheet from a REAL RunRecord (Doc 13 §3, §8 step 5): never hand-copied.

The sheet carries every PSIM value with its source, the M1 initial state and the export
convention for the PSIM signals. `psim_params` renders it as a PSIM parameter file
(`name = value` lines) for the Parameter File element.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from m5 import layer2


class RefusedRecordError(ValueError):
    pass


def _check(record: dict[str, Any]) -> None:
    if record.get("engine_kind") != "REAL":
        raise RefusedRecordError(f"engine_kind {record.get('engine_kind')!r}: only REAL records")
    if record["result"].get("status_code") != "OK":
        raise RefusedRecordError(
            f"result {record['result'].get('status_code')!r}: no operating point"
        )


def _m1_payload(record: dict[str, Any]) -> dict[str, Any]:
    if record["analysis_type"] == "M1":
        return record["result"]["payload"]  # type: ignore[no-any-return]
    dep = record.get("depends_on") or {}
    if dep.get("analysis_type") != "M1" or not dep.get("result_payload"):
        raise RefusedRecordError("record carries no M1 operating point")
    return dep["result_payload"]  # type: ignore[no-any-return]


def input_sheet(record: dict[str, Any], with_layer2: bool = False) -> dict[str, Any]:
    _check(record)
    snap = record["snapshot"]
    v_ll = snap["nominal_voltage_kv"] * 1e3
    f_n = snap["nominal_frequency_hz"]
    w = 2 * math.pi * f_n
    m1 = _m1_payload(record)
    inverters = []
    for inv in snap["inverters"]:
        row = {
            "id": inv["id"],
            "bus_id": inv["bus_id"],
            "rated_va": inv["rated_kva"] * 1e3,
            "v_star_phase_v": inv["voltage_setpoint_kv"] * 1e3 / math.sqrt(3),
            "w_star_rad_s": 2 * math.pi * inv["frequency_setpoint_hz"],
            "mp_rad_s_per_w": 2 * math.pi * 1e-3 * inv["frequency_droop_hz_per_kw"],
            "nq_v_per_var": inv["voltage_droop_kv_per_kvar"] / math.sqrt(3),  # Doc 9 D-54 K74
            "p_star_w": inv["p_setpoint_kw"] * 1e3,
            "q_star_var": inv["q_setpoint_kvar"] * 1e3,
            "tau_p_s": inv["tau_p_s"],
            "tau_q_s": inv["tau_q_s"],
        }
        if with_layer2:
            l2 = layer2.scaled(row["rated_va"], v_ll, f_n)
            # Doc 13 §7: a layer-2 case must not start in current limit (as layer 1, §3)
            op = next(i for i in m1["inverter_results"] if i["inverter_id"] == inv["id"])
            vb = next(b for b in m1["bus_results"] if b["bus_id"] == inv["bus_id"])
            i0 = layer2.bridge_current_a(
                op["p_kw"] * 1e3, op["q_kvar"] * 1e3, vb["voltage_kv"] * 1e3, l2, f_n
            )
            if i0 >= l2["i_limit_a_rms"]:
                raise RefusedRecordError(f"{inv['id']} starts in current limit ({i0:.1f} A)")
            row["layer2"] = l2
            row["layer2_start_current_a"] = i0
        inverters.append(row)
    lines = []
    for ln in snap["lines"]:
        kind = ln.get("kind", "CABLE")  # a REACTOR is stored per km over 1 m (ADR-017)
        r = ln["r_ohm_per_km"] * ln["length_km"]
        lh = ln["x_ohm_per_km"] * ln["length_km"] / w
        lines.append(
            {
                "id": ln["id"],
                "from": ln["from_bus_id"],
                "to": ln["to_bus_id"],
                "kind": kind,
                "r_ohm": r,
                "l_h": lh,
            }
        )
    loads = [
        {
            "id": ld["id"],
            "bus_id": ld["bus_id"],
            "p_w": ld["p_kw"] * 1e3,
            "q_var": ld["q_kvar"] * 1e3,
        }
        for ld in snap["loads"]
    ]
    sheet: dict[str, Any] = {
        "sheet_version": 1,
        "source": {
            k: record[k]
            for k in (
                "record_id",
                "analysis_type",
                "snapshot_hash",
                "result_hash",
                "engine_version",
                "engine_kind",
            )
        },
        "parameters": record.get("parameters"),
        "system": {"v_ll_v": v_ll, "f_hz": f_n, "w_rad_s": w},
        "inverters": inverters,
        "lines": lines,
        "loads": loads,
        "initial_state": {
            "f_hz": m1["system_frequency_hz"],
            "bus": {
                b["bus_id"]: {"v_ll_v": b["voltage_kv"] * 1e3, "angle_deg": b["angle_deg"]}
                for b in m1["bus_results"]
            },
            "inverter": {
                i["inverter_id"]: {"p_w": i["p_kw"] * 1e3, "q_var": i["q_kvar"] * 1e3}
                for i in m1["inverter_results"]
            },
            "line_current_a": {ln["line_id"]: ln["current_a"] for ln in m1["line_results"]},
        },
        "psim_signals": SIGNALS,
    }
    if with_layer2:
        sheet["layer2_hash"] = hashlib.sha256(
            json.dumps([i["layer2"] for i in inverters], sort_keys=True).encode()
        ).hexdigest()
    return sheet


# Export convention for the PSIM CSV (Doc 13 §10): column prefix, id, SI unit.
SIGNALS = {
    "f_sys": "Hz, mean commanded frequency of the inverters in service (engine M4b, K68)",
    "f_<inverter>": "Hz, commanded frequency (not a PLL)",
    "P_<inverter>": "W, three-phase total (Eq. 13.4)",
    "Q_<inverter>": "VAR, three-phase total (Eq. 13.4)",
    "V_<bus>": "V, line-to-line RMS",
    "A_<bus>": "deg, referred to the first bus",
    "I_<line>": "A, phase RMS",
}


def psim_params(sheet: dict[str, Any]) -> str:
    """PSIM parameter file: one `name = value` per line, names `<field>_<id>`."""
    out = [f"// M5 input sheet from {sheet['source']['record_id']} (do not edit by hand)"]
    out.append(f"Vll = {sheet['system']['v_ll_v']:.10g}")
    out.append(f"fn = {sheet['system']['f_hz']:.10g}")
    for inv in sheet["inverters"]:
        for k, v in inv.items():
            if isinstance(v, int | float):
                out.append(f"{k}_{inv['id']} = {v:.10g}")
        for k, v in inv.get("layer2", {}).items():
            out.append(f"{k}_{inv['id']} = {v:.10g}")
    for ln in sheet["lines"]:
        out += [f"r_{ln['id']} = {ln['r_ohm']:.10g}", f"l_{ln['id']} = {ln['l_h']:.10g}"]
    for ld in sheet["loads"]:
        out += [f"p_{ld['id']} = {ld['p_w']:.10g}", f"q_{ld['id']} = {ld['q_var']:.10g}"]
    # Initial state (Doc 13 §3): the M1 equilibrium, the run starts flat; P_f(0) = P0, Q_f(0) = Q0
    ini = sheet["initial_state"]
    out.append(f"f0 = {ini['f_hz']:.10g}")
    for inv in sheet["inverters"]:
        i0, bus = ini["inverter"][inv["id"]], ini["bus"][inv["bus_id"]]
        out += [
            f"P0_{inv['id']} = {i0['p_w']:.10g}",
            f"Q0_{inv['id']} = {i0['q_var']:.10g}",
            f"theta0_{inv['id']} = {math.radians(bus['angle_deg']):.10g}",  # rad, first bus = 0
        ]
    for b, v in ini["bus"].items():
        out.append(f"V0_{b} = {v['v_ll_v']:.10g}")
    out += [f"I0_{k} = {v:.10g}" for k, v in ini["line_current_a"].items()]
    out += _disturbance(sheet.get("parameters") or {})
    return "\n".join(out) + "\n"


def _disturbance(params: dict[str, Any]) -> list[str]:
    """M4b disturbance in SI units, as the engine applies it (mgapp studies._magnitude)."""
    d = params.get("disturbance")
    if not d:
        return []
    out = [f"t_dist = {d['start_time_s']:.10g}", f"t_end = {params['simulation_end_s']:.10g}"]
    if d.get("duration_s") is not None and d["kind"] != "INVERTER_OUTAGE":
        out.append(f"t_dist_end = {d['start_time_s'] + d['duration_s']:.10g}")
    eid, x = d["element_id"], float(d.get("magnitude") or 0.0)
    if d["kind"] == "LOAD_STEP":
        out += [
            f"dp_{eid} = {x * 1e3:.10g}",
            f"dq_{eid} = {float(d.get('magnitude_kvar') or 0) * 1e3:.10g}",
        ]
    elif d["kind"] == "LOAD_SCALING":
        out.append(f"scale_{eid} = {x:.10g}")
    elif d["kind"] == "INVERTER_OUTAGE":
        out.append(f"trip_{eid} = 1")
    else:  # REFERENCE_STEP
        ref = d["reference"]
        si = {"P_SETPOINT": 1e3, "Q_SETPOINT": 1e3, "V_SETPOINT": 1e3 / math.sqrt(3),
              "F_SETPOINT": 2 * math.pi}[ref]  # fmt: skip
        name = {"P_SETPOINT": "dp_star", "Q_SETPOINT": "dq_star", "V_SETPOINT": "dv_star_phase",
                "F_SETPOINT": "dw_star"}[ref]  # fmt: skip
        out.append(f"{name}_{eid} = {x * si:.10g}")
    return out
