"""Self-checks of the offline M5 chain on REAL D2-LR records (tools/make_validation_fixtures.py).

No PSIM output exists yet, so the engine's own series stand in as a "PSIM" export: the chain
must then pass every check exactly, and the matrix pencil on the engine's M4b ring-down must
recover the M4a eigenvalue.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pytest
from m5 import compare, layer2, mpencil, psim, sheet

FIX = Path(__file__).parent / "fixtures"


def rec(name: str) -> dict:
    return json.loads((FIX / f"d2-lr_{name}.runrecord.json").read_text(encoding="utf-8"))


def write_csv(path: Path, cols: dict[str, np.ndarray]) -> None:
    names = ["Time"] + [n for n in cols if n != "time"]
    rows = np.column_stack([cols["time"]] + [cols[n] for n in names[1:]])
    path.write_text(
        ",".join(names) + "\n" + "\n".join(",".join(f"{x:.17g}" for x in r) for r in rows)
    )


def test_fake_and_failed_records_are_refused() -> None:
    r = rec("m1")
    with pytest.raises(sheet.RefusedRecordError):
        sheet.input_sheet(r | {"engine_kind": "FAKE"})
    with pytest.raises(sheet.RefusedRecordError):
        sheet.input_sheet(r | {"result": r["result"] | {"status_code": "NO_CONVERGENCE"}})


def test_sheet_converts_units_doc13_section3() -> None:
    s = sheet.input_sheet(rec("m1"), with_layer2=True)
    inv1 = s["inverters"][0]
    assert inv1["mp_rad_s_per_w"] == pytest.approx(4.18879e-5, rel=1e-5)  # Doc 13 §3 D2 INV1
    assert inv1["nq_v_per_var"] == pytest.approx(3.38712e-4, rel=1e-5)
    assert inv1["v_star_phase_v"] == pytest.approx(254.03, abs=0.01)
    lr1 = next(ln for ln in s["lines"] if ln["id"] == "LR1")
    assert (lr1["r_ohm"], lr1["l_h"]) == pytest.approx((1.43e-3, 0.30e-3), rel=1e-9)
    assert s["initial_state"]["line_current_a"]["LR1"] == pytest.approx(23.301, abs=1e-3)  # R-1
    assert "inverter = " not in sheet.psim_params(
        s
    ) and "mp_rad_s_per_w_INV1 = " in sheet.psim_params(s)


def test_sheet_from_m4b_uses_its_m1_point() -> None:
    a, b = sheet.input_sheet(rec("m1")), sheet.input_sheet(rec("sm01_m4b"))
    assert a["initial_state"] == b["initial_state"]
    assert b["parameters"]["disturbance"]["magnitude"] == 0.815


def test_layer2_scaling_keeps_pu_and_needs_double_update() -> None:
    src = layer2.POGAKU
    d = layer2.scaled(10e3, 380.0, 50.0)  # the source unit maps onto itself
    assert d["lf_h"] == pytest.approx(src["lf_h"]) and d["kpc"] == pytest.approx(src["kpc"])
    d = layer2.scaled(50e3, 440.0, 50.0)
    f_res = 1 / (2 * math.pi * math.sqrt(d["lf_h"] * d["cf_f"]))
    assert f_res == pytest.approx(1 / (2 * math.pi * math.sqrt(1.35e-3 * 50e-6)))
    pm = layer2.current_loop_margin(d["lf_h"], d["rf_ohm"], d["kpc"], d["kic"], d["td_s"])
    assert 30 < pm < 40  # Holmes 2009 asks 40 deg; recorded as a finding in Doc 13 §7
    single = layer2.current_loop_margin(d["lf_h"], d["rf_ohm"], d["kpc"], d["kic"], 1.5 / 8e3)
    assert single < 0  # 1.5 carrier-period delay: unstable current loop


def test_policy_is_hash_locked() -> None:
    p = compare.load_policy()
    assert p["policy_version"] == 1 and len(p["sha256"]) == 64


def test_steady_chain_passes_on_identical_data(tmp_path: Path) -> None:
    policy = compare.load_policy()
    eng = psim.engine_series(rec("sm01_m4b")["result"]["payload"])
    first = {k: v[eng["time"] < 1.0] for k, v in eng.items()}  # pre-step: the M1 point
    write_csv(tmp_path / "ss.csv", first)
    rows = compare.steady(
        psim.m1_values(rec("m1")["result"]["payload"]),
        psim.read_psim(tmp_path / "ss.csv"),
        policy,
        layer=1,
    )
    assert {r["verdict"] for r in rows} <= {"PASS", "REPORTED"}
    assert len(rows) == 2 * 3 + 5 * 2 + 4  # f, P, Q per inverter; V, A per bus; I per line


def test_series_chain_and_resampling(tmp_path: Path) -> None:
    policy = compare.load_policy()
    eng = psim.engine_series(rec("sm01_m4b")["result"]["payload"])
    assert np.all(np.diff(eng["time"]) > 0)  # the duplicated disturbance instant is dropped
    fine = np.arange(0.0, 3.0 + 1e-12, 5e-4)  # a 0.5 ms PSIM export (Doc 13 §5)
    write_csv(
        tmp_path / "dr.csv",
        {"time": fine}
        | {k: np.interp(fine, eng["time"], v) for k, v in eng.items() if k != "time"},
    )
    rows = compare.series(eng, psim.read_psim(tmp_path / "dr.csv"), 1.0, policy, layer=1)
    assert all(r["nrmse"] < 1e-6 and r["nrmse_pass"] for r in rows)
    f = next(r for r in rows if r["quantity"] == "f_INV1")
    assert f["settling_pass"] and f["settling_engine_s"] == f["settling_psim_s"]


def test_matrix_pencil_on_a_known_mode() -> None:
    dt, t = 2.5e-3, np.arange(0, 2, 2.5e-3)
    y = 0.3 * np.exp(-8.6 * t) * np.cos(2 * np.pi * 6.15 * t + 0.4) + 0.01 * np.exp(-40 * t)
    d = mpencil.dominant(y, dt, {"r2_min": 0.99, "snr_min": 10})
    assert d["trusted"]
    assert d["mode"]["sigma_per_s"] == pytest.approx(-8.6, rel=1e-6)
    assert d["mode"]["freq_hz"] == pytest.approx(6.15, rel=1e-6)


def test_engine_ring_down_matches_m4a_mode() -> None:
    """SM-01 on D2-LR: the M4b frequency after the +3 % step against the M4a eigenvalue
    (-8.636 +/- j38.62 s^-1, zeta 0.218, 6.147 Hz), under the layer-1 mode tolerances."""
    policy = compare.load_policy()
    eng = psim.engine_series(rec("sm01_m4b")["result"]["payload"])
    after = eng["time"] >= 1.0
    y = eng["f_INV1"][after]
    d = mpencil.dominant(y - y[-1], 2.5e-3, policy["mode"]["trust"])
    (lam,) = [e for e in rec("m4a")["result"]["payload"]["eigenvalues"] if e["imag_per_s"] > 0][:1]
    tol = policy["mode"]
    assert d["trusted"], d
    assert compare.within(d["mode"]["sigma_per_s"], lam["real_per_s"], *tol["decay_rate"]["layer1"])
    assert compare.within(
        d["mode"]["freq_hz"], lam["imag_per_s"] / (2 * math.pi), *tol["damped_frequency"]["layer1"]
    )


def test_bridge_current_at_no_load_is_the_capacitor_current() -> None:
    d = layer2.scaled(50e3, 440.0, 50.0)
    i = layer2.bridge_current_a(0.0, 0.0, 440.0, d, 50.0)
    assert i / (50e3 / (math.sqrt(3) * 440)) == pytest.approx(0.2268, abs=1e-3)  # Cf 0.227 p.u.


def test_layer2_sheet_refuses_a_case_that_starts_in_limit() -> None:
    r = rec("m1")
    s = sheet.input_sheet(r, with_layer2=True)
    assert s["inverters"][0]["layer2_start_current_a"] == pytest.approx(25.6, abs=0.1)
    pay = json.loads(json.dumps(r["result"]["payload"]))
    pay["inverter_results"][0]["p_kw"] = 120.0  # FIXTURE ONLY: 1.6 p.u. of 75 kVA
    with pytest.raises(sheet.RefusedRecordError):
        sheet.input_sheet(r | {"result": r["result"] | {"payload": pay}}, with_layer2=True)


def test_limiter_prediction_on_d2_lr_sm01() -> None:
    rows = layer2.limiter_prediction(rec("sm01_m4b"))
    assert [r["engages"] for r in rows] == [False, False]
    assert rows[0]["limit_a"] == pytest.approx(147.6, abs=0.1)
