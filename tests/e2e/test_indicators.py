"""Seam 5 (WP 1.5.1): validity-indicator panel and A1-A6 checklist on the Fake Engine.

FR-61 (four rows with assumption and value; not evaluated shows the reason), FR-62 (no threshold
version: label, no colour), FR-63 (six A1-A6 rows with handling; indicator rows carry the value
and the RunRecord hash). Profile `m4a-indicators` carries placeholder indicator values.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _run_m1


def test_fr_61_fr_62_fr_63_panel_and_checklist(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m4a-indicators"), gui_snapshot())
    _run_m1(page)
    panel = page.get_by_role("table", name="Validity indicators")
    expect(panel).to_contain_text("threshold not yet calibrated")
    expect(panel.locator("tbody tr").nth(0)).to_contain_text(
        "not evaluated: run small-signal (M4a)"
    )

    page.get_by_role("link", name="Small-signal (M4a)").click()
    page.get_by_role("button", name="Run M4a").click()
    rows = panel.locator("tbody tr")
    expect(rows).to_have_count(4)
    for k, (assumption, value) in enumerate(
        [
            ("A1", "0.11"),
            ("A1", "0.22"),
            ("A2", "not evaluated: tau_in_s not given"),
            ("A4", "0.44"),
        ]
    ):
        expect(rows.nth(k).locator("td").nth(1)).to_have_text(assumption)
        expect(rows.nth(k).locator("td").nth(2)).to_have_text(value)
    expect(panel.locator("[style], [class]")).to_have_count(0)  # FR-62: no colour role

    page.get_by_role("link", name="8 Report").click()
    checklist = page.get_by_role("table", name="Model assumptions").locator("tbody tr")
    expect(checklist).to_have_count(6)
    expect(checklist.nth(0)).to_contain_text("Checked by indicator (r_τ, κ)")
    expect(checklist.nth(0)).to_contain_text("r_τ: 0.11; κ: 0.22")
    expect(checklist.nth(0).locator("code")).to_have_text(re.compile(r"^[0-9a-f]{64}$"))
    expect(checklist.nth(2)).to_contain_text("Set by the user; explored by sweep (M3b)")
    expect(checklist.nth(5)).to_contain_text("By construction")
    expect(checklist.nth(5).locator("code")).to_have_count(0)
