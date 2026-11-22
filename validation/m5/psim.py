"""PSIM export import and resampling onto the engine grid (Doc 13 §5 output alignment)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np


def read_psim(path: str | Path) -> dict[str, np.ndarray]:
    """SIMVIEW export: header row of names, then numbers; comma or whitespace separated."""
    lines = [ln for ln in Path(path).read_text(encoding="utf-8").splitlines() if ln.strip()]
    sep = "," if "," in lines[0] else None
    names = [n.strip() for n in lines[0].split(sep)]
    data = np.array([[float(x) for x in ln.split(sep)] for ln in lines[1:]])
    if data.ndim != 2 or data.shape[1] != len(names):
        raise ValueError(f"{path}: {len(names)} names but rows of {data.shape[-1]} values")
    cols = {n: data[:, i] for i, n in enumerate(names)}
    t = next((n for n in names if n.lower() == "time"), None)
    if t is None:
        raise ValueError(f"{path}: no Time column")
    cols["time"] = cols.pop(t)
    if np.any(np.diff(cols["time"]) <= 0):
        raise ValueError(f"{path}: time is not strictly increasing")
    return cols


def engine_grid(time_s: list[float]) -> np.ndarray:
    """Indices of the engine samples to compare: at a repeated instant (the disturbance) the
    after-step row, i.e. the last one, is kept."""
    t = np.asarray(time_s)
    return np.flatnonzero(np.append(np.diff(t) > 0, True))


def resample(psim: dict[str, np.ndarray], name: str, t_engine: np.ndarray) -> np.ndarray:
    t = psim["time"]
    if t_engine[0] < t[0] or t_engine[-1] > t[-1]:
        raise ValueError(f"PSIM run {t[0]}..{t[-1]} s does not cover {t_engine[0]}..{t_engine[-1]}")
    return np.interp(t_engine, t, psim[name])


def engine_series(payload: dict[str, Any]) -> dict[str, np.ndarray]:
    """M4b payload in the PSIM signal names and SI units of `sheet.SIGNALS`, on `engine_grid`."""
    keep = engine_grid(payload["time_s"])
    out = {"time": np.asarray(payload["time_s"])[keep]}
    out["f_sys"] = np.asarray(payload["system_frequency_hz"])[keep]
    groups = (
        ("inverter_frequency_hz", "f", "inverter_id", 1.0),
        ("inverter_p_kw", "P", "inverter_id", 1e3),
        ("inverter_q_kvar", "Q", "inverter_id", 1e3),
        ("bus_voltage_kv", "V", "bus_id", 1e3),
        ("bus_angle_deg", "A", "bus_id", 1.0),
        ("line_current_a", "I", "line_id", 1.0),
    )
    for key, prefix, idk, scale in groups:
        for s in payload.get(key) or []:
            # None (a tripped inverter's frequency, TS-02) becomes NaN
            out[f"{prefix}_{s[idk]}"] = np.asarray(s["values"], dtype=float)[keep] * scale
    return out


def m1_values(payload: dict[str, Any]) -> dict[str, float]:
    """M1 operating point in the same names and units."""
    out = {"f_sys": payload["system_frequency_hz"]}
    out |= {
        f"f_{i['inverter_id']}": payload["system_frequency_hz"] for i in payload["inverter_results"]
    }
    for i in payload["inverter_results"]:
        out[f"P_{i['inverter_id']}"] = i["p_kw"] * 1e3
        out[f"Q_{i['inverter_id']}"] = i["q_kvar"] * 1e3
    for b in payload["bus_results"]:
        out[f"V_{b['bus_id']}"] = b["voltage_kv"] * 1e3
        out[f"A_{b['bus_id']}"] = b["angle_deg"]
    for ln in payload["line_results"]:
        out[f"I_{ln['line_id']}"] = ln["current_a"]
    # policy v2 rows (Doc 13 §6): S, loading and P sharing per inverter, losses per line and total
    p_tot = sum(i["p_kw"] for i in payload["inverter_results"])
    for i in payload["inverter_results"]:
        out[f"S_{i['inverter_id']}"] = i["s_kva"] * 1e3
        out[f"loading_{i['inverter_id']}"] = i["loading_ratio"]
        out[f"share_{i['inverter_id']}"] = 100 * i["p_kw"] / p_tot
    for ln in payload["line_results"]:
        out[f"loss_{ln['line_id']}"] = ln["losses_kw"] * 1e3
    out["loss_total"] = payload["total_losses_kw"] * 1e3
    return out


def add_derived(cols: dict[str, np.ndarray], snap: dict[str, Any]) -> dict[str, np.ndarray]:
    """S, loading, P sharing and losses from the exported P, Q and I, with the ratings and line
    resistances of the snapshot (the same R as the PSIM model), so PSIM exports nothing extra."""
    out = dict(cols)
    invs = [i for i in snap["inverters"] if f"P_{i['id']}" in cols and f"Q_{i['id']}" in cols]
    p_tot = sum(cols[f"P_{i['id']}"] for i in invs)
    for i in invs:
        p, q = cols[f"P_{i['id']}"], cols[f"Q_{i['id']}"]
        out[f"S_{i['id']}"] = np.hypot(p, q)
        out[f"loading_{i['id']}"] = out[f"S_{i['id']}"] / (i["rated_kva"] * 1e3)
        if len(invs) == len(snap["inverters"]):
            out[f"share_{i['id']}"] = 100 * p / p_tot
    losses = []
    for ln in snap["lines"]:
        if f"I_{ln['id']}" in cols:
            r = ln["r_ohm_per_km"] * ln["length_km"]
            out[f"loss_{ln['id']}"] = 3 * cols[f"I_{ln['id']}"] ** 2 * r
            losses.append(out[f"loss_{ln['id']}"])
    if losses and len(losses) == len(snap["lines"]):
        out["loss_total"] = sum(losses)
    return out
