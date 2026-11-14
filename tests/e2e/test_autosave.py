"""Plan F3: browser autosave (manuscript 4.3.1; Doc 7 S-01, §7). An edit is kept in local storage;
after a reload S-01 offers it, and a restored Project is the edited one, still unsaved. Discard asks
first and removes the draft."""

from __future__ import annotations

from collections.abc import Callable

from flows import create_project
from playwright.sync_api import Page, expect

DRAFT = "localStorage.getItem('mgapp-draft')"


def _edit_and_reload(page: Page, base: str) -> None:
    create_project(page, base, {"nominal_voltage_kv": 0.4}, name="Autosave project")
    page.get_by_role("link", name="3 Network").click()
    page.get_by_label("Bus id", exact=True).fill("B1")
    page.get_by_role("button", name="Add bus").click()
    page.wait_for_function(f"({DRAFT} ?? '').includes('\"B1\"')")
    page.on("dialog", lambda d: d.accept())  # the unsaved-changes guard on reload
    page.reload()
    page.goto(base + "/")


def test_f3_reload_offers_the_draft_and_restores_it_unsaved(
    server: Callable[[str], str], page: Page
) -> None:
    _edit_and_reload(page, server("default"))
    offer = page.get_by_role("region", name="Unsaved work")
    expect(offer).to_contain_text("Autosave project")
    offer.get_by_role("button", name="Restore unsaved work").click()
    expect(page.get_by_test_id("project-name")).to_contain_text("Autosave project")
    expect(page.get_by_test_id("project-name")).to_contain_text("*unsaved")
    page.get_by_role("link", name="3 Network").click()
    expect(page.get_by_role("button", name="Inspect B1")).to_be_visible()


def test_f3_discard_asks_then_removes_the_draft(server: Callable[[str], str], page: Page) -> None:
    _edit_and_reload(page, server("default"))
    page.get_by_role("region", name="Unsaved work").get_by_role("button", name="Discard").click()
    page.get_by_role("dialog").get_by_role("button", name="Delete", exact=True).click()
    expect(page.get_by_role("region", name="Unsaved work")).to_have_count(0)
    assert page.evaluate(DRAFT) is None
