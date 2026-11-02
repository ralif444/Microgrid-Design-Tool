"""PS level-1 hand calculations (manuscript 4.2.2, (4.2)–(4.4), (4.13); Doc 9 D-51)."""

import pytest

from mgengine.ps import StorageStage, ps, worst_window_wh
from mgengine.types import Load

LOADS = (Load("B1", 8e3, 6e3),)  # |8 + j6| = 10 kVA
PROFILE = tuple([1e3] * 22 + [6e3, 9e3])  # peak 9 kW at hour 23, 6 kW at hour 22


def test_apparent_power_is_a_vector_sum() -> None:
    r = ps((Load("B1", 3e3, 4e3), Load("B2", 3e3, -4e3)), 0.0, 1, 0)
    assert r.load_apparent_va == pytest.approx(6e3)  # not 5 + 5 kVA


def test_unit_rating_and_exact_multiple() -> None:
    # 10 kVA × 1.2 = 12 kVA over n − r = 2 units: exactly 6.0 kVA (12000.000000000002 in float)
    r = ps(LOADS, 0.2, 3, 1)
    assert r.required_inverter_va == pytest.approx(12e3)
    assert r.unit_rating_va == 6e3 and r.installed_va == 18e3


def test_unit_rating_rounds_up_to_0_1_kva() -> None:
    r = ps(LOADS, 0.0, 3, 0)  # 10/3 = 3.333 kVA → 3.4 kVA
    assert r.unit_rating_va == pytest.approx(3.4e3) and r.installed_va == pytest.approx(10.2e3)


def test_worst_window_wraps_past_midnight() -> None:
    profile = tuple([9e3] + [1e3] * 22 + [6e3])  # hours 23, 0 hold 6 + 9 kW
    assert worst_window_wh(profile, 2) == 15e3
    assert worst_window_wh(profile, 1) == 9e3  # one hour = peak power for one hour
    assert worst_window_wh(profile, 24) == sum(profile)  # 24 h = daily energy


def test_storage_stages_follow_available_parameters() -> None:
    assert ps(LOADS, 0.0, 1, 0, PROFILE).storage is None  # no autonomy_h
    ac = ps(LOADS, 0.0, 1, 0, PROFILE, 2).storage
    assert ac is not None and ac.stage is StorageStage.AC and ac.e_ac_wh == 15e3
    nom = ps(LOADS, 0.0, 1, 0, PROFILE, 2, 0.9, 0.8).storage
    assert nom is not None and nom.stage is StorageStage.NOMINAL
    assert nom.e_dc_wh == pytest.approx(15e3 / 0.9)
    assert nom.e_nom_wh == pytest.approx(15e3 / 0.9 / 0.8)


def test_profile_peak_warning_keeps_numbers() -> None:
    r = ps(LOADS, 0.0, 1, 0, PROFILE)
    assert r.profile_peak_w == 9e3 and r.profile_peak_above_loads  # 9 kW > ΣP = 8 kW
    assert r.unit_rating_va == pytest.approx(10e3)
