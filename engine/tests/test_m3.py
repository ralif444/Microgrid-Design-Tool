"""M3 level-1 checks (manuscript 4.2.5, (4.17)–(4.18); Doc 9 D-52)."""

import pytest
from test_m1 import M_P, OMEGA_SET, SYMMETRIC, two_bus
from test_m2 import TABEL_4_8, WEAK

from mgengine.m2 import Kind, Limits, scaled, trace
from mgengine.m3 import (
    Metric,
    PointStatus,
    Scheme,
    SensitivityCase,
    evaluate,
    m3a,
    m3b,
    m3c,
    m3d,
)

NONE = Limits()
LOADING = Limits(loading_max_ratio=1.0)
DOMEGA_DLAMBDA = -10e3 * M_P / 2  # ω = ω* − λ P_L m/2 (Tabel 4.8): −1.5708 rad/s


def lam_case(net, lam0: float, h: float) -> SensitivityCase:  # type: ignore[no-untyped-def]
    return SensitivityCase("lambda", lam0, h, scaled(net, lam0 - h), scaled(net, lam0 + h))


def test_m3a_tabel_4_8_load_scale() -> None:
    metrics = (Metric.SYSTEM_FREQUENCY, Metric.MAX_INVERTER_LOADING, Metric.TOTAL_LOSSES)
    r = m3a(TABEL_4_8, [lam_case(TABEL_4_8, 1.0, 0.1)], metrics, LOADING, OMEGA_SET)
    freq, load, loss = r.sensitivities
    assert freq.scheme is Scheme.CENTRAL and not freq.status_change
    assert freq.value == pytest.approx(DOMEGA_DLAMBDA, abs=1e-6)
    omega0 = OMEGA_SET + DOMEGA_DLAMBDA
    assert freq.normalised_value == pytest.approx(DOMEGA_DLAMBDA / omega0, rel=1e-6)
    assert load.value == pytest.approx(0.5, rel=1e-6)  # S = 5λ kVA on 10 kVA
    assert load.normalised_value == pytest.approx(1.0, rel=1e-6)
    assert loss.normalised_value is None  # R = 0: y0 = 0 (K53), not ranked
    assert [(k.metric, k.rank) for k in r.ranking] == [
        (Metric.SYSTEM_FREQUENCY, 1),
        (Metric.MAX_INVERTER_LOADING, 1),
    ]


def test_m3a_droop_gain_and_ranking() -> None:
    dm = 0.01 * M_P
    m_case = SensitivityCase(
        "m_p",
        M_P,
        dm,
        two_bus(0.0, SYMMETRIC, m_p=M_P - dm),
        two_bus(0.0, SYMMETRIC, m_p=M_P + dm),
    )
    cases = [lam_case(TABEL_4_8, 1.0, 0.1), m_case]
    r = m3a(TABEL_4_8, cases, (Metric.SYSTEM_FREQUENCY,), NONE, OMEGA_SET)
    assert r.sensitivities[1].value == pytest.approx(-10e3 / 2, rel=1e-6)  # dω/dm = −P_L/2
    # both S_norm equal −1.5708/ω0 analytically; the tie keeps request order (K54)
    assert [k.parameter_id for k in r.ranking] == ["lambda", "m_p"]


def test_m3a_one_sided_near_failure_and_not_reported() -> None:
    lam_s = trace(WEAK, NONE, OMEGA_SET, 1000).lambda_s
    r = m3a(
        scaled(WEAK, lam_s),
        [lam_case(WEAK, lam_s, 0.01)],
        (Metric.MIN_BUS_VOLTAGE,),
        NONE,
        OMEGA_SET,
    )
    (s,) = r.sensitivities
    assert s.scheme is Scheme.BACKWARD and s.status_change and s.value is not None
    bad = m3a(
        scaled(WEAK, 2.0), [lam_case(WEAK, 2.0, 0.1)], (Metric.MIN_BUS_VOLTAGE,), NONE, OMEGA_SET
    )
    assert bad.sensitivities[0].value is None
    assert bad.sensitivities[0].reason == "base point not admissible"
    zero = SensitivityCase("q_set", 0.0, 0.0, TABEL_4_8, TABEL_4_8)
    z = m3a(TABEL_4_8, [zero], (Metric.MIN_BUS_VOLTAGE,), NONE, OMEGA_SET)
    assert z.sensitivities[0].value is None and z.ranking == ()


def test_m3b_first_infeasible_value() -> None:
    lam_s = trace(WEAK, NONE, OMEGA_SET, 1000).lambda_s
    grid = [1.0 + 0.05 * k for k in range(7)]
    r = m3b([(v, scaled(WEAK, v)) for v in grid], NONE, OMEGA_SET)
    expected = next(v for v in grid if v > lam_s)
    assert r.first_infeasible_value == expected
    failed = [p for v, p in r.points if v >= expected]
    assert all(p.status is not PointStatus.FEASIBLE and p.metrics is None for p in failed)


def test_m3d_feasible_fraction_by_hand() -> None:
    # Loading limit μ = 1 holds for λ ≤ 2 whatever m_p is: 4 of 6 points FEASIBLE.
    grid = [
        (lam, k, scaled(two_bus(0.0, SYMMETRIC, m_p=k * M_P), lam))
        for lam in (1.5, 2.0, 2.5)
        for k in (1.0, 2.0)
    ]
    r = m3d(grid, LOADING, OMEGA_SET)
    assert r.feasible_fraction == pytest.approx(4 / 6)
    inf = [p for lam, _, p in r.grid if lam == 2.5]
    assert all(p.limiting is not None and p.limiting.kind is Kind.INVERTER_LOADING for p in inf)


def test_m3c_deltas_against_reference() -> None:
    r = m3c([("base", TABEL_4_8), ("heavy", scaled(TABEL_4_8, 1.2))], NONE, OMEGA_SET)
    d = next(x for x in r.deltas if x.metric is Metric.SYSTEM_FREQUENCY)
    assert d.reference_scenario_id == "base" and d.scenario_id == "heavy"
    assert d.delta == pytest.approx(0.2 * DOMEGA_DLAMBDA, abs=1e-6)
    assert d.relative_delta == pytest.approx(d.delta / (OMEGA_SET + DOMEGA_DLAMBDA))
    loss = next(x for x in r.deltas if x.metric is Metric.TOTAL_LOSSES)
    assert loss.relative_delta is None  # reference losses 0
    alt = m3c([("base", TABEL_4_8), ("heavy", scaled(TABEL_4_8, 1.2))], NONE, OMEGA_SET, "heavy")
    assert {x.scenario_id for x in alt.deltas} == {"base"}


def test_limiting_rule_skips_balance_without_violation() -> None:
    limits = Limits(line_current_max_a=(1e6,), balance_tolerance_w=1e-2)
    p = evaluate(two_bus(0.0, SYMMETRIC), limits, OMEGA_SET)
    assert p.status is PointStatus.FEASIBLE
    assert p.limiting is not None and p.limiting.kind is Kind.LINE_CURRENT


def test_lambda_c_point_metric() -> None:
    p = evaluate(TABEL_4_8, LOADING, OMEGA_SET, lambda_c_points=60)
    assert p.metrics is not None and p.metrics.lambda_c == pytest.approx(2.0)
