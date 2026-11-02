"""Seam 5 (WP 1.5.2): S-09 Sensitivity, S-10 Sweep, S-11 Scenarios on the Fake Engine.

FR-28 (M3a), FR-29 and FR-44 with flow F4 (sweep refused over the cap), FR-30, FR-31 (scenarios
and comparison), FR-39 (Run blocked without a current M1), FR-05 (units on numeric inputs).
"""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_loads_ps import _numeric_inputs_have_units
from test_network_m1_m2 import _run_m1


def _status(page: Page, status: str) -> None:
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", status)


def test_fr_28_fr_29_fr_44_fr_30_fr_31_further_analyses(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())

    page.get_by_role("link", name="Sensitivity (M3a)").click()
    expect(page.get_by_role("button", name="Run M3a")).to_be_disabled()  # FR-39: no M1 yet
    expect(page.get_by_test_id("m1-blocked")).to_be_visible()
    _run_m1(page)

    page.get_by_role("link", name="Sensitivity (M3a)").click()
    page.get_by_label("inverters/INV1/rated_kva").check()
    page.get_by_label("System frequency (Hz)").check()
    page.get_by_label("Step (ratio)").fill("0.01")
    _numeric_inputs_have_units(page)
    page.get_by_role("button", name="Run M3a").click()
    _status(page, "FEASIBLE")
    expect(page.get_by_role("table", name="Sensitivity of System frequency")).to_contain_text(
        "inverters/INV1/rated_kva"
    )

    page.get_by_role("link", name="Sweep (M3b)").click()
    expect(page.get_by_role("heading", name="Sweep (M3b)")).to_be_visible()
    page.get_by_label("Parameter", exact=True).select_option("inverters/INV1/rated_kva")
    page.get_by_label("From (kVA)").fill("5")
    page.get_by_label("To (kVA)").fill("15")
    page.get_by_label("Points (count)").fill("3")
    expect(page.get_by_test_id("sweep-size")).to_contain_text("(ok)")
    page.get_by_role("button", name="Run sweep").click()
    _status(page, "FEASIBLE")
    expect(page.get_by_role("table", name="Sweep points").locator("tbody tr")).to_have_count(3)
    expect(page.get_by_test_id("first-infeasible")).to_have_text(
        "First infeasible value: none in range"
    )
    expect(page.get_by_role("img", name="System frequency (Hz) against")).to_be_visible()

    page.get_by_label("Points (count)").fill("1001")  # F4: over the cap of 1000
    expect(page.get_by_test_id("sweep-size")).to_contain_text("too many")
    page.get_by_role("button", name="Run sweep").click()
    _status(page, "INPUT_INVALID")
    expect(page.get_by_role("status", name="Status")).to_contain_text("SWEEP_CAP_EXCEEDED")

    page.get_by_role("link", name="Scenarios (M3c)").click()
    expect(page.get_by_text("No scenarios yet.")).to_be_visible()
    for name in ("Base", "Bigger load"):
        page.get_by_label("Scenario name").fill(name)
        page.get_by_role("button", name="Save current design as Scenario").click()
    page.get_by_label("Change in Bigger load").select_option("loads/L1/p_kw")
    page.get_by_label("New value for Bigger load (kW)").fill("7")
    page.get_by_role("button", name="Add change to Bigger load").click()
    expect(page.get_by_role("list", name="Overrides of Bigger load")).to_contain_text(
        "loads/L1/p_kw = 7 kW"
    )
    expect(page.get_by_role("button", name="Compare")).to_be_disabled()
    page.get_by_label("Base (0 change(s))").check()
    page.get_by_label("Bigger load (1 change(s))").check()
    page.get_by_role("button", name="Compare").click()
    _status(page, "FEASIBLE")
    expect(page.get_by_role("table", name="Scenario comparison")).to_contain_text("Bigger load")


def test_fr_32_fr_44_envelope(server: Callable[[str], str], page: Page) -> None:
    """S-12 (WP 1.5.5, Could): two axes, grid of Status, feasible fraction, cap on the product."""
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="Envelope (M3d)").click()
    page.get_by_label("X axis: Axis").select_option("LOAD_SCALE")
    page.get_by_label("X axis: From (factor)").fill("0.5")
    page.get_by_label("X axis: To (factor)").fill("1.5")
    page.get_by_label("X axis: Points (count)").fill("2")
    page.get_by_label("Y axis: Parameter").select_option("inverters/INV1/rated_kva")
    page.get_by_label("Y axis: From (kVA)").fill("5")
    page.get_by_label("Y axis: To (kVA)").fill("15")
    page.get_by_label("Y axis: Points (count)").fill("2")
    _numeric_inputs_have_units(page)
    page.get_by_role("button", name="Run envelope").click()
    _status(page, "FEASIBLE")
    expect(page.get_by_role("table", name="Envelope grid").locator("tbody tr")).to_have_count(2)
    expect(page.get_by_test_id("feasible-fraction")).to_have_text(
        "Feasible fraction: 100 % of 4 points"
    )

    page.get_by_label("X axis: Points (count)").fill("40")
    page.get_by_label("Y axis: Points (count)").fill("30")  # 1200 > cap 1000
    expect(page.get_by_test_id("sweep-size")).to_contain_text("too many")
    page.get_by_role("button", name="Run envelope").click()
    _status(page, "INPUT_INVALID")
    expect(page.get_by_role("status", name="Status")).to_contain_text("SWEEP_CAP_EXCEEDED")
