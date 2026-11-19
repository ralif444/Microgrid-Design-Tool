"""Seam 5: X11 reactor guidance and sizing advice RS on S-13 (FR-126, ADR-017; Doc 9 D-119).

Real Engine on the catalogue D2: M4a is UNSTABLE, the panel offers RS, which finds the BLOCK
reactors; Apply adds them and the re-run M4a is STABLE, so the panel goes away.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from flows import step
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _run_m1


def _run_m4a(page: Page) -> None:
    step(page, "Small-signal (M4a)")
    page.get_by_role("button", name="Run small-signal analysis").click()
    expect(page.get_by_role("status", name="Status").first).to_have_attribute("data-status", "FEASIBLE")


@pytest.mark.base_catalogue
def test_fr_126_reactor_panel_find_apply_rerun(server: Callable[..., str], page: Page) -> None:
    page.goto(server("default", {"MGAPP_ENGINE": "REAL"}) + "/")
    page.get_by_role("button", name="Open example D2:").click()
    page.wait_for_url("**/workspace/")
    _run_m1(page)
    _run_m4a(page)
    expect(page.get_by_test_id("stability-class")).to_contain_text("Unstable")
    panel = page.get_by_test_id("reactor-advice")
    expect(panel.get_by_test_id("reactor-guidance")).to_be_visible()

    panel.get_by_label("Damping target ζ* (ratio)").fill("0.05")
    panel.get_by_label("Search ceiling, share of the inverter base impedance (%)").fill("10")
    panel.get_by_role("button", name="Size coupling reactors").click()
    result = panel.get_by_test_id("reactor-result")
    expect(result).to_have_attribute("data-outcome", "FOUND", timeout=60_000)
    expect(result).to_contain_text("RCT-BLOCK-LR3-40-4-100")
    expect(result).to_contain_text("RCT-BLOCK-LR3-40-4-70")
    expect(panel.get_by_test_id("reactor-confirmed")).to_contain_text("STABLE")

    panel.get_by_role("button", name="Apply to the design").click()
    panel.get_by_role("button", name="Apply", exact=True).click()

    _run_m1(page)
    _run_m4a(page)
    expect(page.get_by_test_id("stability-class")).to_contain_text("Stable")
    expect(page.get_by_test_id("reactor-advice")).to_have_count(0)
