"""Seam 5: UX round regression (UX-12; Doc 12 X0–X8; Doc 9 D-91).

Every screen with its UX-round content (KPI strips, charts, toggletips, S-17 About, the component
gallery) stays usable at 200 % zoom: a 640 px CSS viewport with no sideways page scroll, as in the
WP 1.7.2 zoom test, but after every analysis has a result. A toggletip opened at that width stays
inside the viewport. The chart series and feasibility-marker colours, as the page resolves them,
reach 3:1 against the white chart frame (graphics contrast; no WCAG claim, Doc 7 §8). The conftest
guard refuses external requests on every screen visited (NFR-03).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path

from flows import enter_design, go_route, gui_snapshot, step
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1

PALETTE = Path(__file__).parents[2] / "frontend" / "components" / "charts" / "palette.ts"
ROUTES = [
    "project", "loads", "sizing", "network", "constraints", "power-flow", "constraint-check",
    "sensitivity", "sweep", "scenarios", "envelope", "small-signal", "transient", "runs",
    "report", "catalogue", "about",
]  # fmt: skip


def _ok(page: Page) -> None:
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")


def _run_all(page: Page) -> None:
    _run_m1(page)
    step(page, "Constraint check (M2)")
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    _ok(page)
    step(page, "Sensitivity (M3a)")
    page.get_by_label("inverters/INV1/rated_kva").check()
    page.get_by_label("System frequency (Hz)").check()
    page.get_by_label("Step (ratio)").fill("0.01")
    page.get_by_role("button", name="Run M3a").click()
    _ok(page)
    step(page, "Sweep (M3b)")
    page.get_by_label("Parameter", exact=True).select_option("inverters/INV1/rated_kva")
    page.get_by_label("From (kVA)").fill("5")
    page.get_by_label("To (kVA)").fill("15")
    page.get_by_label("Points (count)").fill("3")
    page.get_by_role("button", name="Run sweep").click()
    _ok(page)
    step(page, "Scenarios (M3c)")
    page.get_by_role("button", name="Run N−1 check").click()
    _ok(page)
    step(page, "Envelope (M3d)")
    page.get_by_label("X axis: Axis").select_option("LOAD_SCALE")
    page.get_by_label("X axis: From (factor)").fill("0.5")
    page.get_by_label("X axis: To (factor)").fill("1.5")
    page.get_by_label("X axis: Points (count)").fill("2")
    page.get_by_label("Y axis: Parameter").select_option("inverters/INV1/rated_kva")
    page.get_by_label("Y axis: From (kVA)").fill("5")
    page.get_by_label("Y axis: To (kVA)").fill("15")
    page.get_by_label("Y axis: Points (count)").fill("2")
    page.get_by_role("button", name="Run envelope").click()
    _ok(page)
    step(page, "Small-signal (M4a)")
    page.get_by_role("button", name="Run M4a").click()
    _ok(page)
    step(page, "Transient (M4b)")
    page.get_by_label("Element", exact=True).select_option("L1")
    page.get_by_label("Step size (kW)").fill("1")
    page.get_by_label("Start time (s)").fill("0.1")
    page.get_by_label("Simulation end (s)").fill("1")
    page.get_by_role("button", name="Run M4b").click()
    _ok(page)


def test_ux_round_200_percent_zoom_after_every_analysis(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_all(page)
    page.set_viewport_size({"width": 640, "height": 450})
    wide = {}

    def measure(name: str) -> None:
        over = page.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth"
        )
        if over > 1:
            wide[name] = over

    for r in ROUTES:
        go_route(page, r)
        page.locator("h1").first.wait_for()
        measure(r)
        if r == "power-flow":
            tip = page.get_by_role("button", name="Glossary: loading ratio").first
            # scroll first: a scroll closes an open toggletip (D-89 K219)
            tip.scroll_into_view_if_needed()
            page.wait_for_timeout(200)
            tip.click()
            box = page.get_by_role("note").bounding_box()
            assert box and box["x"] >= 0 and box["x"] + box["width"] <= 640, box
            page.keyboard.press("Escape")
    page.goto(page.url.split("/about/")[0] + "/dev/components/")
    page.locator("h1").first.wait_for()
    measure("dev/components")
    assert not wide, f"page wider than the 640 px viewport (px): {wide}"


def _lum(rgb: str) -> float:
    vals = [int(x) / 255 for x in re.findall(r"\d+", rgb)[:3]]
    lin = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in vals]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def test_ux_round_chart_colours_reach_3_to_1_on_the_frame(
    server: Callable[[str], str], page: Page
) -> None:
    page.goto(server("default") + "/dev/components/")
    page.locator("h1").first.wait_for()
    series = re.search(r"SERIES = \[([^\]]+)\]", PALETTE.read_text(encoding="utf-8"))
    assert series
    # var(--series-N): one value per theme, resolved below
    colours = re.findall(r'"([^"]+)"', series.group(1))
    assert len(colours) == 5
    roles = ["--role-success-icon", "--role-negative-icon", "--cds-border-strong-01"]
    for theme in ("light", "dark"):
        # resolve each colour as the browser draws it (CSS variables included) to rgb()
        resolved = page.evaluate(
            """([colours, roles, theme]) => {
                document.documentElement.dataset.theme = theme;
                const el = document.createElement("span");
                document.body.appendChild(el);
                const rgb = (c) => { el.style.color = c; return getComputedStyle(el).color; };
                const out = {};
                for (const c of colours) out[c] = rgb(c);
                for (const r of roles) out[r] = rgb(`var(${r})`);
                out.frame = rgb("var(--cds-layer-01)"); // chart frame background
                el.remove();
                return out;
            }""",
            [colours, roles, theme],
        )
        frame = _lum(resolved.pop("frame"))
        ratios = {
            k: (max(frame, _lum(v)) + 0.05) / (min(frame, _lum(v)) + 0.05)
            for k, v in resolved.items()
        }
        assert len(ratios) == len(colours) + len(roles)
        low = {k: round(v, 2) for k, v in ratios.items() if v < 3}
        assert not low, f"{theme}: below 3:1 against the chart frame: {low}"
