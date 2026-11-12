"""Battery service, power part B2 (Doc 12 FR-76, FR-118; guideline §3.2; D-109).

Expected values are the hand cases V3, V4 of docs/BESS_VERIFICATION_FRAMEWORK.md §3.3, §3.4 with
the M1 inverter powers of §3.0 (fictitious TEST ONLY modules MOD-T1, MOD-T2).
"""

from __future__ import annotations

from typing import Any

import pytest

from mgapp.domain.battery import BatteryBank
from mgapp.services.battery.power import power_part

M1 = {
    "inverter_results": [
        {"inverter_id": "INV1", "p_kw": 15.411294},
        {"inverter_id": "INV2", "p_kw": 9.632059},
    ]
}
REF = {"entry_id": "MOD-T1", "provenance": {}, "catalog_schema_version": 1}
MOD_T1 = {
    "catalog_ref": REF,
    "energy_kwh": 5,
    "voltage_min_v": 44.8,
    "voltage_max_v": 57.6,
    "discharge_power_kw": 2.5,
}
MOD_T2 = {**MOD_T1, "discharge_power_kw": None, "c_rate_per_h": 0.2}


def bank(inv: str, module: dict[str, Any], ns: int, np_: int, **over: Any) -> BatteryBank:
    return BatteryBank.model_validate(
        {
            "inverter_id": inv,
            "module": module,
            "series_count": ns,
            "parallel_count": np_,
            "dc_efficiency_ratio": 0.95,
            **over,
        }
    )


def test_fr_76_v3_bank_sufficient_power_field() -> None:
    out = power_part([bank("INV1", MOD_T1, 8, 2)], M1)[0]
    assert out["bank"] == {
        "series_count": 8,
        "parallel_count": 2,
        "module_count": 16,
        "energy_kwh": 80,
    }
    p = out["power"]
    assert (p["outcome"], p["reason"], p["capability_source"]) == ("OK", None, "discharge_power")
    assert p["capability_kw"] == pytest.approx(40, abs=1e-9)
    assert p["inverter_p_kw"] == 15.411294
    assert p["dc_side_power_kw"] == pytest.approx(15.411294 / 0.95, abs=1e-9)  # 16.2224
    assert p["margin_kw"] == pytest.approx(40 - 15.411294 / 0.95, abs=1e-9)  # +23.7776


def test_fr_76_v4_bank_short_c_rate_fallback() -> None:
    p = power_part([bank("INV2", MOD_T2, 8, 1)], M1)[0]["power"]
    assert (p["outcome"], p["capability_source"]) == ("SHORT", "c_rate")
    assert p["capability_kw"] == pytest.approx(8, abs=1e-9)
    assert p["margin_kw"] == pytest.approx(8 - 9.632059 / 0.95, abs=1e-9)  # −2.1390


@pytest.mark.parametrize(
    ("b", "reason"),
    [
        (bank("INV1", MOD_T1, 8, 2, dc_efficiency_ratio=None), "DC efficiency not set"),
        (
            bank("INV1", {**MOD_T1, "discharge_power_kw": None}, 8, 2),
            "module has no power capability",
        ),
    ],
)
def test_fr_118_power_not_evaluated_names_the_reason(b: BatteryBank, reason: str) -> None:
    p = power_part([b], M1)[0]["power"]
    assert (p["outcome"], p["reason"], p["margin_kw"]) == ("NOT_EVALUATED", reason, None)


def test_fr_76_negative_inverter_power_not_evaluated() -> None:
    m1 = {"inverter_results": [{"inverter_id": "INV1", "p_kw": -1.0}]}
    p = power_part([bank("INV1", MOD_T1, 8, 2)], m1)[0]["power"]
    assert (p["outcome"], p["reason"]) == (
        "NOT_EVALUATED",
        "inverter absorbs power; charging is not modelled",
    )


# ---- B3 autonomy (Eq. 12.14 - 12.18; FR-117, FR-118; hand cases V5, V6 of §3.5, §3.6; D-110)
from mgapp.domain.entities import ProjectSnapshot  # noqa: E402
from mgapp.services.battery.autonomy import autonomy, lambdas, scaled  # noqa: E402

LAM = [0.4] * 6 + [0.6] * 12 + [1.0] * 4 + [0.4] * 2  # PF-T, Eq. 12.9 per clock hour
P_BY_LAM = {  # §3.0, M1 on D2 (Real Engine)
    0.4: {"INV1": 6.158042, "INV2": 3.848776},
    0.6: {"INV1": 9.240264, "INV2": 5.775165},
    1.0: {"INV1": 15.411294, "INV2": 9.632059},
}


def powers(start: int = 0) -> list[dict[str, float]]:
    return [P_BY_LAM[LAM[(start + j) % 24]] for j in range(24)]


def full(inv: str, ns: int, np_: int, **over: Any) -> BatteryBank:
    return bank(
        inv, MOD_T1, ns, np_, **({"depth_of_discharge_ratio": 0.8, "initial_soc_ratio": 1.0} | over)
    )


def test_fr_117_v5_depletion_interpolates_within_hour() -> None:
    a = autonomy(full("INV2", 8, 2), 0, powers(), None, None)
    assert a["outcome"] == "DEPLETED" and a["reason"] is None
    assert a["usable_energy_kwh"] == pytest.approx(60.8, abs=1e-9)  # Eq. 12.15
    assert a["autonomy_h"] == pytest.approx(12 + (60.8 - 57.7436) / 5.775165, abs=1e-4)  # 12.5292
    assert a["depletion_clock_hour"] == 12 and a["end_soc_ratio"] is None
    assert len(a["curve"]) == 13  # up to j* = 12
    assert a["curve"][11]["cumulative_energy_kwh"] == pytest.approx(57.7436, abs=1e-4)
    assert a["curve"][11]["soc_ratio"] == pytest.approx(0.2402, abs=1e-4)


def test_fr_117_v6_not_depleted_reports_end_soc() -> None:
    a = autonomy(full("INV1", 8, 8), 0, powers(), None, None)
    assert a["outcome"] == "NOT_DEPLETED" and a["autonomy_h"] is None
    assert a["usable_energy_kwh"] == pytest.approx(243.2, abs=1e-9)
    assert a["curve"][-1]["cumulative_energy_kwh"] == pytest.approx(221.7927, abs=1e-4)
    assert a["end_soc_ratio"] == pytest.approx(0.2704, abs=1e-4)


def test_fr_117_profile_wraps_past_midnight() -> None:
    a = autonomy(full("INV2", 8, 2), 18, powers(18), None, None)
    assert [c["clock_hour"] for c in a["curve"][:7]] == [18, 19, 20, 21, 22, 23, 0]
    assert [c["inverter_p_kw"] for c in a["curve"][:4]] == [9.632059] * 4  # λ = 1.0


@pytest.mark.parametrize(
    ("over", "reason"),
    [
        ({"dc_efficiency_ratio": None}, "DC efficiency not set"),
        ({"depth_of_discharge_ratio": None}, "depth of discharge not set"),
        ({"initial_soc_ratio": None}, "initial state of charge not set"),
        ({"initial_soc_ratio": 0.2}, "initial state of charge is at or below the discharge limit"),
    ],
)
def test_fr_118_autonomy_not_evaluated_names_the_field(over: dict[str, Any], reason: str) -> None:
    a = autonomy(full("INV2", 8, 2, **over), 0, powers(), None, None)
    assert (a["outcome"], a["reason"], a["curve"]) == ("NOT_EVALUATED", reason, [])


def test_fr_117_no_profile_and_failed_hour() -> None:
    assert autonomy(full("INV2", 8, 2), 0, [], None, "no daily load profile")["reason"] == (
        "no daily load profile"
    )
    failed = {"step": 3, "clock_hour": 3, "status_code": "NO_CONVERGENCE"}
    a = autonomy(full("INV1", 8, 8), 0, powers()[:3], failed, None)
    assert a["outcome"] == "NOT_EVALUATED" and len(a["curve"]) == 3
    assert a["reason"] == "M1 at clock hour 3 gave NO_CONVERGENCE"
    # a bank that ran out before the failed hour keeps DEPLETED (D-110 K324)
    late = {"step": 20, "clock_hour": 20, "status_code": "NO_CONVERGENCE"}
    assert autonomy(full("INV2", 8, 2), 0, powers()[:20], late, None)["outcome"] == "DEPLETED"


def test_fr_117_negative_inverter_power_not_evaluated() -> None:
    p = powers()
    p[2] = {"INV1": -1.0}
    a = autonomy(full("INV1", 8, 8), 0, p, None, None)
    assert a["reason"] == "inverter absorbs power at clock hour 2; charging is not modelled"


def test_eq_12_9_lambdas_and_scaling() -> None:
    from fixtures.designs import two_bus_snapshot  # noqa: PLC0415

    snap = two_bus_snapshot()
    assert lambdas(ProjectSnapshot.model_validate(snap)) == (None, "no daily load profile")
    snap["load_profile"] = {
        "id": "PF",
        "values": [{"hour": h, "p_kw": 10 * x} for h, x in enumerate(LAM)],
    }
    s = ProjectSnapshot.model_validate(snap)
    lam, reason = lambdas(s)
    assert reason is None and lam == pytest.approx(LAM)
    loads = scaled(s, 0.4).loads or []
    assert [(ld.p_kw, ld.q_kvar, ld.power_factor) for ld in loads] == [
        (2.0, 0.0, None),
        (2.0, None, 1.0),
    ]
