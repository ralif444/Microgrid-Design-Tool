"""Doc 12 X8 single-line diagram on S-05 (SLD-4, D-79): diagram and table paths to the Inspector
(FR-90), the keyboard tooltip with units (FR-95) and the "View as table" equivalent (FR-98); the
results overlay on S-07 and S-08 (SLD-5, D-80, FR-96); the report figure and its SVG download
(SLD-6, D-81, FR-97); keyboard reach, tooltip = inspector rows and 200 % zoom (SLD-7, D-82).
Every test runs behind the conftest guard that refuses external requests (NFR-03)."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from collections.abc import Callable
from pathlib import Path

from flows import enter_design, gui_snapshot, step
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1


def _open_diagram(page: Page, base: str) -> None:
    enter_design(page, base, gui_snapshot())
    step(page, "Network")
    page.get_by_text("Diagram (read-only)").click()


def test_fr_90_fr_95_diagram_tooltip_and_inspector(
    server: Callable[[str], str], page: Page
) -> None:
    _open_diagram(page, server("default"))
    line = page.get_by_role("button", name="Line LN1 from B1 to B2")
    line.focus()
    tip = page.get_by_role("tooltip")
    expect(tip).to_contain_text("Line LN1")
    expect(tip).to_contain_text("Ω/km")
    page.keyboard.press("Escape")
    expect(tip).to_have_count(0)

    page.keyboard.press("Enter")
    panel = page.get_by_role("complementary", name="Inspector: Line LN1")
    expect(panel.get_by_role("heading", name="Line LN1")).to_be_focused()
    expect(panel.get_by_label("Inputs")).to_contain_text("Ω/km")
    expect(page.get_by_role("tab", name="Lines")).to_have_attribute("aria-selected", "true")
    expect(line).to_have_attribute("aria-pressed", "true")
    page.keyboard.press("Escape")
    expect(panel).to_have_count(0)
    expect(line).to_be_focused()

    # table path (UX-4): the row's Inspect button opens the same panel
    page.get_by_role("button", name="Inspect LN1").click()
    expect(page.get_by_role("complementary", name="Inspector: Line LN1")).to_be_visible()


def test_fr_98_view_as_table_has_one_row_per_element(
    server: Callable[[str], str], page: Page
) -> None:
    _open_diagram(page, server("default"))
    drawn = page.locator('svg [data-testid^="diagram-"]')
    expect(drawn.first).to_be_visible()
    toggle = page.get_by_role("button", name="View as table")
    expect(toggle).to_have_attribute("aria-expanded", "false")
    toggle.click()
    expect(toggle).to_have_attribute("aria-expanded", "true")
    table = page.get_by_role("table", name="Diagram elements")
    expect(table.locator("tbody tr")).to_have_count(drawn.count())
    expect(table).to_contain_text("Line LN1")
    expect(table).to_contain_text("Ω/km")


def test_fr_96_m1_overlay_hides_after_an_edit(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    step(page, "Power flow (M1)")
    note = page.get_by_test_id("sld-overlay-note")
    expect(note).to_contain_text("No power-flow result yet")
    _run_m1(page)
    bus = page.get_by_test_id("diagram-bus-B1")
    expect(bus).to_contain_text("p.u.")
    expect(note).to_have_count(0)
    expect(page.get_by_test_id("sld-fake")).to_contain_text("not engine results")
    show = page.get_by_role("button", name="Show results")
    show.click()
    expect(bus).not_to_contain_text("p.u.")
    show.click()
    expect(bus).to_contain_text("p.u.")

    step(page, "Network")
    page.get_by_role("tab", name="Inverters").click()
    page.get_by_label("Rating (kVA) of INV1").fill("50")
    step(page, "Power flow (M1)")
    expect(note).to_contain_text("Outdated: design changed after this run. Re-run M1.")
    expect(bus).not_to_contain_text("p.u.")


def test_fr_96_m2_overlay_marks_violated_elements(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _run_m1(page)
    step(page, "Constraint check (M2)")
    expect(page.get_by_test_id("sld-overlay-note")).to_contain_text("No current constraint check")
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "INFEASIBLE")
    expect(
        page.locator('svg [data-testid^="diagram-"]').filter(has_text="Violated").first
    ).to_be_visible()
    page.get_by_role("button", name="Inverter INV1 at bus").click()
    expect(page.get_by_role("complementary", name="Inspector: Inverter INV1")).to_be_visible()


def test_fr_97_report_figure_and_svg_download(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    record = page.get_by_test_id("record-id").inner_text()
    step(page, "Report")
    figure = page.get_by_role("figure", name="Single-line diagram of the analysed design")
    expect(figure.get_by_test_id("diagram-bus-B1")).to_contain_text("p.u.")
    caption = figure.get_by_test_id("sld-caption")
    expect(caption).to_contain_text(f"RunRecord {record}")
    expect(caption).to_contain_text("FAKE ENGINE")
    with page.expect_download() as dl:
        figure.get_by_role("button", name="Download SVG").click()
    svg = Path(dl.value.path()).read_text(encoding="utf-8")
    assert svg.startswith("<svg") and 'xmlns="http://www.w3.org/2000/svg"' in svg
    ET.fromstring(svg)  # well-formed, so it opens on its own
    assert f"RunRecord {record}" in svg and "Engine FAKE" in svg
    assert "FAKE ENGINE — not an engine result" in svg
    assert "class=" not in svg and "var(--" not in svg


def test_fr_95_tooltip_rows_equal_inspector_rows_with_units(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    step(page, "Network")
    page.get_by_text("Diagram (read-only)").click()
    for name in ("Inverter INV1 at bus", "Bus B1", "Line LN1 from", "Load L1 at bus"):
        page.get_by_role("button", name=name).first.focus()
        tip = page.get_by_role("tooltip")
        expect(tip).to_be_visible()
        rows = [t.strip() for t in tip.locator("li").all_inner_texts()]
        assert rows, name
        # a unit on every number: no row ends in a bare value
        bare = [r for r in rows if re.search(r"· -?[0-9.]+$", r)]
        assert not bare, bare
        page.keyboard.press("Enter")
        panel = page.get_by_role("complementary").filter(has=page.get_by_role("heading"))
        pairs = panel.locator("dl > div")
        # the panel re-checks the design hash (debounced), then shows the same rows
        expect(pairs).to_have_count(len(rows))
        inspector = [
            f"{d.locator('dt').inner_text().strip()} · {d.locator('dd').inner_text().strip()}"
            for d in pairs.all()
        ]
        assert inspector == rows, name
        panel.get_by_role("button", name="Close inspector").click()


def test_fr_98_tab_reaches_every_element_and_enter_opens_a_bus(
    server: Callable[[str], str], page: Page
) -> None:
    _open_diagram(page, server("default"))
    group = page.get_by_role("group", name="Single-line diagram")
    drawn = group.locator('[data-testid^="diagram-"]')
    expect(drawn.first).to_be_visible()
    ids = drawn.evaluate_all("els => els.map(e => e.dataset.testid)")
    page.get_by_test_id("diagram-system").focus()
    reached = [page.evaluate("document.activeElement.dataset.testid")]
    for _ in ids[1:]:
        page.keyboard.press("Tab")
        reached.append(page.evaluate("document.activeElement.dataset.testid"))
    assert reached == ids
    page.get_by_test_id("diagram-bus-B1").focus()
    page.keyboard.press("Enter")
    expect(page.get_by_role("complementary", name="Inspector: Bus B1")).to_be_visible()


def test_sld_at_200_percent_zoom_has_no_page_scroll(
    server: Callable[[str], str], page: Page
) -> None:
    # 1280 px at 200 % browser zoom is a 640 px CSS viewport
    page.set_viewport_size({"width": 640, "height": 450})
    _open_diagram(page, server("default"))
    expect(page.get_by_test_id("diagram-bus-B1")).to_be_visible()
    page.get_by_role("button", name="Fit to view").click()
    wide = page.evaluate(
        "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    assert wide <= 0, f"page scrolls sideways by {wide} px"
    page.get_by_test_id("diagram-line-LN1").focus()
    expect(page.get_by_role("tooltip")).to_be_visible()
