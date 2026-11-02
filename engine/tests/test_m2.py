"""M2 level-1 checks (manuscript 4.2.4, (4.10)–(4.16); Doc 9 D-51)."""

import math

import pytest
from test_m1 import M_P, N_Q, OMEGA_SET, SYMMETRIC, two_bus

from mgengine.m1 import solve_m1
from mgengine.m2 import (
    SYSTEM,
    Kind,
    Limits,
    M2Result,
    Verdict,
    _bound,
    lambda_ub,
    scaled,
    solve_m2,
    trace,
)
from mgengine.ps import ps
from mgengine.types import Inverter, Line, Load, Network, Status

V_NOM = 230.0
TABEL_4_8 = two_bus(0.0, SYMMETRIC)
# Weak feeder: one inverter at B2 supplies a load at B1 over 0.5 + j5 Ω, so M1 fails near λ ≈ 1.1.
WEAK = Network(
    buses=("B1", "B2"),
    lines=(Line("L1", "B1", "B2", 0.5, 5.0),),
    loads=(Load("B1", 10e3, 2e3),),
    inverters=(Inverter("G2", "B2", M_P, N_Q, OMEGA_SET, V_NOM, 20e3),),
)


def m2(
    net: Network,
    limits: Limits,
    max_points: int = 1000,
    autonomy_h: int | None = None,
    dc_efficiency_ratio: float | None = None,
) -> M2Result:
    return solve_m2(net, limits, OMEGA_SET, 0.1, 0.2, max_points, autonomy_h, dc_efficiency_ratio)


def test_tolerance_4_11_at_the_limit() -> None:
    u = 1.0
    assert not _bound(Kind.INVERTER_LOADING, "G1", u + 0.5e-9, u, True, u).violated
    assert _bound(Kind.INVERTER_LOADING, "G1", u + 2e-9, u, True, u).violated
    assert not _bound(Kind.BUS_VOLTAGE_MIN, "B1", 0.0, 0.0, False, 1.0).violated
    assert _bound(Kind.BUS_VOLTAGE_MIN, "B1", -2e-12, 0.0, False, 1.0).violated


def test_tabel_4_8_lambda_ub_and_lambda_c() -> None:
    limits = Limits(loading_max_ratio=1.0)
    assert lambda_ub(TABEL_4_8, limits) == pytest.approx(2.0)
    lo = trace(TABEL_4_8, limits, OMEGA_SET, max_points=60)
    assert lo.lambda_c is not None and lo.lambda_ub is not None
    assert lo.lambda_ub - lo.resolution <= lo.lambda_c <= lo.lambda_ub
    assert lo.stop_reason == "point cap 60 reached" and lo.points == 60


def test_ps_m2_cross_check() -> None:
    # 4.2.2: with r = 0 and μ = 1 the PS installed total gives λ_ub ≥ 1 + m_inv.
    m_inv = 0.25
    plan = ps(TABEL_4_8.loads, m_inv, 2, 0)
    net = Network(
        TABEL_4_8.buses,
        TABEL_4_8.lines,
        TABEL_4_8.loads,
        tuple(
            Inverter(i.id, i.bus, M_P, N_Q, OMEGA_SET, V_NOM, plan.unit_rating_va)
            for i in TABEL_4_8.inverters
        ),
    )
    ub = lambda_ub(net, Limits(loading_max_ratio=1.0))
    assert ub is not None and ub >= 1 + m_inv


def test_lambda_s_brackets_the_first_failure() -> None:
    lo = trace(WEAK, Limits(), OMEGA_SET, max_points=1000)
    assert lo.stop_reason.startswith("first failure")
    assert lo.lambda_c == lo.lambda_s  # no limits set: every admissible point is FEASIBLE
    assert solve_m1(scaled(WEAK, lo.lambda_s)).status is Status.FEASIBLE
    assert solve_m1(scaled(WEAK, lo.lambda_s + lo.resolution)).status is not Status.FEASIBLE


def test_infeasible_at_lambda_1_has_no_lambda_c() -> None:
    r = m2(TABEL_4_8, Limits(v_min_v=1.06 * V_NOM, v_max_v=1.10 * V_NOM), max_points=5)
    assert r.verdict is Verdict.INFEASIBLE
    assert r.loadability.lambda_c is None
    low = [c for c in r.constraints if c.kind is Kind.BUS_VOLTAGE_MIN]
    assert all(c.violated and c.margin < 0 for c in low)
    # two-sided band: normalised by the band width (4.18)
    assert low[0].normalised_margin == pytest.approx(low[0].margin / (0.04 * V_NOM))


def test_feasible_checks_sorted_and_not_evaluated_listed() -> None:
    limits = Limits(
        v_min_v=0.95 * V_NOM,
        v_max_v=1.05 * V_NOM,
        omega_min_rad_s=2 * math.pi * 49.75 - 1e-6,
        loading_max_ratio=1.0,
        line_current_max_a=(100.0,),
        balance_tolerance_w=1.0,
    )
    r = m2(TABEL_4_8, limits, max_points=5)
    assert r.verdict is Verdict.FEASIBLE
    norm = [c.normalised_margin for c in r.constraints]
    assert norm == sorted(norm)
    assert r.not_evaluated == ((Kind.FREQUENCY_MAX, SYSTEM),)
    bal = next(c for c in r.constraints if c.kind is Kind.POWER_BALANCE)
    assert bal.value < 2e-3  # numerical consistency, (4.10)
    assert m2(TABEL_4_8, limits, max_points=5) == r  # deterministic


def test_sizing_4_12_4_13() -> None:
    r = m2(TABEL_4_8, Limits(), max_points=3, autonomy_h=4, dc_efficiency_ratio=0.9)
    for s in r.per_inverter:
        assert s.s_va == pytest.approx(5e3, abs=1e-3)
        assert s.required_rating_va == pytest.approx(5.5e3, abs=1e-3)  # m_inv = 0.1
        assert s.headroom_va == pytest.approx(4.5e3, abs=1e-3) and not s.rating_margin_short
    (line,) = r.per_line
    assert line.required_current_a == pytest.approx(1.2 * line.current_a)  # m_line = 0.2
    assert r.storage is not None
    assert r.storage.e_ac_wh == pytest.approx(40e3)
    assert r.storage.e_dc_wh == pytest.approx(40e3 / 0.9)


def test_rating_margin_short_is_a_warning() -> None:
    r = m2(TABEL_4_8, Limits(loading_max_ratio=1.0), max_points=3)
    tight = solve_m2(TABEL_4_8, Limits(loading_max_ratio=1.0), OMEGA_SET, 1.5, 0.0, 3)
    assert all(s.rating_margin_short for s in tight.per_inverter)  # 5 kVA × 2.5 > 10 kVA
    assert tight.verdict is r.verdict is Verdict.FEASIBLE
