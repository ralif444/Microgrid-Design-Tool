"""Seam 5 (WP 1.2.2): S-05 → S-06 → S-07 → S-08 on the Fake Engine (F1 core up to M2).

FR-05 (units), FR-10, FR-12, FR-13 (tables), FR-19 (topology issue shown), FR-15, FR-16
(empty limits "not evaluated"), FR-24, FR-25, FR-27 (M2 result parts), stale-M1 rule (Doc 7
§3.1, D-46), FR-40 (M2 blocked while M1 is stale).
"""

from __future__ import annotations

from collections.abc import Callable

from flows import delete, enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_loads_ps import _numeric_inputs_have_units


def _run_m1(page: Page) -> None:
    page.get_by_role("link", name="5 Power flow (M1)").click()
    page.get_by_role("button", name="Run M1").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    expect(page.get_by_test_id("m1-freshness")).to_have_text("M1 result: current")


def _margins(page: Page) -> None:
    page.get_by_label("Inverter design margin m_inv (ratio)").fill("0.2")
    page.get_by_label("Line design margin m_line (ratio)").fill("0.2")


def test_fr_10_fr_19_fr_15_fr_24_fr_27_fr_40_network_to_m2(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    enter_design(page, base, gui_snapshot())

    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Lines").click()
    expect(page.get_by_label("Total R, derived, read-only (Ω) of LN1")).to_have_text("0.1")
    _numeric_inputs_have_units(page)
    page.get_by_role("tab", name="Inverters").click()
    _numeric_inputs_have_units(page)
    page.get_by_role("tab", name="Buses").click()
    page.get_by_label("Bus id", exact=True).fill("B9")
    page.get_by_role("button", name="Add bus").click()
    expect(page.get_by_role("list", name="Network issues")).to_contain_text(
        "This bus is not connected"
    )
    delete(page, "B9")
    expect(page.get_by_text("No network-level problems found.")).to_be_visible()

    page.get_by_role("link", name="4 Constraints").click()
    _numeric_inputs_have_units(page)
    expect(page.get_by_test_id("not-evaluated-voltage_min_pu")).to_be_visible()
    page.get_by_label("Bus voltage, lower limit (p.u.)").fill("1.05")
    page.get_by_label("Bus voltage, upper limit (p.u.)").fill("0.95")
    expect(page.get_by_text("The lower limit must be below the upper limit.")).to_be_visible()
    page.get_by_label("Bus voltage, lower limit (p.u.)").fill("")
    page.get_by_label("Bus voltage, upper limit (p.u.)").fill("")

    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_role("button", name="Run M2")).to_be_disabled()
    expect(page.get_by_test_id("m1-blocked")).to_contain_text("Run power flow (M1) first")

    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _numeric_inputs_have_units(page)
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    expect(page.get_by_role("list", name="Not evaluated")).to_contain_text(
        "Bus voltage, lower limit, B1"
    )
    expect(page.get_by_test_id("m2-warning")).to_contain_text("not evaluated")
    expect(page.get_by_role("region", name="Sizing check")).to_contain_text(
        "advisory, from the network"
    )
    expect(page.get_by_text("solution existence, not a stability limit")).to_be_visible()

    # edit after M1 → stale; revert → current again (hash re-check, D-46)
    page.get_by_role("link", name="1 Loads").click()
    page.get_by_test_id("load-L1").get_by_label("P of L1 (kW)").fill("6")
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_test_id("m1-freshness")).to_have_text("M1 result: stale")
    expect(page.get_by_role("button", name="Run M2")).to_be_disabled()
    expect(page.get_by_test_id("m1-blocked")).to_contain_text("Re-run M1")
    page.get_by_role("link", name="1 Loads").click()
    page.get_by_test_id("load-L1").get_by_label("P of L1 (kW)").fill("5")
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_test_id("m1-freshness")).to_have_text("M1 result: current")
    # K147: margins come back from the last M2 RunRecord after leaving the screen
    expect(page.get_by_label("Inverter design margin m_inv (ratio)")).to_have_value("0.2")
    expect(page.get_by_label("Storage autonomy t_aut, optional (h)")).to_have_value("")


def test_fr_25_infeasible_lists_limiting_constraints(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "INFEASIBLE")
    table = page.get_by_role("table", name="Limiting constraints")
    expect(table).to_contain_text("Bus voltage, lower limit")
    expect(table).to_contain_text("Inverter loading")
    expect(table).to_contain_text("Violated by")


def test_fr_84_limiting_constraint_shortcut_to_m3a(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    # Fake limiting rows are bus voltage and inverter loading; the line case is a client test.
    page.get_by_role("link", name="Most influential parameters for INV1").click()
    expect(page.get_by_role("heading", name="Sensitivity (M3a)")).to_be_visible()
    expect(page.get_by_label("inverters/INV1/rated_kva")).to_be_checked()
    expect(page.get_by_label("inverters/INV2/voltage_droop_kv_per_kvar")).to_be_checked()
    expect(page.get_by_label("lines/LN1/r_ohm_per_km")).not_to_be_checked()
    expect(page.get_by_label("Highest inverter loading (ratio)")).to_be_checked()
    expect(page.get_by_label("System frequency (Hz)")).not_to_be_checked()
    expect(page.get_by_role("status", name="Status")).to_have_count(0)  # nothing ran
