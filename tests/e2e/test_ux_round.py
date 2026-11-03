"""Seam 5: UX and analytics round (Doc 12 X0–X3, X5; Doc 9 D-72).

FR-93 (the latest result on the current design survives leaving a screen; a design edit hides it),
FR-86 (a chart figure's "Show data" table lists as many rows as the payload),
FR-87 (S-07, S-08 and S-13 KPI strips), FR-88 (S-07 charts; S-08 margin chart and loadability
axis; S-13 eigenvalue plot, participation note),
FR-90 (Inspector side panel).
"""

from __future__ import annotations

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
    expect(page.get_by_text("FAKE engine: placeholder, not an engine result")).to_be_visible()
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
