"""Seam 5 (battery rounds BESS-1, BESS-2): S-18 battery module entry, the S-04 module hint and
the S-05 battery bank (Doc 12 FR-73 - FR-75; D-106, D-107, D-108). The module is the fictitious
TEST ONLY MOD-T1; the fit counts of Eq. 12.3 - 12.5 are covered by the client test (the Fake PS
gives no nominal energy).
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from pathlib import Path

from flows import delete, enter_design, gui_snapshot, step, studies
from playwright.sync_api import Page, expect
from test_catalogue import _provenance
from test_network_m1_m2 import _run_m1


def test_fr_73_fr_74_battery_module_entry_and_hint(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    step(page, "Sizing advice")
    page.get_by_label("Inverter margin m_inv (ratio)").fill("0.2")
    page.get_by_label("Number of inverter units n (count)").fill("2")
    page.get_by_label("Redundancy r (0 or 1) (count)").fill("0")
    page.get_by_role("button", name="Run advice").click()
    expect(page.get_by_role("region", name="Catalogue hints")).to_be_visible()
    expect(page.get_by_role("region", name="Battery module hint")).to_have_count(0)

    page.get_by_role("link", name="Catalogue").click()
    page.get_by_role("button", name="+ Add battery module entry").click()
    _provenance(page)
    for label, unit, value in (
        ("Nominal energy", "kWh", "5"),
        ("Minimum DC voltage", "V", "44.8"),
        ("Maximum DC voltage", "V", "57.6"),
    ):
        page.get_by_label(f"{label} ({unit})").fill(value)
        page.get_by_label(f"{label}: page or section").fill("p. 3")
    expect(
        page.get_by_text("used only by the battery advice, not by the network model (A2)").first
    ).to_be_visible()
    warning = "the battery power check (B2) cannot use this module"
    expect(page.get_by_role("note")).to_contain_text(warning)
    row = page.get_by_role("table", name="Catalogue entries").locator("tbody tr").nth(0)
    expect(row).to_contain_text("battery module")
    expect(row).to_contain_text("usable")
    expect(row).to_contain_text(warning)
    page.get_by_label("C-rate (1/h)").fill("0.2")
    page.get_by_label("C-rate: page or section").fill("p. 4")
    expect(page.get_by_role("note")).to_have_count(0)

    step(page, "Sizing advice")
    page.get_by_role("button", name="Run advice").click()
    hint = page.get_by_role("region", name="Battery module hint")
    expect(hint.get_by_label("Module entry")).to_have_value("E1")
    expect(page.get_by_test_id("module-hint")).to_have_text(
        "Not evaluated: PS has no nominal energy."
    )


def test_fr_75_battery_bank_on_s05_saved_outside_the_design(
    server: Callable[[str], str], page: Page
) -> None:  # D-108
    enter_design(page, server("default"), gui_snapshot())
    page.get_by_role("link", name="Catalogue").click()
    page.get_by_role("button", name="+ Add battery module entry").click()
    _provenance(page)
    for label, unit, value in (
        ("Nominal energy", "kWh", "5"),
        ("Minimum DC voltage", "V", "44.8"),
        ("Maximum DC voltage", "V", "57.6"),
        ("Recommended depth of discharge, optional", "ratio", "0.8"),
    ):
        page.get_by_label(f"{label} ({unit})").fill(value)
        page.get_by_label(f"{label}: page or section").fill("p. 3")
    row = page.get_by_role("table", name="Catalogue entries").locator("tbody tr").nth(0)
    expect(row).to_contain_text("usable")

    step(page, "Network")
    page.get_by_role("tab", name="Inverters").click()
    form = page.get_by_role("form", name="Battery bank")
    form.get_by_label("Inverter", exact=True).select_option("INV1")
    form.get_by_label("Battery module").select_option("E1")
    expect(form.get_by_label("Depth of discharge, optional (ratio)")).to_have_value("0.8")
    expect(form.get_by_label("Initial state of charge, optional (ratio)")).to_have_value("1")
    form.get_by_label("Modules in series (count)").fill("8")
    form.get_by_label("Strings in parallel (count)").fill("2")
    form.get_by_role("button", name="Save bank").click()
    expect(page.get_by_test_id("bank-list")).to_have_text("Banks: INV1: 8 × 2 of E1")

    form.get_by_label("Initial state of charge, optional (ratio)").fill("1.5")
    form.get_by_role("button", name="Save bank").click()
    expect(page.get_by_role("list", name="Network issues")).to_contain_text(
        "battery_banks[0].initial_soc_ratio"
    )
    form.get_by_label("Initial state of charge, optional (ratio)").fill("1")
    form.get_by_role("button", name="Save bank").click()
    expect(page.get_by_role("list", name="Network issues")).to_have_count(0)

    with page.expect_download() as dl:
        page.get_by_role("button", name="Save", exact=True).click()
    doc = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
    assert [
        (b["inverter_id"], b["module"]["catalog_ref"]["entry_id"]) for b in doc["battery_banks"]
    ] == [("INV1", "E1")]
    assert "battery" not in json.dumps(doc["inverters"])  # outside the design data

    delete(page, "INV1")
    expect(page.get_by_test_id("bank-list")).to_have_count(0)


def test_fr_119_s20_hidden_without_bank(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    further = studies(page)
    expect(further.get_by_role("link", name="Sensitivity (M3a)")).to_be_visible()
    expect(further.get_by_role("link", name="Battery adequacy")).to_have_count(0)


def _bank(page: Page, dod: str | None = None) -> None:
    """MOD-T1 with the C-rate only, then an 8 × 2 bank on INV1 with η_dc 0.95."""
    page.get_by_role("link", name="Catalogue").click()
    page.get_by_role("button", name="+ Add battery module entry").click()
    _provenance(page)
    for label, unit, value in (
        ("Nominal energy", "kWh", "5"),
        ("Minimum DC voltage", "V", "44.8"),
        ("Maximum DC voltage", "V", "57.6"),
        ("C-rate", "1/h", "0.2"),
    ):
        page.get_by_label(f"{label} ({unit})").fill(value)
        page.get_by_label(f"{label}: page or section").fill("p. 3")
    step(page, "Network")
    page.get_by_role("tab", name="Inverters").click()
    form = page.get_by_role("form", name="Battery bank")
    form.get_by_label("Inverter", exact=True).select_option("INV1")
    form.get_by_label("Battery module").select_option("E1")
    form.get_by_label("Modules in series (count)").fill("8")
    form.get_by_label("Strings in parallel (count)").fill("2")
    form.get_by_label("DC efficiency η_dc, optional (ratio)").fill("0.95")
    if dod is not None:
        form.get_by_label("Depth of discharge, optional (ratio)").fill(dod)
    form.get_by_role("button", name="Save bank").click()


def _open_s20_and_run(page: Page) -> None:
    studies(page).get_by_role("link", name="Battery adequacy").click()
    expect(page.get_by_label("Start hour (h)")).to_have_value("0")
    page.get_by_role("button", name="Run battery adequacy").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")


def test_fr_76_fr_116_run_shows_caveat(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _bank(page)
    _run_m1(page)
    _open_s20_and_run(page)
    expect(page.get_by_test_id("ba-caveat")).to_contain_text(
        "Discharge only: recharging is not modelled."
    )
    row = page.get_by_test_id("ba-row-INV1")
    expect(row).to_contain_text("8 × 2 (16 modules)")
    expect(row).to_contain_text("C-rate × energy")
    expect(row).to_contain_text("Not evaluated: depth of discharge not set.")


def test_fr_120_depletion_chart_show_data_and_report_section(
    server: Callable[[str], str], page: Page, tmp_path: Path
) -> None:  # D-110; the GUI has no profile editor yet (FR-04 Should), so the file carries it
    enter_design(page, server("default"), gui_snapshot())
    _bank(page, dod="0.8")
    with page.expect_download() as dl:
        page.get_by_role("button", name="Save", exact=True).click()
    doc = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
    lam = [0.4] * 6 + [0.6] * 12 + [1.0] * 4 + [0.4] * 2  # PF-T scaled to the 10 kW design
    doc["load_profile"] = {
        "id": "PF-T",
        "values": [{"hour": h, "p_kw": 10 * x} for h, x in enumerate(lam)],
    }
    file = tmp_path / "profiled.mgproj.json"
    file.write_text(json.dumps(doc), encoding="utf-8")
    page.get_by_label("Open project file").set_input_files(file)
    expect(page).to_have_url(re.compile(r"/workspace/$"))  # the import is done; was a race
    expect(page.get_by_test_id("project-name")).to_have_text("E2E project")
    _run_m1(page)
    _open_s20_and_run(page)

    row = page.get_by_test_id("ba-row-INV1")
    expect(row).to_contain_text("Not depleted")  # the Fake Engine gives 0 kW every hour
    expect(row).to_contain_text("lasts 24 h; end state of charge 1")
    title = "State of charge per inverter over the profile day"
    figure = page.get_by_role("figure", name=title)
    expect(figure.get_by_text("FAKE engine: placeholder, not an engine result")).to_be_visible()
    page.get_by_role("button", name=f"Show data: {title}").click()
    expect(page.get_by_role("table", name=f"{title} data").locator("tbody tr")).to_have_count(25)
    record = page.get_by_test_id("ba-record").locator("code").inner_text()

    step(page, "Report")
    section = page.get_by_role("region", name="Battery adequacy (advice, discharge only)")
    expect(section).to_contain_text("Discharge only: recharging is not modelled.")
    expect(section).to_contain_text(f"RunRecord {record}")
    expect(page.get_by_role("table", name="Model assumptions")).to_contain_text(
        "battery not modelled"
    )

    # BESS-5: 200 % zoom (640 px CSS viewport) keeps S-20 and the report free of page scroll
    page.set_viewport_size({"width": 640, "height": 450})
    over = "document.documentElement.scrollWidth - document.documentElement.clientWidth"
    page.wait_for_timeout(200)
    assert page.evaluate(over) <= 1, "report wider than 640 px"
    studies(page).get_by_role("link", name="Battery adequacy").click()
    page.wait_for_url("**/battery/")
    expect(page.get_by_test_id("ba-caveat")).to_be_visible()
    assert page.evaluate(over) <= 1, "S-20 wider than 640 px"
    tip = page.get_by_role("button", name="Glossary: Otonomi")
    tip.scroll_into_view_if_needed()
    page.wait_for_timeout(200)
    tip.click()
    box = page.get_by_role("note").bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= 640, box
