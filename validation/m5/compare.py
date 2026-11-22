"""Comparison under the frozen tolerance policy (Doc 13 §6, Eq. 13.5-13.6)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np

HERE = Path(__file__).parent


def load_policy(version: int = 2) -> dict[str, Any]:
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
    v_nom_ll_v: float = 440.0,
) -> list[dict[str, Any]]:
    """NRMSE, settling time and nadir/peak per signal on the engine grid (aligned at t0)."""
    from m5.psim import resample

    t = engine["time"]
    st = policy["settling"]
    ext = policy.get("extreme", {})
    rows = []
    for name, a in engine.items():
        if name == "time" or name.startswith("A_"):
            continue
        if name not in psim:
            rows.append({"quantity": name, "verdict": "NOT_EXPORTED"})
            continue
        p = resample(psim, name, t)
        p_pre = float(p[t < t0][-1])
        ok = np.isfinite(a)  # a tripped inverter has no frequency after the trip (TS-02)
        e = nrmse(a[ok], p[ok], p_pre)
        row: dict[str, Any] = {
            "quantity": name,
            "nrmse": e,
            "nrmse_pass": e <= policy["nrmse"][f"layer{layer}"],
        }
        band = {"f": st["frequency_band_hz"], "V": st["voltage_band_v"]}.get(name[0])
        if band is not None and ok.all():
            ta = settling_time(t, a, t0, band, st["window_s"])
            tp = settling_time(t, p, t0, band, st["window_s"])
            row |= {"settling_engine_s": ta, "settling_psim_s": tp}
            if ta is not None and tp is not None:
                row["settling_pass"] = within(ta, tp, *policy["settling_time"][f"layer{layer}"])
            else:  # categorical: both settle or neither
                row["settling_pass"] = (ta is None) == (tp is None)
        rule = ext.get(name[0])
        if rule is not None and ok.all():  # nadir or peak: the largest excursion after t0
            post = t >= t0
            xa = a[post][np.argmax(np.abs(a[post] - a[t < t0][-1]))]
            xp = p[post][np.argmax(np.abs(p[post] - p_pre))]
            tol = rule[f"layer{layer}"] * (v_nom_ll_v if name[0] == "V" else 1.0)
            row |= {"extreme_engine": float(xa), "extreme_psim": float(xp)}
            row["extreme_pass"] = abs(xa - xp) <= tol
        rows.append(row)
    return rows


def eig(
    psim_y: np.ndarray, dt: float, m4a_payload: dict[str, Any], policy: dict[str, Any], layer: int
) -> dict[str, Any]:
    """PSIM dominant mode against the M4a dominant eigenvalue (Doc 13 §5 SM rules). On D2-AB the
    window is the growth phase wherever it starts (user decision 2026-11-21, D-123)."""
    from m5 import mpencil

    k = m4a_payload["dominant_modes"][0]["eigenvalue_index"]
    lam = m4a_payload["eigenvalues"][k]
    sigma, freq = lam["real_per_s"], abs(lam["imag_per_s"]) / (2 * np.pi)
    zeta = -sigma / float(np.hypot(sigma, lam["imag_per_s"]))
    p = mpencil.dominant(psim_y - psim_y[-1], dt, policy["mode"]["trust"])
    out: dict[str, Any] = {"m4a": {"sigma_per_s": sigma, "freq_hz": freq, "zeta": zeta}, "psim": p}
    if not p["mode"]:
        return out | {"verdict": "NO_MODE"}
    m, tol, ly = p["mode"], policy["mode"], f"layer{layer}"
    out["checks"] = {
        "sigma": within(sigma, m["sigma_per_s"], *tol["decay_rate"][ly]),
        "freq": within(freq, m["freq_hz"], *tol["damped_frequency"][ly]),
        "zeta": abs(zeta - m["zeta"]) <= tol["damping_ratio"][ly],
    }
    ok = all(out["checks"].values())
    out["verdict"] = "UNTRUSTED_FIT" if not p["trusted"] else "PASS" if ok else "FAIL"
    return out


def transient_class(
    sig: dict[str, np.ndarray],
    t0: float,
    settling: dict[str, float],
    constraints: dict[str, Any],
    v_nom_ll_v: float,
) -> str:
    """The engine's M4b class rule (mgengine.m4b._report, Doc 3 §6.9) on one set of series:
    `f_sys` and every `V_<bus>` (V LL). Settled when both stay inside their band around the final
    value over the final window; then CRITERIA_VIOLATED if any sample from `t0` on leaves a design
    limit (an empty limit is skipped), else RECOVERED_STABLE. Not settled is UNSTABLE."""
    t = sig["time"]
    win = t >= t[-1] - settling["window_s"]
    v = [y for k, y in sig.items() if k.startswith("V_")]
    bands = [(sig["f_sys"], settling["frequency_band_hz"])] + [
        (y, settling["voltage_band_v"]) for y in v
    ]
    if not all(np.all(np.abs(y[win] - y[-1]) <= b) for y, b in bands):
        return "UNSTABLE"
    post = t >= t0
    c = constraints
    checks = [(sig["f_sys"], c.get("frequency_min_hz"), c.get("frequency_max_hz"))]
    lo = None if c.get("voltage_min_pu") is None else c["voltage_min_pu"] * v_nom_ll_v
    hi = None if c.get("voltage_max_pu") is None else c["voltage_max_pu"] * v_nom_ll_v
    checks += [(y, lo, hi) for y in v]
    for y, lo_, hi_ in checks:  # tolerance 1e-12 + 1e-9 |bound|, as the engine (4.11)
        if lo_ is not None and np.any(y[post] < lo_ - (1e-12 + 1e-9 * abs(lo_))):
            return "CRITERIA_VIOLATED"
        if hi_ is not None and np.any(y[post] > hi_ + (1e-12 + 1e-9 * abs(hi_))):
            return "CRITERIA_VIOLATED"
    return "RECOVERED_STABLE"


def mode(
    engine: np.ndarray, psim: np.ndarray, dt: float, policy: dict[str, Any], layer: int
) -> dict[str, Any]:
    """Dominant mode of the same window in both tools (Doc 13 §5 SM rules), deviation from the
    final value removed; tolerances of §6 on decay (or growth) rate, damped frequency, damping."""
    from m5 import mpencil

    tr, tol = policy["mode"]["trust"], policy["mode"]
    a = mpencil.dominant(engine - engine[-1], dt, tr)
    p = mpencil.dominant(psim - psim[-1], dt, tr)
    out: dict[str, Any] = {"engine": a, "psim": p}
    if not (a["mode"] and p["mode"]):
        return out | {"verdict": "NO_MODE"}
    ma, mp, ly = a["mode"], p["mode"], f"layer{layer}"
    out["checks"] = {
        "sigma": within(ma["sigma_per_s"], mp["sigma_per_s"], *tol["decay_rate"][ly]),
        "freq": within(ma["freq_hz"], mp["freq_hz"], *tol["damped_frequency"][ly]),
        "zeta": abs(ma["zeta"] - mp["zeta"]) <= tol["damping_ratio"][ly],
    }
    trusted = a["trusted"] and p["trusted"]
    out["verdict"] = (
        "UNTRUSTED_FIT" if not trusted else "PASS" if all(out["checks"].values()) else "FAIL"
    )
    return out
