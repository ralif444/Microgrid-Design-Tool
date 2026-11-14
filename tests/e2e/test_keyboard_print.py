"""Seam 5: carried conditions of exit gate 1.2 (gate log).

(a) Doc 8 §8 DoD item 7 / Doc 7 §8: one key flow, Start → Network → Loads → M1 → Report, with
every control reached by Tab and operated by keyboard only.
(c) FR-60 (Should): in print media the report hides the controls and nothing is wider than an A4
printable width, so no table or chart is clipped.
"""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot, step, step_link
from playwright.sync_api import Locator, Page, expect
from test_report_runs import _m1_m2

A4_PRINTABLE_PX = 718  # 190 mm at 96 px/in (A4 minus 10 mm margins)


def _tab_to(page: Page, target: Locator, limit: int = 250) -> None:
    """Press Tab until `target` has focus; fails if it is not in the tab order."""
    for _ in range(limit):
        if target.evaluate("e => e === document.activeElement"):
            return
        page.keyboard.press("Tab")
    raise AssertionError(f"not reachable by Tab: {target}")


def _type(page: Page, target: Locator, text: str) -> None:
    _tab_to(page, target)
    page.keyboard.press("Control+A")
    page.keyboard.type(text)


def _press(page: Page, target: Locator, key: str = "Enter") -> None:
    _tab_to(page, target)
    page.keyboard.press(key)


def test_dod_7_key_flow_by_keyboard_only(
    server: Callable[[str], str], page: Page
) -> None:
    page.goto(server("default") + "/")
    _type(page, page.get_by_label("Project name"), "Keyboard project")
    _type(page, page.get_by_label("Nominal voltage, line-to-line (kV)"), "0.4")
    _press(page, page.get_by_role("button", name="Create project"))
    expect(page.get_by_role("heading", name="Model", level=1)).to_be_visible()

    _press(page, step_link(page, "Network", go=lambda t: _press(page, t)))
    for bus in ("B1", "B2"):
        _type(page, page.get_by_label("Bus id", exact=True), bus)
        page.keyboard.press("Enter")  # submits the add-bus form
    expect(page.get_by_role("table", name="Buses").locator("tbody tr")).to_have_count(2)

    _press(page, page.get_by_role("tab", name="Lines"))
    _press(page, page.get_by_role("button", name="+ Add line"))
    _press(page, page.get_by_label("From bus of LN1"), "ArrowDown")
    _press(page, page.get_by_label("To bus of LN1"), "ArrowDown")
    page.keyboard.press("ArrowDown")
    expect(page.get_by_label("From bus of LN1")).to_have_value("B1")
    expect(page.get_by_label("To bus of LN1")).to_have_value("B2")
    for label, value in (
        ("R (Ω/km)", "0.1"),
        ("X (Ω/km)", "0.1"),
        ("Length (km)", "1"),
    ):
        _type(page, page.get_by_label(f"{label} of LN1", exact=True), value)

    _press(page, page.get_by_role("tab", name="Inverters"))
    _press(page, page.get_by_role("button", name="+ Add inverter"))
    for label, value in (
        ("Rating (kVA)", "10"),
        ("P–f droop (Hz/kW)", "0.05"),
        ("Q–V droop (kV/kvar)", "0.001"),
        ("Frequency setpoint (Hz)", "50"),
        ("Voltage setpoint, line-to-line (kV)", "0.4"),
    ):
        _type(page, page.get_by_label(f"{label} of INV1", exact=True), value)

    _press(page, step_link(page, "Loads", go=lambda t: _press(page, t)))
    _press(page, page.get_by_role("button", name="+ Add load"))
    row = page.get_by_test_id("load-L1")
    _type(page, row.get_by_label("P of L1 (kW)"), "5")
    _type(page, row.get_by_label("Q of L1 (kvar)"), "0")

    _press(page, step_link(page, "Power flow (M1)", go=lambda t: _press(page, t)))
    expect(page.get_by_text("No problems found.")).to_be_visible()
    _press(page, page.get_by_role("button", name="Run M1"))
    expect(page.get_by_role("status", name="Status")).to_have_attribute(
        "data-status", "FEASIBLE"
    )

    _press(page, step_link(page, "Report", go=lambda t: _press(page, t)))
    expect(page.get_by_role("table", name="Traceability")).to_contain_text("M1")
    _press(page, step_link(page, "Run history", go=lambda t: _press(page, t)))
    expect(page.get_by_role("table", name="Runs").locator("tbody tr")).to_have_count(1)


def test_fr_60_report_print_layout(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _m1_m2(page)
    step(page, "Report")
    expect(page.get_by_role("img", name="Bus voltage (p.u.) bar chart")).to_be_visible()
    page.set_viewport_size({"width": A4_PRINTABLE_PX, "height": 1000})
    page.emulate_media(media="print")
    expect(page.locator("header")).to_be_hidden()
    expect(page.get_by_role("button", name="Print / Save as PDF")).to_be_hidden()
    expect(page.get_by_role("table", name="Traceability")).to_be_visible()
    width = page.evaluate("document.documentElement.scrollWidth")
    assert width <= A4_PRINTABLE_PX, f"report is {width}px wide in print"
