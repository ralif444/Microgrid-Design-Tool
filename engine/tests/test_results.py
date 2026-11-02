"""Level-1 and sanity checks of M1 details (Doc 9 D-50 K38; manuscript 4.5.2)."""

import math

import pytest
from test_m1 import OMEGA_SET, ONE_SIDED, RATED_VA, SYMMETRIC, two_bus

from mgengine.m1 import solve_m1
from mgengine.results import M1Details, m1_details
from mgengine.types import Load, Network, SolverConfig


def details(net: Network) -> M1Details:
    return m1_details(net, solve_m1(net), OMEGA_SET)


def test_tabel_4_8_epsilon_x_and_zero_flow() -> None:
    d = details(two_bus(0.0, SYMMETRIC))
    assert d.epsilon_x_ratio == pytest.approx(0.005, abs=1e-9)
    (line,) = d.lines
    assert line.current_a == pytest.approx(0.0, abs=1e-6)
    assert line.p_from_w == pytest.approx(0.0, abs=1e-3)
    assert [inv.p_w for inv in d.inverters] == pytest.approx([5e3, 5e3])
    assert [inv.loading_ratio for inv in d.inverters] == pytest.approx([0.5, 0.5])
    assert d.total_load_w == 10e3 and d.total_losses_w == pytest.approx(0.0, abs=1e-6)


def test_lossless_one_sided_flow() -> None:
    d = details(two_bus(0.0, ONE_SIDED))
    (line,) = d.lines
    # B2's inverter supplies 5 kW to the 10 kW load on B1 (L1 runs B1 → B2).
    assert line.p_from_w == pytest.approx(-5e3, abs=1e-3)
    assert line.p_to_w == pytest.approx(5e3, abs=1e-3)
    assert line.losses_w == pytest.approx(0.0, abs=1e-6)
    q_inv = sum(inv.q_var for inv in d.inverters)
    assert q_inv == pytest.approx(3 * line.current_a**2 * 0.1, abs=1e-3)


def test_sanity_balance_losses_apparent_power() -> None:
    net = two_bus(0.05, (Load("B1", 8e3, 2e3), Load("B2", 3e3, 1e3)))
    d = details(net)
    (line,) = d.lines
    tol = SolverConfig().mismatch_tolerance_w * 2  # one mismatch per bus
    assert sum(i.p_w for i in d.inverters) == pytest.approx(
        d.total_load_w + d.total_losses_w, abs=tol
    )
    assert sum(i.q_var for i in d.inverters) == pytest.approx(
        d.total_load_var + 3 * line.current_a**2 * 0.1, abs=tol
    )
    assert d.total_losses_w > 0.0
    assert line.losses_w == pytest.approx(3 * line.current_a**2 * 0.05, rel=1e-9)
    for inv in d.inverters:
        assert inv.s_va**2 == pytest.approx(inv.p_w**2 + inv.q_var**2, rel=1e-12)
        assert inv.loading_ratio == pytest.approx(inv.s_va / RATED_VA, rel=1e-12)
    assert d.epsilon_x_ratio == pytest.approx(abs(OMEGA_SET - details_omega(net)) / OMEGA_SET)


def details_omega(net: Network) -> float:
    omega = solve_m1(net).omega_rad_s
    assert omega is not None and math.isfinite(omega)
    return omega


def test_no_operating_point_is_refused() -> None:
    net = two_bus(0.05, ONE_SIDED)
    with pytest.raises(ValueError):
        m1_details(net, solve_m1(net, SolverConfig(max_iterations=1)), OMEGA_SET)
