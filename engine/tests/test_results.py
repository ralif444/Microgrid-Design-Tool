"""Level-1 and sanity checks of M1 details (Doc 9 D-50 K38; manuscript 4.5.2)."""

import math

import pytest
from test_m1 import OMEGA_SET, ONE_SIDED, RATED_VA, SYMMETRIC, two_bus

from mgengine.m1 import solve_m1
from mgengine.results import M1Details, m1_details
from mgengine.types import Inverter, Line, Load, Network, SolverConfig


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


# Doc 12 P9 hand check on D2 (Doc 13 §4: 440 V LL, 50 Hz, P* = Q* = 0; Doc 9 D-63).
OMEGA_D2 = 2 * math.pi * 50
V_D2 = 440 / math.sqrt(3)


def d2() -> Network:
    def inv(i: str, bus: str, m_p: float, n_q: float, s: float) -> Inverter:
        return Inverter(i, bus, m_p, n_q, OMEGA_D2, V_D2, s)

    return Network(
        ("B1", "B2", "B3"),
        (Line("L1", "B1", "B2", 0.02, 0.04), Line("L2", "B2", "B3", 0.025, 0.045)),
        (Load("B2", 25e3, 10e3),),
        (inv("INV1", "B1", 5e-5, 5e-4, 70e3), inv("INV2", "B3", 8e-5, 7e-4, 45e3)),
    )


def test_d2_sharing_hand_check() -> None:
    d = m1_details(d2(), solve_m1(d2()), OMEGA_D2)
    s1, s2 = d.sharing
    p_tot = sum(i.p_w for i in d.inverters)
    q1, q2 = (i.q_var for i in d.inverters)
    # P* = 0 and one ω: P_i ∝ 1/m_p, so P1 = P_tot·(1/5e-5)/(1/5e-5 + 1/8e-5) = P_tot·8/13,
    # against the rating share 70/115 (12.11).
    assert s1.dp_w == pytest.approx(p_tot * (8 / 13 - 70 / 115), rel=1e-6)
    assert s1.dp_w + s2.dp_w == pytest.approx(0.0, abs=1e-6)
    assert s1.dq_var == pytest.approx(q1 - 70 / 115 * (q1 + q2), rel=1e-12)  # (12.10)
    assert s2.e_q_ratio == pytest.approx(abs(s2.dq_var) / 45e3, rel=1e-12)  # (12.12)
    assert d.e_q_max_ratio == max(s1.e_q_ratio, s2.e_q_ratio)
    # n_q·S_r = 35 and 31.5, mean 33.25: both differ by 5.3 % > 1e-6, so both flagged (12.13).
    assert s1.q_droop_not_rating_proportional and s2.q_droop_not_rating_proportional


def test_one_inverter_shares_nothing() -> None:
    net = d2()
    one = Network(net.buses[:2], net.lines[:1], net.loads, net.inverters[:1])
    (s,) = m1_details(one, solve_m1(one), OMEGA_D2).sharing
    assert (s.dp_w, s.dq_var, s.q_droop_not_rating_proportional) == (0.0, 0.0, False)
