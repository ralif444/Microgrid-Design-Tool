"""Seam 5 (WP 1.7.2): every screen stays usable at 200 % zoom (Doc 7 §8; no WCAG claim).

200 % zoom of a 1280 px window is a 640 px CSS viewport. The page itself must not scroll
sideways; wide tables scroll inside their own box.
"""

from __future__ import annotations

from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page
from test_network_m1_m2 import _run_m1

ROUTES = [
    "project", "loads", "sizing", "network", "constraints", "power-flow", "constraint-check",
    "sensitivity", "sweep", "scenarios", "envelope", "small-signal", "transient", "runs",
    "report", "catalogue",
]  # fmt: skip


def test_200_percent_zoom_no_sideways_page_scroll(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.set_viewport_size({"width": 640, "height": 450})
    wide = {}

    def measure(name: str) -> None:
        over = page.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        if over > 1:
            wide[name] = over

    for r in ROUTES:
        page.locator(f'a[href="/{r}/"]').first.click()
        page.wait_for_url(f"**/{r}/")
        page.locator("h1").first.wait_for()
        measure(r)
        if r == "network":
            for tab in ("Lines", "Inverters"):
                page.get_by_role("tab", name=tab).click()
                measure(f"network {tab}")
    assert not wide, f"page wider than the 640 px viewport (px): {wide}"
