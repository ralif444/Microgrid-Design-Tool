"""Seam 5 (WP 1.7.3): FR-14 read-only diagram and FR-11 Bus delete guard on S-05 (D-69)."""

from __future__ import annotations

from collections.abc import Callable

from flows import delete, enter_design, gui_snapshot, step
from playwright.sync_api import Page, expect


def test_fr_11_fr_14_diagram_and_bus_delete_guard(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    step(page, "Network")
    page.get_by_label("Bus id", exact=True).fill("B9")
    page.get_by_role("button", name="Add bus").click()

    page.get_by_text("Diagram (read-only)").click()
    for bus in ("B1", "B2", "B9"):
        expect(page.get_by_test_id(f"diagram-bus-{bus}")).to_be_visible()
    expect(page.get_by_test_id("diagram-line-LN1")).to_be_visible()
    expect(page.get_by_test_id("diagram-bus-B9")).to_have_attribute("data-isolated", "true")
    expect(page.get_by_test_id("diagram-bus-B9")).to_contain_text("not connected")
    expect(page.get_by_test_id("diagram-bus-B1")).to_have_attribute("data-isolated", "false")

    page.get_by_role("button", name="Delete B1").click()
    expect(page.get_by_role("alert").filter(has_text="cannot be deleted")).to_contain_text("LN1")
    expect(page.get_by_label("Bus id of B1")).to_be_visible()
    delete(page, "B9")
    expect(page.get_by_test_id("diagram-bus-B9")).to_have_count(0)
