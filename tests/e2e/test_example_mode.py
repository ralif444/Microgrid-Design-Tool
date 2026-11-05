"""Doc 12 X9 example mode (EX-1, D-92): entering and leaving the guided example D2.

FR-99: S-01 opens the guided example as a new unsaved copy; the header shows "Example mode" and
"Leave example mode"; leaving keeps the Project. FR-101: a normal Project shows no example mode.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from playwright.sync_api import Page, expect


def test_fr_99_guided_example_enters_and_leaves_example_mode(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    expect(page.get_by_test_id("project-name")).to_have_text(
        re.compile(r"^Guided example D2\s*\*unsaved")
    )
    mode = page.get_by_test_id("example-mode")
    expect(mode).to_contain_text("Example mode")
    mode.get_by_role("button", name="About example mode").click()
    expect(page.get_by_role("note")).to_contain_text("the example settings are not saved")
    page.keyboard.press("Escape")
    expect(page.get_by_role("note")).to_have_count(0)
    # The guided Project carries the Doc 3 §3.7 limits and the Doc 13 §4 scenarios.
    page.get_by_role("link", name="4 Constraints").click()
    expect(page.get_by_label("Bus voltage, lower limit")).to_have_value("0.95")
    page.get_by_role("button", name="Leave example mode").click()
    expect(mode).to_have_count(0)
    expect(page.get_by_test_id("project-name")).to_have_text(re.compile(r"^Guided example D2"))
    expect(page.get_by_label("Bus voltage, lower limit")).to_have_value("0.95")


def test_fr_101_other_projects_leave_example_mode(server: Callable[[str], str], page: Page) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    expect(page.get_by_test_id("example-mode")).to_be_visible()
    page.get_by_role("link", name="Microgrid Design Tool").click()  # client-side: the store stays
    page.once("dialog", lambda d: d.accept())  # unsaved-changes confirm (K17)
    page.get_by_role("button", name="Open example D2:").click()
    expect(page.get_by_test_id("project-name")).to_have_text(re.compile(r"^Example D2"))
    expect(page.get_by_test_id("example-mode")).to_have_count(0)
