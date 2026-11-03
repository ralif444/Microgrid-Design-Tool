"""Doc 12 X8 single-line diagram on S-05 (SLD-4, D-79): diagram and table paths to the Inspector
(FR-90), the keyboard tooltip with units (FR-95) and the "View as table" equivalent (FR-98)."""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect


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
