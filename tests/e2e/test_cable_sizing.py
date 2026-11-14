"""Seam 5 (X10, ticket 05): S-19 Cable and breaker sizing on the Fake Engine (D-103).

FR-105 (screen hidden when the flag is off), FR-112 (settings, Run gated on a valid M2, status
banner, fixed caveat above the results table, expandable factor rows). The table file is the
FICTITIOUS `FAKE_cable_tables_TEST_ONLY.json` (round numbers, not PUIL).
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from flows import enter_design, gui_snapshot, step, studies
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1

FLAG_ON = {"MGAPP_FEATURE_CABLE_SIZING": "1"}
TABLES = Path(__file__).parents[1] / "fixtures" / "FAKE_cable_tables_TEST_ONLY.json"
CAVEAT = (
    "Grid-forming inverters limit their fault current. A breaker sized here for overload may "
    "not trip on a fault in islanded operation. Fault protection is not assessed by this tool."
)


def test_fr_105_screen_hidden_when_flag_off(
    server: Callable[..., str], page: Page
) -> None:
    base = server("default")
    enter_design(page, base, gui_snapshot())
    further = studies(page)
    expect(further.get_by_role("link", name="Transient (M4b)")).to_be_visible()
    expect(further.get_by_role("link", name="Cable and breaker sizing")).to_have_count(
        0
    )
    page.goto(f"{base}/cable-sizing/")
    expect(page.get_by_test_id("cable-sizing-off")).to_be_visible()
    expect(page.get_by_role("button", name="Run cable sizing")).to_have_count(0)


def test_fr_112_run_shows_caveat(server: Callable[..., str], page: Page) -> None:
    enter_design(page, server("default", env=FLAG_ON), gui_snapshot())
    link = studies(page).get_by_role("link", name="Cable and breaker sizing")
    link.click()
    run = page.get_by_role("button", name="Run cable sizing")
    expect(run).to_be_disabled()  # no M2 yet (Doc 7 §3.1)
    expect(page.get_by_test_id("cable-m2-gate")).to_contain_text(
        "Run the constraint check (M2) first"
    )

    _run_m1(page)
    step(page, "Constraint check (M2)")
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute(
        "data-status", "FEASIBLE"
    )

    studies(page).get_by_role("link", name="Cable and breaker sizing").click()
    expect(run).to_be_disabled()  # no table file yet
    page.get_by_label("Load table file (JSON)").set_input_files(TABLES)
    expect(page.get_by_test_id("table-file")).to_contain_text("FAKE_TEST_ONLY")
    page.get_by_label("Method", exact=True).select_option("B1")
    page.get_by_label("Conductor", exact=True).select_option("CU")
    page.get_by_label("Insulation", exact=True).select_option("PVC")
    page.get_by_label("Ambient temperature (°C)").fill("30")
    page.get_by_label("Grouping count").fill("1")
    page.get_by_label("Grouping arrangement", exact=True).select_option("BUNCHED")
    page.get_by_label("Cable construction", exact=True).select_option("MULTICORE")
    run.click()

    expect(page.get_by_role("status", name="Status")).to_have_attribute(
        "data-status", "FEASIBLE"
    )
    caveat = page.get_by_test_id("cable-caveat")
    expect(caveat).to_have_text(CAVEAT)
    table = page.get_by_role("table", name="Cable and breaker sizing results")
    expect(table).to_be_visible()
    # the caveat sits above the table (FR-112)
    assert caveat.bounding_box()["y"] < table.bounding_box()["y"]  # type: ignore[index]
    expect(page.get_by_test_id("cb-row-INV1")).to_contain_text("Sized")
    expect(page.get_by_test_id("cb-row-INV1")).to_contain_text("MCB")
    page.get_by_role("button", name="Factors of INV1").click()
    expect(page.get_by_test_id("cb-factors-INV1")).to_contain_text("FAKE-1")
    expect(page.get_by_test_id("cb-experimental")).to_be_visible()
