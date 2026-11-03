"""Seam 5: UX and analytics round (Doc 12 X0, X1; Doc 9 D-72).

FR-93 (the latest result on the current design survives leaving a screen; a design edit hides it),
FR-86 (a chart figure's "Show data" table lists as many rows as the payload).
"""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _run_m1


def test_fr_93_result_survives_leaving_and_hides_after_edit(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    record = page.get_by_test_id("record-id").inner_text()

    page.get_by_role("link", name="1 Loads").click()
    page.get_by_role("link", name="5 Power flow (M1)").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    expect(page.get_by_test_id("record-id")).to_have_text(record)

    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Inverters").click()
    page.get_by_label("Rating (kVA) of INV1").fill("50")
    page.get_by_role("link", name="5 Power flow (M1)").click()
    expect(page.get_by_text("No result on this screen.")).to_be_visible()
    expect(page.get_by_test_id("record-id")).to_have_count(0)


def test_fr_86_show_data_lists_the_payload_rows(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="8 Report").click()
    title = "Bus voltage magnitude from the latest power flow (M1)"
    expect(page.get_by_role("img", name="Bus voltage (p.u.) bar chart, 2 bars")).to_be_visible()
    expect(page.get_by_text("FAKE engine: placeholder, not an engine result")).to_be_visible()
    show = page.get_by_role("button", name=f"Show data: {title}")
    expect(show).to_have_attribute("aria-expanded", "false")
    show.click()
    expect(show).to_have_attribute("aria-expanded", "true")
    data = page.get_by_role("table", name=f"{title} data")
    buses = page.get_by_role("table", name="Bus voltages")
    expect(data.locator("tbody tr")).to_have_count(buses.locator("tbody tr").count())
    expect(data).to_contain_text("B1")
