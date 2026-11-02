"""Seam 5 (WP 1.5.3): S-13 Small-signal and S-14 Transient on the Fake Engine.

FR-33 (M4a class, indicators "validity not calibrated" on the Real adapter only, so not asserted
here), FR-34 (four-kind disturbance catalogue, time responses, class), FR-39 (Run blocked without
a current M1), Doc 7 §6.6 state "missing disturbance: Run allowed, INPUT_INVALID names the field".
"""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_loads_ps import _numeric_inputs_have_units
from test_network_m1_m2 import _run_m1


def _status(page: Page, status: str) -> None:
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", status)


def test_fr_33_fr_34_stability_screens(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())

    page.get_by_role("link", name="Small-signal (M4a)").click()
    expect(page.get_by_role("button", name="Run M4a")).to_be_disabled()  # FR-39
    _run_m1(page)
    page.get_by_role("link", name="Small-signal (M4a)").click()
    _numeric_inputs_have_units(page)
    page.get_by_role("button", name="Run M4a").click()
    _status(page, "FEASIBLE")
    expect(page.get_by_test_id("stability-class")).to_contain_text("Stable")
    expect(page.get_by_role("table", name="Validity indicators")).to_be_visible()

    page.get_by_role("link", name="Transient (M4b)").click()
    kinds = page.get_by_label("Disturbance", exact=True).locator("option")
    expect(kinds).to_have_text(
        [
            "Load step",
            "Load scaling (one load or all)",
            "Reference step on an inverter",
            "Inverter outage (permanent)",
        ]
    )
    page.get_by_role("button", name="Run M4b").click()  # nothing entered yet
    _status(page, "INPUT_INVALID")
    expect(page.get_by_role("list", name="Issues")).to_contain_text("disturbance")

    page.get_by_label("Element", exact=True).select_option("L1")
    page.get_by_label("Step size (kW)").fill("1")
    page.get_by_label("Start time (s)").fill("0.1")
    page.get_by_label("Simulation end (s)").fill("1")
    _numeric_inputs_have_units(page)
    page.get_by_role("button", name="Run M4b").click()
    _status(page, "FEASIBLE")
    expect(page.get_by_test_id("transient-class")).to_contain_text("Recovered and stable")
    expect(page.get_by_role("img", name="System frequency (Hz) against time (s)")).to_be_visible()

    page.get_by_label("Disturbance", exact=True).select_option("REFERENCE_STEP")
    page.get_by_label("Reference", exact=True).select_option("V_SETPOINT")
    expect(page.get_by_label("Step size (kV)")).to_be_visible()  # unit follows the reference
