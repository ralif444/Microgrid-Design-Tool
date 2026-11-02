"""M4b level-1 checks (manuscript 4.2.6, Gambar C.4a–C.4b; Doc 9 D-53). Horizons ≤ 1 s (K71)."""

import dataclasses as dc
import math

import pytest
from test_m1 import M_P, OMEGA_SET
from test_m2 import WEAK
from test_m4a import TABEL_4_8, TAU, with_tau

from mgengine.m2 import Limits
from mgengine.m4b import (
    Disturbance,
    DisturbanceKind,
    Reference,
    Settling,
    TransientClass,
    solve_m4b,
)
from mgengine.types import Code, Status

NET = dc.replace(
    TABEL_4_8, loads=tuple(dc.replace(ld, id=f"L{k}") for k, ld in enumerate(TABEL_4_8.loads, 1))
)
SETTLE = Settling(omega_band_rad_s=1e-3, v_band_v=1e-2, window_s=0.1)
STEP = Disturbance(DisturbanceKind.LOAD_STEP, "L1", 0.05, magnitude=1e3)
NONE = Limits()


def test_load_step_final_frequency_and_rocof() -> None:
    r = solve_m4b(NET, STEP, 1.0, NONE, OMEGA_SET, SETTLE)
    assert r.status is Status.FEASIBLE and r.transient_class is TransientClass.RECOVERED_STABLE
    assert r.omega_rad_s[0] == pytest.approx(OMEGA_SET - 10e3 * M_P / 2, abs=1e-9)
    assert r.omega_rad_s[-1] == pytest.approx(OMEGA_SET - 11e3 * M_P / 2, abs=1e-6)  # M1 at 11 kW
    # t0+: the ideal source at B1 takes the whole step, so dω1/dt = −m ΔP/τ
    assert r.max_rocof_rad_s2 == pytest.approx(M_P * 1e3 / TAU, rel=1e-6)
    assert r.time_s.count(0.05) == 2  # value before and after the disturbance


def test_damped_oscillation_matches_m4a_mode() -> None:
    r = solve_m4b(NET, STEP, 0.3, NONE, OMEGA_SET)
    # P1 − P2 holds only the differential (oscillatory) mode; its zero crossings give f_osc
    t = [x for x in r.time_s if x > 0.05]
    d = [p1 - p2 for x, p1, p2 in zip(r.time_s, *r.inverter_p_w, strict=True) if x > 0.05]
    zeros = [
        t[k - 1] - d[k - 1] * (t[k] - t[k - 1]) / (d[k] - d[k - 1])
        for k in range(1, len(t))
        if d[k - 1] * d[k] < 0
    ]
    half_period = (zeros[-1] - zeros[0]) / (len(zeros) - 1)
    assert 1 / (2 * half_period) == pytest.approx(22.42, rel=0.01)  # f_osc of (4.22)
    assert r.class_reason == "settling criteria not given" and r.transient_class is None


def test_outage_of_reference_inverter() -> None:
    r = solve_m4b(
        NET, Disturbance(DisturbanceKind.INVERTER_OUTAGE, "G1", 0.05), 1.0, NONE, OMEGA_SET, SETTLE
    )
    assert r.transient_class is TransientClass.RECOVERED_STABLE
    assert r.omega_rad_s[-1] == pytest.approx(OMEGA_SET - 10e3 * M_P, abs=1e-6)
    assert r.inverter_p_w[0][-1] == 0.0 and r.inverter_p_w[1][-1] == pytest.approx(10e3, abs=1e-3)
    assert r.inverter_omega_rad_s[0][-1] is None


def test_reference_step_and_reverting_step() -> None:
    f_step = Disturbance(
        DisturbanceKind.REFERENCE_STEP, "G1", 0.05, magnitude=0.2, reference=Reference.F_SETPOINT
    )
    r = solve_m4b(NET, f_step, 1.0, NONE, OMEGA_SET, SETTLE)
    assert r.omega_rad_s[-1] - r.omega_rad_s[0] == pytest.approx(0.1, abs=1e-6)  # Δω*/2
    back = dc.replace(STEP, duration_s=0.1)
    r2 = solve_m4b(NET, back, 1.0, NONE, OMEGA_SET, SETTLE)
    assert r2.omega_rad_s[-1] == pytest.approx(r2.omega_rad_s[0], abs=1e-6)


def test_load_bus_network_lost_is_unstable() -> None:
    weak = dc.replace(with_tau(WEAK), loads=(dc.replace(WEAK.loads[0], id="L1"),))
    scale = Disturbance(DisturbanceKind.LOAD_SCALING, "ALL", 0.05, magnitude=2.0)
    r = solve_m4b(weak, scale, 0.5, NONE, OMEGA_SET, SETTLE)
    assert r.status is Status.FEASIBLE and r.transient_class is TransientClass.UNSTABLE
    assert r.class_reason is not None and "lost" in r.class_reason
    small = solve_m4b(weak, dc.replace(scale, magnitude=1.02), 0.5, NONE, OMEGA_SET, SETTLE)
    assert small.transient_class is TransientClass.RECOVERED_STABLE


def test_envelope_and_settling() -> None:
    f_final = OMEGA_SET - 11e3 * M_P / 2
    tight = Limits(omega_min_rad_s=f_final + 0.01)  # final frequency below the envelope
    r = solve_m4b(NET, STEP, 1.0, tight, OMEGA_SET, SETTLE)
    assert r.transient_class is TransientClass.CRITERIA_VIOLATED
    assert set(r.not_evaluated) == {"FREQUENCY_MAX", "BUS_VOLTAGE_MIN", "BUS_VOLTAGE_MAX"}
    short = solve_m4b(NET, STEP, 0.12, NONE, OMEGA_SET, Settling(1e-6, 1e-6, 0.05))
    assert short.settled is False and short.transient_class is TransientClass.UNSTABLE


def test_invalid_configuration() -> None:
    bad = [
        dc.replace(STEP, element_id="nope"),
        dc.replace(STEP, start_time_s=2.0),
        Disturbance(DisturbanceKind.REFERENCE_STEP, "G1", 0.05, magnitude=1.0),  # no reference
        Disturbance(DisturbanceKind.LOAD_SCALING, "ALL", 0.05, magnitude=0.0),
    ]
    for d in bad:
        r = solve_m4b(NET, d, 1.0, NONE, OMEGA_SET)
        assert r.status is Status.INPUT_INVALID and r.code is Code.DISTURBANCE_INVALID
    long_window = solve_m4b(NET, STEP, 1.0, NONE, OMEGA_SET, Settling(1e-3, 1e-2, 2.0))
    assert long_window.status is Status.INPUT_INVALID


def test_deterministic_and_finite() -> None:
    a = solve_m4b(NET, STEP, 0.2, NONE, OMEGA_SET)
    assert a == solve_m4b(NET, STEP, 0.2, NONE, OMEGA_SET)
    assert all(math.isfinite(v) for v in a.omega_rad_s)
