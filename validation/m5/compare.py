"""Comparison under the frozen tolerance policy (Doc 13 §6, Eq. 13.5-13.6)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

HERE = Path(__file__).parent


def load_policy(version: int = 1) -> dict[str, Any]:
    """The policy file must match its locked hash (Doc 13 §6 Freeze, work package 1.6.2)."""
    raw = (HERE / f"policy_v{version}.json").read_bytes().replace(b"\r\n", b"\n")  # git eol
    lock = (HERE / f"policy_v{version}.sha256").read_text(encoding="ascii").split()[0]
    if hashlib.sha256(raw).hexdigest() != lock:
        raise RuntimeError(f"policy_v{version}.json changed after it was locked: new version only")
    policy: dict[str, Any] = json.loads(raw)
    policy["sha256"] = lock
    return policy


def within(a: float, p: float, eps_abs: float, eps_rel: float) -> bool:
    """Eq. 13.5: pass iff |a - p| <= eps_abs + eps_rel |p|."""
    return abs(a - p) <= eps_abs + eps_rel * abs(p)


def final_value(t: np.ndarray, y: np.ndarray, window_s: float) -> float:
    return float(np.mean(y[t >= t[-1] - window_s]))


def steady(
    engine: dict[str, float], psim: dict[str, np.ndarray], policy: dict[str, Any], layer: int
) -> list[dict[str, Any]]:
    """Engine M1 values against PSIM final values (mean over the steady window)."""
    rows = []
    for name, a in engine.items():
        rule = policy["steady"][name.split("_", 1)[0]]
        if name not in psim:
            rows.append({"quantity": name, "engine": a, "psim": None, "verdict": "NOT_EXPORTED"})
            continue
        p = final_value(psim["time"], psim[name], policy["steady_window_s"])
        tol = rule[f"layer{layer}"]
        verdict = "REPORTED" if tol is None else ("PASS" if within(a, p, *tol) else "FAIL")
        rows.append(
            {
                "quantity": name,
                "unit": rule["unit"],
                "engine": a,
                "psim": p,
                "e_abs": abs(a - p),
                "verdict": verdict,
            }
        )
    return rows


def nrmse(a: np.ndarray, p: np.ndarray, p_pre: float) -> float:
    """Eq. 13.6. Infinite when PSIM does not move (no excursion to normalise by)."""
    span = float(np.max(np.abs(p - p_pre)))
    rmse = float(np.sqrt(np.mean((a - p) ** 2)))
    return rmse / span if span > 0 else float("inf")


def settling_time(
    t: np.ndarray, y: np.ndarray, t0: float, band: float, window_s: float
) -> float | None:
    """Time after `t0` from which `y` stays within `band` of its final value; None when the
    final window itself is not inside the band (not settled, Doc 13 §6)."""
    yf = final_value(t, y, window_s)
    out = np.abs(y - yf) > band
    if np.any(out[t >= t[-1] - window_s]):
        return None
    after = (t >= t0) & out
    return float(t[after][-1] - t0) if np.any(after) else 0.0


def series(
    engine: dict[str, np.ndarray],
    psim: dict[str, np.ndarray],
    t0: float,
    policy: dict[str, Any],
    layer: int,
) -> list[dict[str, Any]]:
    """NRMSE and settling time per signal on the engine grid (aligned at the disturbance t0)."""
    from m5.psim import resample

    t = engine["time"]
    st = policy["settling"]
    rows = []
    for name, a in engine.items():
        if name == "time" or name.startswith("A_"):
            continue
        if name not in psim:
            rows.append({"quantity": name, "verdict": "NOT_EXPORTED"})
            continue
        p = resample(psim, name, t)
        p_pre = float(p[t < t0][-1])
        e = nrmse(a, p, p_pre)
        row: dict[str, Any] = {
            "quantity": name,
            "nrmse": e,
            "nrmse_pass": e <= policy["nrmse"][f"layer{layer}"],
        }
        band = {"f": st["frequency_band_hz"], "V": st["voltage_band_v"]}.get(name[0])
        if band is not None:
            ta = settling_time(t, a, t0, band, st["window_s"])
            tp = settling_time(t, p, t0, band, st["window_s"])
            row |= {"settling_engine_s": ta, "settling_psim_s": tp}
            if ta is not None and tp is not None:
                row["settling_pass"] = within(ta, tp, *policy["settling_time"][f"layer{layer}"])
            else:  # categorical: both settle or neither
                row["settling_pass"] = (ta is None) == (tp is None)
        rows.append(row)
    return rows
