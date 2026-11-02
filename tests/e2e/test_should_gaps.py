"""Seam 5 (Exit 1.5): Should FRs that had no E2E of their own (D-66).

FR-09 (inverter drafts from accepted advice), FR-26 (near-limit highlight), FR-45 (in-progress
state while navigation stays usable).
"""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, Route, expect
from test_network_m1_m2 import _margins, _run_m1


def test_fr_09_accepted_advice_prefills_inverter_drafts(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    page.get_by_role("link", name="2 Sizing advice").click()
    page.get_by_label("Inverter margin m_inv (ratio)").fill("0.2")
    page.get_by_label("Number of inverter units n (count)").fill("2")
    page.get_by_label("Redundancy r (0 or 1) (count)").fill("0")
    page.get_by_role("button", name="Run advice").click()
    expect(page.get_by_test_id("advice-state")).to_have_text("State: PROPOSED")
    expect(page.get_by_role("button", name="Add 2 inverter drafts", exact=False)).to_have_count(0)
    page.get_by_role("button", name="Accept").click()
    page.get_by_role("button", name="Add 2 inverter drafts", exact=False).click()
    expect(page.get_by_role("status").filter(has_text="drafts added")).to_be_visible()

    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Inverters").click()
    for inv in ("INV3", "INV4"):
        expect(page.get_by_label(f"Rating (kVA) of {inv}")).to_be_editable()
    page.get_by_label("Rating (kVA) of INV3").fill("12")
    expect(page.get_by_label("Rating (kVA) of INV3")).to_have_value("12")


def test_fr_26_near_limit_highlight(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m2-near-limit"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    rows = page.get_by_role("table", name="All evaluated margins").locator("tbody tr")
    expect(rows.nth(0)).to_contain_text("Near limit")  # normalised 0.02 < 0.05
    expect(rows.nth(1)).not_to_contain_text("Near limit")  # normalised 0.1


def test_fr_45_in_progress_state_keeps_navigation(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    held: list[Route] = []
    page.route("**/api/analyses/M1", lambda r: held.append(r))
    page.get_by_role("link", name="5 Power flow (M1)").click()
    page.get_by_role("button", name="Run M1").click()
    expect(page.get_by_role("button", name="Running...")).to_be_visible()
    for name in ("3 Network", "6 Constraint check (M2)"):
        expect(page.get_by_role("link", name=name)).to_be_enabled()
    assert held, "M1 request was not held"
    held[0].continue_()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
