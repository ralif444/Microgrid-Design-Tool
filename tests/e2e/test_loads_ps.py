"""Seam 5 (WP 1.2.1): S-01 → S-02 → S-05 (bus) → S-03 → S-04 on the Fake Engine.

FR-01 (new Project), FR-03, FR-18 (load rows with inline messages), FR-05 (unit on every
numeric input), FR-06 (PS run), FR-08 (advice is not design data; stale after a load edit).
"""

from __future__ import annotations

import re
from collections.abc import Callable

from playwright.sync_api import Page, expect

UNIT = re.compile(r"\(.+\)")


def _numeric_inputs_have_units(page: Page) -> None:
    expect(page.locator("input[type=number]").first).to_be_visible()  # wait for the screen
    names = page.locator("input[type=number]").evaluate_all(
        "els => els.map(e => e.getAttribute('aria-label')"
        " || (e.labels[0] && e.labels[0].textContent) || '')"
    )
    assert names, "no numeric inputs found"
    assert all(UNIT.search(n) for n in names), names


def test_fr_01_fr_03_fr_05_fr_06_fr_08_loads_to_sizing_advice(
    server: Callable[[str], str],
    page: Page,  # noqa: F811
) -> None:
    page.goto(server("default") + "/loads/")
    expect(page.get_by_text("Create or open a Project first")).to_be_visible()

    page.goto(server("default") + "/")
    _numeric_inputs_have_units(page)
    page.get_by_label("Project name").fill("E2E project")
    page.get_by_label("Nominal voltage, line-to-line (kV)").fill("0.4")
    page.get_by_role("button", name="Create project").click()
    expect(page.get_by_role("heading", name="Project overview")).to_be_visible()
    expect(page.get_by_test_id("project-name")).to_contain_text("E2E project")
    expect(page.get_by_role("table", name="Counts")).to_contain_text("Loads0")
    _numeric_inputs_have_units(page)

    page.get_by_role("link", name="3 Network").click()
    page.get_by_label("Bus id", exact=True).fill("B1")
    page.get_by_role("button", name="Add bus").click()
    page.get_by_role("link", name="1 Loads").click()
    page.get_by_role("button", name="+ Add load").click()
    row = page.get_by_test_id("load-L1")
    expect(row.get_by_label("Bus of L1")).to_have_value("B1")
    row.get_by_label("P of L1 (kW)").fill("-1")
    row.get_by_label("Q of L1 (kvar)").fill("0")
    expect(row).to_contain_text("Power cannot be negative")  # FR-18, inline
    row.get_by_label("P of L1 (kW)").fill("5")
    expect(row).not_to_contain_text("Power cannot be negative")
    _numeric_inputs_have_units(page)

    page.get_by_role("link", name="2 Sizing advice").click()
    _numeric_inputs_have_units(page)
    page.get_by_label("Inverter margin m_inv (ratio)").fill("0.2")
    page.get_by_label("Number of inverter units n (count)").fill("2")
    page.get_by_label("Redundancy r (0 or 1) (count)").fill("0")
    page.get_by_role("button", name="Run advice").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    advice = page.get_by_role("region", name="Sizing advice")
    expect(advice).to_contain_text("Advice (not design data)")
    expect(advice).to_contain_text("Fake Engine placeholder")  # basis shown (FR-07)
    expect(page.get_by_test_id("advice-state")).to_have_text("State: PROPOSED")
    page.get_by_role("button", name="Accept").click()
    expect(page.get_by_test_id("advice-state")).to_have_text("State: ACCEPTED")

    page.get_by_role("link", name="Project", exact=True).click()
    expect(page.get_by_role("table", name="Counts")).to_contain_text("Inverters0")  # FR-08

    page.get_by_role("link", name="1 Loads").click()
    page.get_by_test_id("load-L1").get_by_label("P of L1 (kW)").fill("6")
    page.get_by_role("link", name="2 Sizing advice").click()
    expect(page.get_by_test_id("advice-stale")).to_be_visible()
