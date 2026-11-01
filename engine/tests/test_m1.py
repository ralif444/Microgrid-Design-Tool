"""Level-1 verification of M1 (Doc 9 D-49): Tabel 4.8 oracle, Jacobian, balance, status rules."""

import math

import numpy as np
import pytest

from mgengine.m1 import _Model, initial_guess, solve_m1
from mgengine.types import Code, Inverter, Line, Load, Network, SolverConfig, Status

# Tabel 4.8: 2 × 10 kVA, X = 0.1 Ω, R = 0, 230 V, 50 Hz, m = 2π(0.5)/10⁴ rad/(s·W).
OMEGA_SET = 2 * math.pi * 50.0
M_P = 2 * math.pi * 0.5 / 1e4
N_Q = 5e-4  # V/VAR; manuscript lets n_q → 0, a finite value is used here (D-49 K31)


def two_bus(
    r_ohm: float, loads: tuple[Load, ...], m_p: float = M_P, v_set: float = 230.0
) -> Network:
    return Network(
        buses=("B1", "B2"),
        lines=(Line("L1", "B1", "B2", r_ohm, 0.1),),
        loads=loads,
        inverters=(
            Inverter("G1", "B1", m_p, N_Q, OMEGA_SET, v_set),
            Inverter("G2", "B2", m_p, N_Q, OMEGA_SET, v_set),
        ),
    )


SYMMETRIC = (Load("B1", 5e3, 0.0), Load("B2", 5e3, 0.0))
ONE_SIDED = (Load("B1", 10e3, 0.0),)


def test_tabel_4_8_symmetric_oracle() -> None:
    res = solve_m1(two_bus(0.0, SYMMETRIC))
    assert res.status is Status.FEASIBLE and res.code is Code.OK
    assert res.omega_rad_s is not None
    assert OMEGA_SET - res.omega_rad_s == pytest.approx(1.5708, abs=1e-4)
    assert res.omega_rad_s / (2 * math.pi) == pytest.approx(49.75, abs=1e-6)
    assert res.v_v == pytest.approx((230.0, 230.0))


def test_lossless_asymmetric_load_keeps_frequency() -> None:
    # R = 0: no active losses, so ω still follows (4.9) with P̂_loss = 0; NR needs iterations.
    res = solve_m1(two_bus(0.0, ONE_SIDED))
    assert res.status is Status.FEASIBLE
    assert res.iterations > 0
    assert res.omega_rad_s is not None
    assert res.omega_rad_s / (2 * math.pi) == pytest.approx(49.75, abs=1e-6)
    assert res.max_mismatch < 1e-3


def test_jacobian_matches_finite_differences() -> None:
    net = two_bus(0.05, (Load("B1", 8e3, 2e3), Load("B2", 3e3, 1e3)))
    model = _Model(net)
    x = initial_guess(net) + np.array([-2.0, 1.5, 0.01, -0.3])
    J = model.jacobian(x)
    fd = np.zeros_like(J)
    for j in range(x.size):
        h = 1e-6 * max(1.0, abs(x[j]))
        e = np.zeros_like(x)
        e[j] = h
        fd[:, j] = (model.mismatch(x + e) - model.mismatch(x - e)) / (2 * h)
    np.testing.assert_allclose(J, fd, rtol=1e-6, atol=1e-3)


def test_power_balance_losses_non_negative() -> None:
    net = two_bus(0.05, (Load("B1", 8e3, 2e3),))
    res = solve_m1(net)
    assert res.status is Status.FEASIBLE and res.omega_rad_s is not None
    injected = sum((OMEGA_SET - res.omega_rad_s) / inv.m_p_rad_s_per_w for inv in net.inverters)
    losses = injected - 8e3
    assert losses > 0.0
    # (4.9) with losses: ω = ω* − (P_L + P_loss)/Σ(1/m)
    assert res.omega_rad_s == pytest.approx(OMEGA_SET - (8e3 + losses) * M_P / 2, abs=1e-9)


def test_max_iterations_reached() -> None:
    res = solve_m1(two_bus(0.05, ONE_SIDED), SolverConfig(max_iterations=1))
    assert res.status is Status.SOLVER_FAILED and res.code is Code.MAX_ITERATIONS_REACHED
    assert res.v_v is None and res.omega_rad_s is None


def test_non_finite_input() -> None:
    res = solve_m1(two_bus(0.0, SYMMETRIC, m_p=math.nan))
    assert res.status is Status.SOLVER_FAILED and res.code is Code.NON_FINITE


def test_singular_jacobian_is_ill_conditioned() -> None:
    net = Network(
        buses=("B1", "B2"),
        lines=(),
        loads=ONE_SIDED,
        inverters=two_bus(0.0, ONE_SIDED).inverters,
    )
    res = solve_m1(net)
    assert res.status is Status.SOLVER_FAILED and res.code is Code.ILL_CONDITIONED_JACOBIAN


def test_root_with_non_positive_voltage_is_inadmissible() -> None:
    res = solve_m1(two_bus(0.0, SYMMETRIC, v_set=-230.0))
    assert res.status is Status.PHYSICALLY_INADMISSIBLE
    assert res.code is Code.OPERATING_POINT_NOT_PHYSICAL
    assert res.v_v == pytest.approx((-230.0, -230.0))


def test_deterministic() -> None:
    net = two_bus(0.05, (Load("B1", 8e3, 2e3), Load("B2", 3e3, 1e3)))
    assert solve_m1(net) == solve_m1(net)
