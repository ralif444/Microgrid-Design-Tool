"""Cable sizing ticket 03, FR-108 – FR-110: method IEC60364_OVERLOAD_PUIL2011 and registry.

Guideline §3, §5.1, §7.

Every expected number is a hand calculation on the FICTITIOUS fixture
`FAKE_cable_tables_TEST_ONLY.json` (round numbers, not PUIL, not real k2 or rated-current data).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from mgapp.services.cable_sizing.method import (
    METHOD_ID,
    CableSizingSettings,
    ElementSizing,
    SizingElement,
    corrected_resistance,
    inverter_rated_current_a,
)
from mgapp.services.cable_sizing.registry import get_method, method_ids
from mgapp.services.cable_sizing.tables import CableTables, TableIssueCode, load_tables

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "FAKE_cable_tables_TEST_ONLY.json"
AIR = {
    "method": "B1",
    "conductor": "CU",
    "insulation": "PVC",
    "ambient_temp_c": 30,
    "grouping_count": 1,
    "grouping_arrangement": "BUNCHED",
    "cable_construction": "MULTICORE",
}
DUCT = {
    "method": "D_DUCT",
    "conductor": "AL",
    "insulation": "XLPE",
    "ambient_temp_c": 30,
    "soil_resistivity_k_m_per_w": 2,
    "grouping_count": 1,
    "grouping_arrangement": "DUCT_TOUCHING",
    "cable_construction": "MULTICORE",
}


@pytest.fixture
def raw() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def tables(raw: dict[str, Any]) -> CableTables:
    return load_tables(raw)


def line(ib: float, r: float | None = None, eid: str = "L1") -> SizingElement:
    return SizingElement(
        element_id=eid,
        element_kind="LINE",
        ib_a=ib,
        ib_source="M2.sizing_check.per_line",
        r_line_ohm_per_km=r,
    )


def size_one(tables: CableTables, ib: float, **over: Any) -> ElementSizing:
    settings = CableSizingSettings.model_validate({**AIR, **over})
    [out] = get_method(METHOD_ID).size([line(ib)], settings, tables)
    return out


def test_sized_with_all_factors_one(tables: CableTables) -> None:
    out = size_one(tables, 15)
    assert out.outcome == "SIZED"
    assert (out.device.device_class, out.device.in_a, out.device.i2_a) == ("MCB", 20, 20)
    assert out.cable is not None
    assert (out.cable.size_mm2, out.cable.i_tab_a, out.cable.iz_a) == (10, 100, 100)
    assert (out.cable.k_theta, out.cable.k_rho, out.cable.k_g) == (1, 1, 1)


def test_lookup_next_more_severe_value(tables: CableTables) -> None:
    out = size_one(tables, 15, ambient_temp_c=35, grouping_count=2)
    assert out.outcome == "SIZED"
    assert out.cable is not None
    assert out.cable.lookup_values.temp_c_used == 40
    assert out.cable.lookup_values.group_used == 2
    assert out.cable.iz_a == 25  # 100 · 0.5 · 1 · 0.5


def test_value_beyond_table_is_out_of_table(tables: CableTables) -> None:
    assert size_one(tables, 15, ambient_temp_c=45).outcome == "OUT_OF_TABLE"
    assert size_one(tables, 15, grouping_count=3).outcome == "OUT_OF_TABLE"


def test_single_layer_group_beyond_table_uses_last_column(tables: CableTables) -> None:
    out = size_one(tables, 15, grouping_arrangement="SINGLE_LAYER_WALL", grouping_count=3)
    assert out.outcome == "SIZED"
    assert out.cable is not None
    assert (out.cable.lookup_values.group_used, out.cable.k_g) == (2, 0.5)


def test_blank_cell_is_gap_not_zero(tables: CableTables) -> None:
    # 40 °C: I_Z = 50, 100, 150, then a blank cell; I_n = 200 needs more.
    out = size_one(tables, 150, ambient_temp_c=40)
    assert out.outcome == "TABLE_GAP"
    assert out.cable is None


def test_cb1_cb2_both_reported(tables: CableTables) -> None:
    # I_n 200, I_2 = 2 · 200 = 400. 20 mm²: I_Z 200 meets CB.1 only; 50 mm²: I_Z 300 meets both.
    out = size_one(tables, 150)
    assert out.outcome == "SIZED"
    assert out.cable is not None and out.checks is not None
    assert out.cable.size_mm2 == 50
    assert out.checks.cond1_ok and out.checks.cond2_ok
    assert out.checks.margin_in_ib_a == 50
    assert out.checks.margin_iz_in_a == 100
    assert out.checks.margin_145iz_i2_a == pytest.approx(35)


def test_mcb_to_mccb_switch_above_63a_threshold_from_table(tables: CableTables) -> None:
    # Fake threshold max_in_a = 50: I_B 45 is MCB, but the next MCB step is 80 > 50.
    out = size_one(tables, 45)
    assert (out.device.device_class, out.device.in_a, out.device.k2) == ("MCCB", 100, 2)
    assert out.cable is not None and out.cable.size_mm2 == 20  # needs I_Z ≥ 200 / 1.45


def test_no_mcb_step_falls_through_to_mccb(raw: dict[str, Any]) -> None:
    # D-101 K273 (user 2026-11-09): MCB series [10, 20, 40], I_B 45 ≤ 50 → no MCB step → MCCB.
    raw["device_classes"][0]["in_series_a"] = [10, 20, 40]
    out = size_one(load_tables(raw), 45)
    assert out.outcome == "SIZED"
    assert (out.device.device_class, out.device.in_a) == ("MCCB", 100)


def test_no_mcb_and_no_mccb_step_is_no_device_fits(raw: dict[str, Any]) -> None:
    raw["device_classes"][0]["in_series_a"] = [10, 20, 40]
    raw["device_classes"][1]["in_series_a"] = [30]
    out = size_one(load_tables(raw), 45)
    assert out.outcome == "NO_DEVICE_FITS"
    assert (out.device.device_class, out.device.in_a) == ("MCCB", None)


def test_ib_above_threshold_starts_as_mccb(tables: CableTables) -> None:
    assert size_one(tables, 55).device.device_class == "MCCB"


def test_no_device_fits(tables: CableTables) -> None:
    out = size_one(tables, 250)
    assert out.outcome == "NO_DEVICE_FITS"
    assert out.device.in_a is None and out.cable is None


def test_no_size_fits(tables: CableTables) -> None:
    settings = CableSizingSettings.model_validate(DUCT)  # ground 30 °C: I_Z = 50 … 200
    [out] = get_method(METHOD_ID).size([line(150)], settings, tables)
    assert out.outcome == "NO_SIZE_FITS"


def test_duct_method_uses_ground_and_resistivity(tables: CableTables) -> None:
    settings = CableSizingSettings.model_validate(
        {**DUCT, "ambient_temp_c": 20, "soil_resistivity_k_m_per_w": 1}
    )
    [out] = get_method(METHOD_ID).size([line(150)], settings, tables)
    assert out.cable is not None
    assert (out.cable.k_theta, out.cable.k_rho, out.cable.size_mm2) == (1, 2, 20)


def test_per_element_override(tables: CableTables) -> None:
    settings = CableSizingSettings.model_validate(
        {**AIR, "per_element_overrides": {"L2": {"ambient_temp_c": 40}}}
    )
    a, b = get_method(METHOD_ID).size([line(15), line(15, eid="L2")], settings, tables)
    assert a.cable is not None and b.cable is not None
    assert (a.cable.k_theta, b.cable.k_theta) == (1, 0.5)


def test_r_correction_cu_al() -> None:
    assert corrected_resistance(2, "CU", "PVC") == pytest.approx(609 / 254.5)  # 2 · 304.5/254.5
    assert corrected_resistance(4, "AL", "XLPE") == pytest.approx(1272 / 248)  # 4 · 318/248


def test_line_r_mismatch_flag(tables: CableTables) -> None:
    settings = CableSizingSettings.model_validate(AIR)
    ok, off = get_method(METHOD_ID).size([line(15, 2.5), line(15, 3.0, "L2")], settings, tables)
    assert ok.r_check is not None and off.r_check is not None
    assert not ok.r_check.flagged and "LINE_R_MISMATCH" not in ok.warnings
    assert off.r_check.flagged and off.warnings == ["LINE_R_MISMATCH"]
    assert off.r_check.deviation_ratio == pytest.approx((3.0 - 609 / 254.5) / (609 / 254.5))


def test_inverter_feeder_has_no_r_check(tables: CableTables) -> None:
    feeder = SizingElement(
        element_id="INV1",
        element_kind="INVERTER_FEEDER",
        ib_a=15,
        ib_source="inverter_rated_current",
    )
    [out] = get_method(METHOD_ID).size([feeder], CableSizingSettings.model_validate(AIR), tables)
    assert out.outcome == "SIZED" and out.r_check is None


def test_inverter_rated_current() -> None:
    assert inverter_rated_current_a(100, 0.4) == pytest.approx(100 / (3**0.5 * 0.4))


def test_registry_has_the_v1_method() -> None:
    assert method_ids() == [METHOD_ID]
    assert get_method(METHOD_ID).method_id == "IEC60364_OVERLOAD_PUIL2011"
    with pytest.raises(KeyError):
        get_method("NOPE")


def test_validate_checks_tables_for_the_effective_settings(raw: dict[str, Any]) -> None:
    raw["k_theta_air"].pop("PVC")
    raw["device_classes"][0]["max_in_a"] = None
    settings = CableSizingSettings.model_validate(
        {
            **AIR,
            "per_element_overrides": {
                "L2": {"method": "C", "grouping_arrangement": "SINGLE_LAYER_WALL"}
            },
        }
    )
    issues = get_method(METHOD_ID).validate(settings, load_tables(raw))
    assert {i.code for i in issues} == {TableIssueCode.CABLE_TABLES_INCOMPLETE}
    text = " ".join(i.message for i in issues)
    assert "k_theta_air" in text and "max_in_a" in text and "method C" in text


def test_arrangement_must_fit_the_method() -> None:
    with pytest.raises(ValidationError):
        CableSizingSettings.model_validate({**AIR, "grouping_arrangement": "DUCT_TOUCHING"})
    with pytest.raises(ValidationError):
        CableSizingSettings.model_validate({**DUCT, "grouping_arrangement": "BUNCHED"})
    with pytest.raises(ValidationError):
        CableSizingSettings.model_validate({**AIR, "method": "C"})  # C uses row 2 or 3
    with pytest.raises(ValidationError):
        CableSizingSettings.model_validate({**DUCT, "soil_resistivity_k_m_per_w": None})
