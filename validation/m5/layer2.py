"""Layer-2 inverter parameters (Doc 13 §7): the Pogaku et al. 2007 Table I inverter scaled in p.u.

Source values, read 2026-11-21 from the PDF (IEEE TPEL 22(2), p. 621, Table I; 10 kVA,
220 V phase, 380 V LL, 50 Hz): fs 8 kHz, Lf 1.35 mH, Cf 50 uF, rf 0.1 ohm, Lc 0.35 mH,
rLc 0.03 ohm, Kpv 0.05, Kiv 390, Kpc 10.5, Kic 16e3, F 0.75. Text p. 621: voltage loop
bandwidth 400 Hz, current loop 1.6 kHz, continuous-domain gains.

Scaling (Doc 13 §7): L, C, R keep their p.u. value on Z_b = V_LL^2 / S_n (Liserre 2005 Eq. 5-6).
Gains are not copied: with the plant identical in p.u., the same closed-loop bandwidths need the
voltage-loop gains (A/V) scaled by Z_b,src / Z_b and the current-loop gains (V/A) by
Z_b / Z_b,src. Delay: asymmetric regular sampled PWM, T_d = 0.75 carrier periods (Holmes 2009
p. 2420, Fig. 4); with single-update sampling (1.5 sample periods = 1.5 carrier periods,
Liserre 2005 p. 1286) the scaled current loop has no phase margin, see `current_loop_margin`.
"""

from __future__ import annotations

import math
from typing import Any

SOURCE = {"s_va": 10e3, "v_ll": 380.0, "f_hz": 50.0}
POGAKU = {
    "fs_hz": 8e3,
    "lf_h": 1.35e-3,
    "cf_f": 50e-6,
    "rf_ohm": 0.1,
    "lc_h": 0.35e-3,
    "rlc_ohm": 0.03,
    "kpv": 0.05,
    "kiv": 390.0,
    "kpc": 10.5,
    "kic": 16e3,
    "f_ff": 0.75,
    "f_bw_v_hz": 400.0,
}
TD_CARRIER = 0.75  # Holmes 2009: transport 0.25 + sampling 0.5 carrier periods
# Doc 13 §7, Q39: reference-saturation limiter; 1.5 p.u. = TRUMPF AC 3025 overload 150 % for
# 1 min (manual pp. 17-18), which covers the 5 s TS runs. Circular limit on |i_dq*| with
# anti-windup on the voltage-loop integrators (Baeckeland 2024, Sec. VIII).
I_LIMIT_PU = 1.5


def z_base(s_va: float, v_ll: float) -> float:
    return v_ll**2 / s_va


def scaled(s_va: float, v_ll: float, f_hz: float) -> dict[str, float]:
    """Layer-2 values for one inverter of rating `s_va` at `v_ll`, `f_hz`."""
    k = z_base(s_va, v_ll) / z_base(SOURCE["s_va"], SOURCE["v_ll"])  # Z_b / Z_b,src
    kf = SOURCE["f_hz"] / f_hz  # L and C in p.u. depend on omega
    p = POGAKU
    i_base = s_va / (math.sqrt(3) * v_ll)
    return {
        "fs_hz": p["fs_hz"],
        "td_s": TD_CARRIER / p["fs_hz"],
        "lf_h": p["lf_h"] * k * kf,
        "cf_f": p["cf_f"] / k * kf,
        "rf_ohm": p["rf_ohm"] * k,
        "lc_h": p["lc_h"] * k * kf,
        "rlc_ohm": p["rlc_ohm"] * k,
        "kpv": p["kpv"] / k,
        "kiv": p["kiv"] / k,
        "kpc": p["kpc"] * k,
        "kic": p["kic"] * k,
        "f_ff": p["f_ff"],
        "tau_in_s": 1 / (2 * math.pi * p["f_bw_v_hz"]),  # Doc 13 §7
        "i_limit_a_rms": I_LIMIT_PU * i_base,
    }


def bridge_current_a(
    p_w: float, q_var: float, v_ll_v: float, l2: dict[str, float], f_hz: float
) -> float:
    """Inverter-side (Lf) RMS current, the current the limiter acts on, from the terminal
    P, Q and voltage: I_o at the terminal, back through Lc to the capacitor, plus I_Cf."""
    w = 2 * math.pi * f_hz
    vt = v_ll_v / math.sqrt(3)
    io = complex(p_w, q_var).conjugate() / 3 / vt
    vc = vt + complex(l2["rlc_ohm"], w * l2["lc_h"]) * io
    return abs(io + 1j * w * l2["cf_f"] * vc)


def limiter_prediction(record: dict[str, Any]) -> list[dict[str, Any]]:
    """Peak inverter-side current per inverter over an engine M4b run, against the layer-2
    limit (Doc 13 §5: limiter engagement predicted from the engine before PSIM runs)."""
    snap, pay = record["snapshot"], record["result"]["payload"]
    v_ll, f_n = snap["nominal_voltage_kv"] * 1e3, snap["nominal_frequency_hz"]
    bus_v = {s["bus_id"]: s["values"] for s in pay["bus_voltage_kv"]}
    p = {s["inverter_id"]: s["values"] for s in pay["inverter_p_kw"]}
    q = {s["inverter_id"]: s["values"] for s in pay["inverter_q_kvar"]}
    rows = []
    for inv in snap["inverters"]:
        l2 = scaled(inv["rated_kva"] * 1e3, v_ll, f_n)
        series = zip(pay["time_s"], p[inv["id"]], q[inv["id"]], bus_v[inv["bus_id"]], strict=True)
        ti = [
            (t, bridge_current_a(pk * 1e3, qk * 1e3, vk * 1e3, l2, f_n))
            for t, pk, qk, vk in series
            if vk > 0
        ]
        i = [x for _, x in ti]
        peak = max(i)
        over = [t for t, x in ti if x > l2["i_limit_a_rms"]]
        rows.append(
            {
                "inverter_id": inv["id"],
                "start_a": i[0],
                "peak_a": peak,
                "limit_a": l2["i_limit_a_rms"],
                "engages": bool(over),
                "first_over_s": over[0] if over else None,
            }
        )
    return rows


def current_loop_margin(lf_h: float, rf_ohm: float, kpc: float, kic: float, td_s: float) -> float:
    """Phase margin (deg) of the PI current loop on Lf with delay `td_s` (Holmes 2009 Eq. 18),
    crossover taken where |kpc / (j w Lf)| = 1."""
    wc = kpc / lf_h
    tau_i = kpc / kic
    ph = math.atan(wc * tau_i) - math.pi / 2 - wc * td_s - math.atan(wc * lf_h / rf_ohm)
    return math.degrees(ph + math.pi)
