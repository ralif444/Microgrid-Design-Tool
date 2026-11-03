"""Seam 5: UX and analytics round (Doc 12 X0–X5; Doc 9 D-72).

FR-93 (the latest result on the current design survives leaving a screen; a design edit hides it),
FR-86 (a chart figure's "Show data" table lists as many rows as the payload),
FR-87 (S-07, S-08, S-10, S-12, S-13 and S-14 KPI strips), FR-88 (S-07 charts; S-08 margin chart and
loadability axis; S-10 sweep chart; S-12 status grid; S-13 eigenvalue plot, participation note;
S-14 time responses; S-09 tornado per metric; S-11 bars per metric across scenarios; static S-16
report charts with the result hash, within the A4 printable width),
FR-89 (crosshair: arrow keys move it, it shows a value with unit, Escape hides it),
FR-90 (Inspector side panel), FR-91 (glossary toggletip: Enter opens, Escape and an outside click
close; S-17 About lists the glossary).
"""

from __future__ import annotations

import re
from collections.abc import Callable

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1


def test_fr_93_result_survives_leaving_and_hides_after_edit(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    record = page.get_by_test_id("record-id").inner_text()

    page.get_by_role("link", name="1 Loads").click()
    page.get_by_role("link", name="5 Power flow (M1)").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    expect(page.get_by_test_id("record-id")).to_have_text(record)

    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Inverters").click()
    page.get_by_label("Rating (kVA) of INV1").fill("50")
    page.get_by_role("link", name="5 Power flow (M1)").click()
    expect(page.get_by_text("No result on this screen.")).to_be_visible()
    expect(page.get_by_test_id("record-id")).to_have_count(0)


def test_fr_86_show_data_lists_the_payload_rows(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="8 Report").click()
    title = "Bus voltage magnitude from the latest power flow (M1)"
    expect(page.get_by_role("img", name="Bus voltage (p.u.) bar chart, 2 bars")).to_be_visible()
    # scoped to this figure: the report now has more charts, each with the FAKE caption (D-88, user)
    figure = page.get_by_role("figure", name=title)
    expect(figure.get_by_text("FAKE engine: placeholder, not an engine result")).to_be_visible()
    show = page.get_by_role("button", name=f"Show data: {title}")
    expect(show).to_have_attribute("aria-expanded", "false")
    show.click()
    expect(show).to_have_attribute("aria-expanded", "true")
    data = page.get_by_role("table", name=f"{title} data")
    buses = page.get_by_role("table", name="Bus voltages")
    expect(data.locator("tbody tr")).to_have_count(buses.locator("tbody tr").count())
    expect(data).to_contain_text("B1")


def test_fr_87_fr_88_power_flow_kpis_and_charts(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    kpis = page.get_by_role("region", name="Power flow key figures")
    expect(kpis).to_contain_text("Lowest bus voltage")
    expect(kpis).to_contain_text("FAKE engine: placeholder values, not engine results.")
    for title in (
        "Bus voltage profile",
        "Inverter loading",
        "Inverter output, P and Q",
        "Line loading",
    ):
        expect(page.get_by_role("button", name=f"Show data: {title}")).to_be_visible()
    expect(page.get_by_role("img", name="Bus voltage (p.u.) dot chart, 2 points")).to_be_visible()


def test_fr_90_inspector_opens_from_a_table_and_closes_on_escape(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    trigger = page.get_by_role("button", name="Inspect B1")
    trigger.click()
    panel = page.get_by_role("complementary", name="Inspector: Bus B1")
    expect(panel.get_by_role("heading", name="Bus B1")).to_be_focused()
    expect(panel.get_by_role("definition").first).to_be_visible()
    expect(panel).to_contain_text("No current constraint check for this design.")
    expect(panel.get_by_role("link", name="Edit in table")).to_have_attribute(
        "href", "/network/?focus=B1"
    )
    page.keyboard.press("Escape")
    expect(panel).to_have_count(0)
    expect(trigger).to_be_focused()

    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    page.get_by_role("link", name="5 Power flow (M1)").click()
    page.get_by_role("button", name="Inspect INV1").click()
    panel = page.get_by_role("complementary", name="Inspector: Inverter INV1")
    expect(panel.get_by_role("definition").first).to_be_visible()
    expect(panel.get_by_label("Sizing check values")).to_contain_text("Required rating")
    panel.get_by_role("button", name="Close inspector").click()
    expect(panel).to_have_count(0)


def test_fr_87_fr_88_constraint_check_kpis_and_charts(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "INFEASIBLE")
    kpis = page.get_by_role("region", name="Constraint check key figures")
    expect(kpis).to_contain_text("INFEASIBLE")
    expect(kpis).to_contain_text("Tightest constraint")
    expect(kpis).to_contain_text("solution-existence diagnostic, not a stability limit")
    expect(kpis).to_contain_text("FAKE engine: placeholder values, not engine results.")

    margins = page.get_by_role("img", name="Normalised margin (ratio) bar chart, 2 bars")
    expect(margins).to_contain_text("Violated (margin < 0)")
    axis = page.get_by_role("img", name="Load scale λ (ratio) axis, 0 markers")
    expect(axis).to_be_visible()
    for title in ("Normalised margin per constraint", "Loadability along the load scale λ"):
        figure = page.get_by_role("figure").filter(has_text=title)
        expect(figure).to_contain_text("FAKE engine: placeholder, not an engine result")
    page.get_by_role("button", name="Show data: Loadability along the load scale λ").click()
    data = page.get_by_role("table", name="Loadability along the load scale λ data")
    expect(data).to_contain_text("λ_c")
    expect(data).to_contain_text("—")


def test_fr_87_fr_88_small_signal_kpis_and_plot(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="Small-signal (M4a)").click()
    page.get_by_label("Damping pass threshold, optional (ratio)").fill("0.05")
    page.get_by_role("button", name="Run M4a").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    kpis = page.get_by_role("region", name="Small-signal key figures")
    expect(kpis).to_contain_text("STABLE")
    expect(kpis).to_contain_text("Damping check")
    expect(kpis).to_contain_text("no oscillatory mode")
    expect(kpis).to_contain_text("FAKE engine: placeholder values, not engine results.")
    plot = page.get_by_role("img", name="Imaginary part (1/s) against Real part (1/s), 0 points")
    expect(plot).to_contain_text("No data")
    figure = page.get_by_role("figure").filter(has_text="Eigenvalues in the complex plane")
    expect(figure).to_contain_text("FAKE engine: placeholder, not an engine result")
    expect(page.get_by_text("Participation factors not available")).to_be_visible()
    expect(page.get_by_test_id("stability-class")).to_contain_text("Stable")


def test_fr_87_fr_88_fr_89_transient_kpis_and_crosshair(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="Transient (M4b)").click()
    page.get_by_label("Element", exact=True).select_option("L1")
    page.get_by_label("Step size (kW)").fill("1")
    page.get_by_label("Start time (s)").fill("0.1")
    page.get_by_label("Simulation end (s)").fill("1")
    page.get_by_label("Frequency band (Hz)").fill("0.1")
    page.get_by_label("Voltage band, line-to-line (kV)").fill("0.01")
    page.get_by_label("Final window (s)").fill("0.5")
    page.get_by_role("button", name="Run M4b").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    kpis = page.get_by_role("region", name="Transient key figures")
    expect(kpis).to_contain_text("RECOVERED_STABLE")
    expect(kpis).to_contain_text("Largest RoCoF")
    expect(kpis).to_contain_text("FAKE engine: placeholder values, not engine results.")

    figure = page.get_by_role("figure", name="System frequency")
    expect(figure).to_contain_text("disturbance start at 0.1 s")
    expect(figure).to_contain_text("final window of 0.5 s")
    expect(figure).to_contain_text("FAKE engine: placeholder, not an engine result")
    chart = figure.get_by_role("img", name="System frequency (Hz) against time (s), 2 points")
    readout = figure.get_by_test_id("crosshair")
    chart.focus()
    expect(readout).to_contain_text("t 0 s")
    expect(readout).to_contain_text(re.compile(r"system: [0-9.]+ Hz"))
    page.keyboard.press("ArrowRight")
    expect(readout).to_contain_text("t 1 s")
    page.keyboard.press("Home")
    expect(readout).to_contain_text("t 0 s")
    page.keyboard.press("Escape")
    expect(readout).to_have_count(0)
    expect(page.get_by_test_id("transient-class")).to_contain_text("Recovered and stable")


def test_fr_87_fr_88_fr_89_sweep_and_envelope(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="Sweep (M3b)").click()
    page.get_by_label("Parameter", exact=True).select_option("inverters/INV1/rated_kva")
    page.get_by_label("From (kVA)").fill("5")
    page.get_by_label("To (kVA)").fill("15")
    page.get_by_label("Points (count)").fill("3")
    page.get_by_role("button", name="Run sweep").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    kpis = page.get_by_role("region", name="Sweep key figures")
    expect(kpis).to_contain_text("Points FEASIBLE")
    expect(kpis).to_contain_text("none in range")
    expect(kpis).to_contain_text("FAKE engine: placeholder values, not engine results.")
    figure = page.get_by_role("figure", name="Sweep")
    expect(figure).to_contain_text("FAKE engine: placeholder, not an engine result")
    figure.get_by_role("img", name="System frequency (Hz) against").focus()
    readout = figure.get_by_test_id("crosshair")
    expect(readout).to_contain_text("inverters/INV1/rated_kva 5 kVA")
    expect(readout).to_contain_text(re.compile(r"System frequency: [0-9.]+ Hz"))
    page.keyboard.press("End")
    expect(readout).to_contain_text("inverters/INV1/rated_kva 15 kVA")

    page.get_by_role("link", name="Envelope (M3d)").click()
    page.get_by_label("X axis: Axis").select_option("LOAD_SCALE")
    page.get_by_label("X axis: From (factor)").fill("0.5")
    page.get_by_label("X axis: To (factor)").fill("1.5")
    page.get_by_label("X axis: Points (count)").fill("2")
    page.get_by_label("Y axis: Parameter").select_option("inverters/INV1/rated_kva")
    page.get_by_label("Y axis: From (kVA)").fill("5")
    page.get_by_label("Y axis: To (kVA)").fill("15")
    page.get_by_label("Y axis: Points (count)").fill("2")
    page.get_by_role("button", name="Run envelope").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    kpis = page.get_by_role("region", name="Envelope key figures")
    expect(kpis).to_contain_text("Feasible fraction")
    expect(kpis).to_contain_text("Points FEASIBLE")
    grid = page.get_by_role("table", name="Envelope grid")
    expect(grid.locator("td")).to_have_count(4)
    expect(grid.locator("td")).to_contain_text(["feasible"] * 4)
    expect(grid.locator('td[tabindex="0"]')).to_have_count(1)  # one tab stop, arrows move
    grid.locator('td[tabindex="0"]').focus()
    readout = page.get_by_test_id("envelope-readout")
    expect(readout).to_contain_text("LOAD_SCALE 0.5 factor")
    expect(readout).to_contain_text("FEASIBLE; limiting constraint: none")
    page.keyboard.press("ArrowRight")
    expect(readout).to_contain_text("LOAD_SCALE 1.5 factor")
    page.get_by_role("button", name="Show data: Status per point").click()
    expect(
        page.get_by_role("table", name="Status per point data").locator("tbody tr")
    ).to_have_count(4)


def test_fr_88_tornado_and_scenario_bars(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="Sensitivity (M3a)").click()
    page.get_by_label("inverters/INV1/rated_kva").check()
    page.get_by_label("inverters/INV2/rated_kva").check()
    page.get_by_label("System frequency (Hz)").check()
    page.get_by_label("Step (ratio)").fill("0.01")
    page.get_by_role("button", name="Run M3a").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    tornado = page.get_by_role("figure", name="Tornado: System frequency")
    expect(
        tornado.get_by_role("img", name="Normalised sensitivity (ratio) bar chart, 2 bars")
    ).to_be_visible()
    expect(tornado).to_contain_text("FAKE engine: placeholder, not an engine result")
    expect(tornado).to_contain_text("rank order")

    page.get_by_role("link", name="Scenarios (M3c)").click()
    page.get_by_role("button", name="Run N−1 check").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    bars = page.get_by_role("figure", name="System frequency per scenario")
    expect(
        bars.get_by_role("img", name="System frequency (Hz) dot chart, 3 points")
    ).to_be_visible()
    expect(bars).to_contain_text("not a ranking")
    expect(bars).to_contain_text("FAKE engine: placeholder, not an engine result")
    bars.get_by_role("button", name="Show data: System frequency per scenario").click()
    data = page.get_by_role("table", name="System frequency per scenario data")
    expect(data.locator("tbody tr")).to_have_count(3)
    expect(data).to_contain_text("Without INV1 (FEASIBLE)")


def test_fr_88_report_charts_are_static_and_fit_a4(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "INFEASIBLE")
    page.get_by_role("link", name="Small-signal (M4a)").click()
    page.get_by_role("button", name="Run M4a").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")
    page.get_by_role("link", name="8 Report").click()
    for name in (
        "Inverter loading",
        "Normalised margin per constraint",
        "Loadability along the load scale λ",
        "Eigenvalues in the complex plane",
    ):
        figure = page.get_by_role("figure", name=name, exact=True)
        expect(figure).to_contain_text("result hash")
        expect(figure).to_contain_text("FAKE engine: placeholder, not an engine result")
    expect(page.get_by_role("figure", name="Bus voltage profile", exact=True)).to_have_count(0)
    expect(page.locator("article svg[tabindex]")).to_have_count(0)  # no crosshair in the report

    page.set_viewport_size({"width": 718, "height": 1000})  # A4 printable width (FR-60)
    page.emulate_media(media="print")
    expect(page.get_by_role("button", name="Show data: Inverter loading")).to_be_hidden()
    widths = page.locator("article figure").evaluate_all(
        "els => els.map(e => e.getBoundingClientRect().right)"
    )
    assert widths and max(widths) <= 718, widths


def test_fr_91_glossary_toggletip_and_about(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    kpis = page.get_by_role("region", name="Power flow key figures")
    tip = kpis.get_by_role("button", name="Glossary: loading ratio")
    note = page.get_by_role("note")
    tip.focus()
    page.keyboard.press("Enter")
    expect(tip).to_have_attribute("aria-expanded", "true")
    expect(note).to_contain_text("Rasio pembebanan inverter")
    expect(note).to_contain_text("Sumber: Naskah 4.2.4")
    page.keyboard.press("Escape")
    expect(note).to_have_count(0)
    expect(tip).to_be_focused()
    tip.click()
    expect(note).to_have_count(1)
    page.get_by_role("heading", name="Power flow (M1)").click()
    expect(note).to_have_count(0)

    page.get_by_role("link", name="About", exact=True).click()
    expect(page.get_by_role("heading", name="About and limits")).to_be_visible()
    expect(page.get_by_role("table", name="Versions")).to_contain_text("FAKE")
    glossary = page.get_by_role("table", name="Glossary", exact=True)
    expect(glossary.locator("tbody tr")).to_have_count(27)
    expect(glossary).to_contain_text("Naskah Tabel 4.4")
