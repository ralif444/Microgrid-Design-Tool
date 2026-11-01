"""Seam 5 (WP 1.1.6): thin M1 slice in the browser on the Fake Engine.

NFR-02 (one start command serves UI and API), NFR-03 (no external requests), FR-35 banner,
FR-17 issue list, engine badge (Doc 7 P2). Browser: Playwright Chromium; gate runs use
latest stable Chrome (see conftest).
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable

from fixtures.designs import two_bus_snapshot
from playwright.sync_api import Page, expect

HEX64 = re.compile(r"^[0-9a-f]{64}$")


def test_nfr_02_one_process_serves_ui_and_api(server: Callable[[str], str], page: Page) -> None:
    url = server("default")
    page.goto(url + "/")
    expect(page.get_by_role("heading", name="Microgrid design tool")).to_be_visible()
    expect(page.get_by_test_id("engine-badge")).to_have_text("Engine: FAKE")


def test_fr_17_m1_with_empty_template_lists_issues(
    server: Callable[[str], str], page: Page
) -> None:
    page.goto(server("default") + "/power-flow/")
    page.get_by_role("button", name="Run M1").click()
    banner = page.get_by_role("status", name="Status")
    expect(banner).to_have_attribute("data-status", "INPUT_INVALID")
    expect(banner.get_by_role("list", name="Issues")).to_contain_text("nominal_voltage_kv")
    expect(page.get_by_test_id("record-id")).to_be_visible()


def test_fr_35_m1_feasible_on_fake(server: Callable[[str], str], page: Page) -> None:
    page.goto(server("default") + "/power-flow/")
    page.get_by_label("Design (project snapshot, JSON)").fill(json.dumps(two_bus_snapshot()))
    page.get_by_role("button", name="Run M1").click()
    banner = page.get_by_role("status", name="Status")
    expect(banner).to_have_attribute("data-status", "FEASIBLE")
    expect(banner).to_contain_text("an operating point was found")
    expect(banner).to_contain_text("Fake Engine")
    expect(page.get_by_role("table", name="Bus voltages")).to_contain_text("B2")
    expect(page.get_by_test_id("snapshot-hash")).to_have_text(HEX64)


def test_solver_failed_banner_with_profile(server: Callable[[str], str], page: Page) -> None:
    page.goto(server("m1-solver-failed") + "/power-flow/")
    page.get_by_label("Design (project snapshot, JSON)").fill(json.dumps(two_bus_snapshot()))
    page.get_by_role("button", name="Run M1").click()
    banner = page.get_by_role("status", name="Status")
    expect(banner).to_have_attribute("data-status", "SOLVER_FAILED")
    expect(banner).to_contain_text("not a limit violation")
