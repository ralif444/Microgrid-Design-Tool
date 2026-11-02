"""M4a level-1 checks: oracle (4.22) on Tabel 4.8, one-inverter case, (4.20)–(4.23); D-53."""

import dataclasses as dc
import math

import numpy as np
import pytest
from test_m1 import M_P, N_Q, OMEGA_SET, SYMMETRIC, two_bus
from test_m2 import V_NOM, WEAK

from mgengine.m2 import Limits
from mgengine.m3 import evaluate
from mgengine.m4 import StabilityClass, solve_m4a, stability_class
from mgengine.types import Code, Inverter, Load, Network, Status

TAU = 0.05  # Tabel 4.8


def with_tau(net: Network, tau_p: float = TAU, tau_q: float = TAU) -> Network:
    inv = tuple(dc.replace(i, tau_p_s=tau_p, tau_q_s=tau_q) for i in net.inverters)
    return dc.replace(net, inverters=inv)


TABEL_4_8 = with_tau(two_bus(0.0, SYMMETRIC))


def test_oracle_4_22_tabel_4_8() -> None:
    r = solve_m4a(TABEL_4_8, Limits(), OMEGA_SET)
    assert r.status is Status.FEASIBLE and r.stability_class is StabilityClass.STABLE
    k_s = 3 * V_NOM * V_NOM * math.cos(0.0) / 0.1  # (4.22), δ0 = 0
    assert k_s == pytest.approx(1.587e6, rel=1e-3)
    wn2 = 2 * M_P * k_s / TAU
    expected = complex(-1 / (2 * TAU), math.sqrt(wn2 - 1 / (4 * TAU**2)))
    assert expected.imag == pytest.approx(140.86, abs=0.01)
    assert min(abs(e - expected) for e in r.eigenvalues) < 1e-3
    assert r.zeta_min == pytest.approx(1 / (2 * math.sqrt(2 * M_P * k_s * TAU)), rel=1e-6)
    assert r.zeta_min == pytest.approx(0.0708, abs=1e-4)
    (dom,) = r.dominant
    assert dom.frequency_hz == pytest.approx(22.42, abs=0.01)
    assert len(r.eigenvalues) == (2 - 1) + 2 * 2  # (N − 1) + 2N
    assert r.state_names == ("delta/G2", "p_f/G1", "p_f/G2", "q_f/G1", "q_f/G2")


def test_one_inverter_filters_only() -> None:
    net = Network(
        buses=("B1",),
        lines=(),
        loads=(Load("B1", 4e3, 1e3),),
        inverters=(
            Inverter("G1", "B1", M_P, N_Q, OMEGA_SET, V_NOM, 10e3, tau_p_s=0.1, tau_q_s=0.02),
        ),
    )
    r = solve_m4a(net, Limits(), OMEGA_SET)
    assert sorted(e.real for e in r.eigenvalues) == pytest.approx([-50.0, -10.0], rel=1e-6)
    assert r.zeta_min is None  # no oscillatory mode
    assert r.indicators is not None and not r.indicators.r_tau.evaluated  # no lines


def test_participation_sums_to_one() -> None:
    r = solve_m4a(TABEL_4_8, Limits(), OMEGA_SET)
    assert r.participation is not None
    for row in r.participation:
        assert sum(row) == pytest.approx(1.0)
    assert r.dominant[0].element_ids[0] in {"G1", "G2"}


def test_indicators_4_23() -> None:
    lossless = solve_m4a(TABEL_4_8, Limits(), OMEGA_SET, tau_in_s=1e-3)
    ind = lossless.indicators
    assert ind is not None
    assert not ind.r_tau.evaluated and not ind.kappa.evaluated  # R = 0 (K64)
    assert ind.r_in.value == pytest.approx(1e-3 / TAU)
    assert ind.epsilon_x.value == pytest.approx(0.005, abs=1e-9)
    lossy = solve_m4a(with_tau(two_bus(0.05, SYMMETRIC)), Limits(), OMEGA_SET)
    assert lossy.indicators is not None
    t_line = 0.1 / (OMEGA_SET * 0.05)
    assert lossy.indicators.r_tau.value == pytest.approx(t_line / TAU)
    lam_dom = lossy.eigenvalues[lossy.dominant[0].index]
    assert lossy.indicators.kappa.value == pytest.approx(t_line * abs(lam_dom))


def test_outside_definition_and_damping_pass() -> None:
    tight = Limits(v_min_v=1.01 * V_NOM, v_max_v=1.05 * V_NOM)
    r = solve_m4a(TABEL_4_8, tight, OMEGA_SET, damping_threshold_ratio=0.05)
    assert r.outside_definition and r.damping_pass is True
    r2 = solve_m4a(TABEL_4_8, Limits(), OMEGA_SET, damping_threshold_ratio=0.1)
    assert not r2.outside_definition and r2.damping_pass is False
    assert solve_m4a(TABEL_4_8, Limits(), OMEGA_SET).damping_pass is None


def test_load_bus_reduction_and_multiple_inverters_rejected() -> None:
    r = solve_m4a(with_tau(WEAK), Limits(), OMEGA_SET)  # algebraic load bus B1
    assert r.status is Status.FEASIBLE and len(r.eigenvalues) == 2
    double = dc.replace(
        TABEL_4_8,
        inverters=(TABEL_4_8.inverters[0], dc.replace(TABEL_4_8.inverters[1], bus="B1")),
    )
    bad = solve_m4a(double, Limits(), OMEGA_SET)
    assert bad.status is Status.INPUT_INVALID and bad.code is Code.MULTIPLE_INVERTERS_ON_BUS


def test_stability_class_thresholds() -> None:
    assert stability_class(np.array([-1.0 + 0j, -2.0])) is StabilityClass.STABLE
    assert stability_class(np.array([1e-3 + 0j, -2.0])) is StabilityClass.UNSTABLE
    assert stability_class(np.array([1e-12 + 0j, -2.0])) is StabilityClass.MARGINAL


def test_m3_point_with_m4_metrics() -> None:
    p = evaluate(TABEL_4_8, Limits(), OMEGA_SET, m4=True, include_eigenvalues=True)
    assert p.metrics is not None and p.metrics.zeta_min == pytest.approx(0.0708, abs=1e-4)
    assert p.metrics.re_lambda_dom_per_s == pytest.approx(-10.0, abs=1e-4)
    assert p.metrics.eigenvalues is not None and len(p.metrics.eigenvalues) == 5
