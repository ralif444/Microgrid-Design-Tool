"""Seam 5 (X10, ticket 06): breaker symbols, report section and Catalogue kind BREAKER (D-104).

FR-113 (a breaker symbol on each sized Line and Inverter feeder after a current CB run, with its own
card; none before a run and none on the report figure), FR-114 (report section with method id,
table-set hash, caveat and PUIL edition note), FR-115 (BREAKER entry; the S-19 catalogue match).
Table file and catalogue entries are FICTITIOUS test data (FAKE fixture, not PUIL, no vendor).
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from flows import enter_design, gui_snapshot, step
from playwright.sync_api import Page, expect
from test_cable_sizing import CAVEAT, FLAG_ON, TABLES
from test_network_m1_m2 import _margins, _run_m1

from mgapp.services.cable_sizing.tables import table_set_hash

BREAKERS = '[data-testid^="diagram-breaker-"]'
LEGEND = "Circuit breaker (sizing result)"
SECTION = "Cable and overload sizing (experimental)"
PROV = {"manufacturer": "Test maker", "model": "T-1", "document": "Test sheet", "revision": "r1"}


def _m1_m2(page: Page) -> None:
    _run_m1(page)
    step(page, "Constraint check (M2)")
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")


def _run_cb(page: Page) -> None:
    page.get_by_role("list", name="Further analyses").get_by_role(
        "link", name="Cable and breaker sizing"
    ).click()
    page.get_by_label("Load table file (JSON)").set_input_files(TABLES)
    for label, value in (
        ("Method", "B1"),
        ("Conductor", "CU"),
        ("Insulation", "PVC"),
        ("Grouping arrangement", "BUNCHED"),
        ("Cable construction", "MULTICORE"),
    ):
        page.get_by_label(label, exact=True).select_option(value)
    page.get_by_label("Ambient temperature (°C)").fill("30")
    page.get_by_label("Grouping count").fill("1")
    page.get_by_role("button", name="Run cable sizing").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")


def test_fr_113_fr_114_sld_shows_breaker_symbols_after_run(
    server: Callable[..., str], page: Page
) -> None:
    enter_design(page, server("default", env=FLAG_ON), gui_snapshot())
    _m1_m2(page)
    diagram = page.get_by_role("region", name="Single-line diagram")
    expect(diagram.locator(BREAKERS)).to_have_count(0)  # no CB run yet
    expect(page.get_by_role("list", name="Diagram legend")).not_to_contain_text(LEGEND)
    step(page, "Report")
    expect(page.get_by_role("heading", name=SECTION)).to_have_count(0)

    _run_cb(page)
    step(page, "Constraint check (M2)")
    for el in ("LN1", "INV1", "INV2"):
        expect(diagram.get_by_test_id(f"diagram-breaker-{el}")).to_be_visible()
    expect(page.get_by_role("list", name="Diagram legend")).to_contain_text(LEGEND)
    diagram.get_by_test_id("diagram-breaker-INV1").focus()
    tip = page.get_by_role("tooltip")
    for text in ("Breaker INV1", "MCB", "I_n", "20 A", "I_Z", "10 mm²"):
        expect(tip).to_contain_text(text)

    step(page, "Network")
    expect(page.get_by_test_id("diagram-breaker-INV1")).to_be_visible()

    step(page, "Report")
    section = page.get_by_role("region", name=SECTION)
    expect(section).to_contain_text("IEC60364_OVERLOAD_PUIL2011")
    expect(section).to_contain_text(table_set_hash(json.loads(TABLES.read_text(encoding="utf-8"))))
    expect(section).to_contain_text(CAVEAT)
    expect(section).to_contain_text("PUIL 2020")
    expect(page.locator(BREAKERS)).to_have_count(0)  # not on the report figure (K295)


def test_fr_115_catalogue_breaker_and_match(
    server: Callable[..., str], page: Page, tmp_path: Path
) -> None:
    cat = {
        "schema_version": 1,
        "app_version": "0.1.0",
        "entries": [
            {
                "id": "E1",
                "kind": "CONDUCTOR",
                "provenance": PROV,
                "sources": {"r_ohm_per_km": "p. 2", "x_ohm_per_km": "p. 2"},
                "conductor": {
                    "r_ohm_per_km": 2,
                    "x_ohm_per_km": 0.1,
                    "material": "CU",
                    "insulation": "PVC",
                    "cores": 3,
                    "size_mm2": 10,
                },
            },
            {
                "id": "E2",
                "kind": "BREAKER",
                "provenance": PROV,
                "sources": {"in_a": "p. 5"},
                "breaker": {"standard": "FAKE MCB standard", "class": "MCB", "in_a": 20},
            },
        ],
    }
    file = tmp_path / "catalogue.mgcat.json"
    file.write_text(json.dumps(cat), encoding="utf-8")
    enter_design(page, server("default", env=FLAG_ON), gui_snapshot())
    page.get_by_role("link", name="Catalogue").click()
    expect(page.get_by_role("button", name="+ Add breaker entry")).to_be_visible()
    page.get_by_label("Open catalogue file").set_input_files(file)
    entries = page.get_by_role("table", name="Catalogue entries")
    expect(entries.locator("tbody tr").nth(1)).to_contain_text("usable")

    _m1_m2(page)
    _run_cb(page)
    page.get_by_role("button", name="Factors of INV1").click()
    factors = page.get_by_test_id("cb-factors-INV1")
    expect(factors).to_contain_text("cable E1")
    expect(factors).to_contain_text("breaker E2")


def test_fr_105_catalogue_has_no_breaker_kind_when_flag_off(
    server: Callable[..., str], page: Page
) -> None:
    enter_design(page, server("default"), gui_snapshot())
    page.get_by_role("link", name="Catalogue").click()
    expect(page.get_by_role("button", name="+ Add conductor entry")).to_be_visible()
    expect(page.get_by_role("button", name="+ Add breaker entry")).to_have_count(0)
