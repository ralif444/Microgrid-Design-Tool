"""Seam 5 (WP 1.5.1 K): S-18 Catalogue and "Choose from catalogue" on S-05 (Doc 12; D-61).

FR-64 (save then open gives the same entries), FR-65/FR-66 (guard refuses with the reason, the
entry stays), FR-67/FR-68 (A2/A4 labels), FR-69 (copy, marker on edit), FR-70 (no current limit
without confirmation), FR-72 (hint on the sizing screen is covered by the client).
Entries are typed in by the test; the app ships none (D-59 K107).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1


def _provenance(page: Page) -> None:
    page.get_by_label("Manufacturer", exact=True).fill("Test maker")
    page.get_by_label("Model", exact=True).fill("T-1")
    page.get_by_label("Datasheet title or document id").fill("Test sheet")
    page.get_by_label("Revision or date").fill("r1")


def test_fr_64_to_fr_70_catalogue_into_network(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    page.get_by_role("link", name="Catalogue").click()
    expect(page.get_by_text("The Catalogue is empty.")).to_be_visible()

    page.get_by_role("button", name="+ Add conductor entry").click()
    _provenance(page)
    for label, value in (("Resistance R", "0.5"), ("Reactance X", "0.3")):
        page.get_by_label(f"{label} (Ω/km)").fill(value)
        page.get_by_label(f"{label}: page or section").fill("p. 2")
    page.get_by_label("Current-carrying capacity (A)", exact=True).fill("100")
    page.get_by_label("Current-carrying capacity: page or section").fill("p. 3")
    expect(page.get_by_text("not used by the model (A4)")).to_be_visible()
    entries = page.get_by_role("table", name="Catalogue entries")
    expect(entries.locator("tbody tr").nth(0)).to_contain_text("usable")

    page.get_by_role("button", name="+ Add inverter entry").click()
    _provenance(page)
    page.get_by_label("Rating (kVA)").fill("10")
    expect(page.get_by_text("not used by the model (A2)").first).to_be_visible()
    expect(entries.locator("tbody tr").nth(1)).to_contain_text("information only")

    with page.expect_download() as dl:
        page.get_by_role("button", name="Save catalogue").click()
    saved = Path(dl.value.path())
    doc = json.loads(saved.read_text(encoding="utf-8"))
    assert [e["id"] for e in doc["entries"]] == ["E1", "E2"] and doc["schema_version"] == 1
    page.get_by_role("button", name="Delete E2").click()
    page.get_by_label("Open catalogue file").set_input_files(saved)
    expect(page.get_by_test_id("file-check")).to_contain_text("The Catalogue was opened.")
    expect(entries.locator("tbody tr")).to_have_count(2)

    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Lines").click()
    page.get_by_label("Element", exact=True).select_option("LN1")
    page.get_by_label("Catalogue entry").select_option("E1")
    page.get_by_role("button", name="Use in Project").click()
    expect(page.get_by_label("R (Ω/km) of LN1")).to_have_value("0.5")
    expect(page.get_by_label("Current limit, optional (A) of LN1")).to_have_value("")
    expect(page.get_by_label("From catalogue (entry) of LN1")).to_have_text("E1")
    page.get_by_label("R (Ω/km) of LN1").fill("0.6")
    expect(page.get_by_label("From catalogue (entry) of LN1")).to_have_text(
        "E1; modified from catalogue"
    )

    page.get_by_role("tab", name="Inverters").click()
    page.get_by_label("Element", exact=True).select_option(index=1)
    page.get_by_label("Catalogue entry").select_option("E2")
    page.get_by_role("button", name="Use in Project").click()
    expect(page.get_by_role("status").filter(has_text="cannot be used")).to_contain_text(
        "not declared grid-forming"
    )


def _usable_catalogue(path: Path) -> Path:
    prov = {
        "manufacturer": "Test maker",
        "model": "T-1",
        "document": "Test sheet",
        "revision": "r1",
    }
    inv = {
        "rated_kva": 10,
        "nominal_voltage_kv": 0.4,
        "nominal_frequency_hz": 50,
        "frequency_droop_min_hz_per_kw": 0.01,
        "frequency_droop_max_hz_per_kw": 0.1,
        "voltage_droop_min_kv_per_kvar": 0.001,
        "voltage_droop_max_kv_per_kvar": 0.01,
        "tau_in_s": 0.002,
    }
    cond = {"r_ohm_per_km": 0.5, "x_ohm_per_km": 0.3, "ampacity_a": 100}
    entries = [
        {
            "id": "E1",
            "kind": "INVERTER",
            "provenance": prov,
            "sources": {f: "p. 1" for f in inv},
            "inverter": {**inv, "grid_forming": True, "grid_forming_reference": "p. 4"},
        },
        {
            "id": "E2",
            "kind": "CONDUCTOR",
            "provenance": prov,
            "sources": {f: "p. 2" for f in cond},
            "conductor": cond,
        },
    ]
    path.write_text(
        json.dumps({"schema_version": 1, "app_version": "0.1.0", "entries": entries}),
        encoding="utf-8",
    )
    return path


def _pick(page: Page, tab: str, element: str, entry: str) -> None:
    page.get_by_role("tab", name=tab).click()
    page.get_by_label("Element", exact=True).select_option(element)
    page.get_by_label("Catalogue entry").select_option(entry)


def test_fr_70_fr_71_fr_72_limit_tau_in_and_hint(
    server: Callable[[str], str], page: Page, tmp_path: Path
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    page.get_by_role("link", name="Catalogue").click()
    page.get_by_label("Open catalogue file").set_input_files(_usable_catalogue(tmp_path / "c.json"))
    expect(page.get_by_role("table", name="Catalogue entries")).to_contain_text("usable")

    page.get_by_role("link", name="3 Network").click()
    _pick(page, "Lines", "LN1", "E2")  # FR-70: no confirmation
    page.get_by_role("button", name="Use in Project").click()
    expect(page.get_by_label("Current limit, optional (A) of LN1")).to_have_value("")
    _pick(page, "Inverters", "INV1", "E1")
    page.get_by_role("button", name="Use in Project").click()
    expect(page.get_by_label("From catalogue (entry) of INV1")).to_have_text("E1")

    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("list", name="Not evaluated")).to_contain_text("LN1")

    page.get_by_role("link", name="Small-signal (M4a)").click()  # FR-71
    expect(page.get_by_label("Inner-loop time constant τ_in, optional (s)")).to_have_value("0.002")
    expect(page.get_by_test_id("tau-in-source")).to_contain_text("E1")
    expect(page.get_by_test_id("tau-in-source")).to_contain_text("p. 1")

    page.get_by_role("link", name="3 Network").click()
    _pick(page, "Lines", "LN1", "E2")  # FR-70: confirmed
    page.get_by_label("Also use 100 A as the current limit").check()
    page.get_by_role("button", name="Use in Project").click()
    expect(page.get_by_label("Current limit, optional (A) of LN1")).to_have_value("100")
    expect(page.get_by_label("From catalogue (entry) of LN1")).to_contain_text(
        "datasheet reference conditions"
    )

    page.get_by_role("link", name="2 Sizing advice").click()  # FR-72
    page.get_by_label("Inverter margin m_inv (ratio)").fill("0.2")
    page.get_by_label("Number of inverter units n (count)").fill("2")
    page.get_by_label("Redundancy r (0 or 1) (count)").fill("0")
    page.get_by_role("button", name="Run advice").click()
    expect(page.get_by_role("region", name="Catalogue hints")).to_contain_text("E1 (10 kVA)")
