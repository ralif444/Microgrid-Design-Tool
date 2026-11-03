"""Doc 12 X8 single-line diagram on S-05 (SLD-4, D-79): diagram and table paths to the Inspector
(FR-90), the keyboard tooltip with units (FR-95) and the "View as table" equivalent (FR-98); the
results overlay on S-07 and S-08 (SLD-5, D-80, FR-96)."""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1


def _open_diagram(page: Page, base: str) -> None:
    enter_design(page, base, gui_snapshot())
    page.get_by_role("link", name="3 Network").click()
    page.get_by_text("Diagram (read-only)").click()


def test_fr_90_fr_95_diagram_tooltip_and_inspector(
    server: Callable[[str], str], page: Page
) -> None:
    _open_diagram(page, server("default"))
    line = page.get_by_role("button", name="Line LN1 from B1 to B2")
    line.focus()
    tip = page.get_by_role("tooltip")
    expect(tip).to_contain_text("Line LN1")
    expect(tip).to_contain_text("Ω/km")
    page.keyboard.press("Escape")
    expect(tip).to_have_count(0)

    page.keyboard.press("Enter")
    panel = page.get_by_role("complementary", name="Inspector: Line LN1")
    expect(panel.get_by_role("heading", name="Line LN1")).to_be_focused()
    expect(panel.get_by_label("Inputs")).to_contain_text("Ω/km")
    expect(page.get_by_role("tab", name="Lines")).to_have_attribute("aria-selected", "true")
    expect(line).to_have_attribute("aria-pressed", "true")
    page.keyboard.press("Escape")
    expect(panel).to_have_count(0)
    expect(line).to_be_focused()

    # table path (UX-4): the row's Inspect button opens the same panel
    page.get_by_role("button", name="Inspect LN1").click()
    expect(page.get_by_role("complementary", name="Inspector: Line LN1")).to_be_visible()


def test_fr_98_view_as_table_has_one_row_per_element(
    server: Callable[[str], str], page: Page
) -> None:
    _open_diagram(page, server("default"))
    drawn = page.locator('svg [data-testid^="diagram-"]')
    expect(drawn.first).to_be_visible()
    toggle = page.get_by_role("button", name="View as table")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    table = page.get_by_role("table", name="Diagram elements")
    expect(table.locator("tbody tr")).to_have_count(drawn.count())
    expect(table).to_contain_text("Line LN1")
    expect(table).to_contain_text("Ω/km")


def test_fr_96_m1_overlay_hides_after_an_edit(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    page.get_by_role("link", name="5 Power flow (M1)").click()
    note = page.get_by_test_id("sld-overlay-note")
    expect(note).to_contain_text("No power-flow result yet")
    _run_m1(page)
    bus = page.get_by_test_id("diagram-bus-B1")
    expect(bus).to_contain_text("p.u.")
    expect(note).to_have_count(0)
    expect(page.get_by_test_id("sld-fake")).to_contain_text("not engine results")
    show = page.get_by_role("button", name="Show results")
    show.click()
    expect(bus).not_to_contain_text("p.u.")
    show.click()
    expect(bus).to_contain_text("p.u.")

    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Inverters").click()
    page.get_by_label("Rating (kVA) of INV1").fill("50")
    page.get_by_role("link", name="5 Power flow (M1)").click()
    expect(note).to_contain_text("Outdated: design changed after this run. Re-run M1.")
    expect(bus).not_to_contain_text("p.u.")


def test_fr_96_m2_overlay_marks_violated_elements(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_test_id("sld-overlay-note")).to_contain_text("No current constraint check")
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "INFEASIBLE")
    expect(
        page.locator('svg [data-testid^="diagram-"]').filter(has_text="Violated").first
    ).to_be_visible()
    page.get_by_role("button", name="Inverter INV1 at bus").click()
    expect(page.get_by_role("complementary", name="Inspector: Inverter INV1")).to_be_visible()
