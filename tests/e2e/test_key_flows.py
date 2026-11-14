"""Seam 5 (WP 1.2.4): key flows F1-F3 of Doc 7 §4 across increments, FAKE marking (D-48).

F1 main pipeline with the INFEASIBLE loop back to the limiting element (K22) and the
PHYSICALLY_INADMISSIBLE stop; F2 open a Project file: refused file leaves the open Project
(NFR-16), unreadable RunRecord listed and skipped, stage-1 issues shown not fixed; F3 RunRecord
import, verify, re-run (FR-49, FR-50, FR-52, FR-53, NFR-01); FR-23 M1 groups; Doc 7 P2 FAKE.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

from flows import enter_design, gui_snapshot, step
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1
from test_report_runs import _m1_m2

SCREENS = [
    "Project",
    "Loads",
    "Sizing advice",
    "Network",
    "Constraints",
    "Power flow (M1)",
    "Constraint check (M2)",
    "Report",
    "Run history",
]


def _fake_banner(page: Page) -> None:
    expect(page.get_by_role("status", name="Status").get_by_test_id("fake-warning")).to_be_visible()


def test_f1_pipeline_infeasible_loop_to_report(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    for name in SCREENS:  # Doc 7 P2: engine kind on every screen
        step(page, name)
        expect(page.get_by_test_id("engine-badge")).to_have_text("Engine: FAKE")

    step(page, "Sizing advice")
    page.get_by_label("Inverter margin m_inv (ratio)").fill("0.2")
    page.get_by_label("Number of inverter units n (count)").fill("2")
    page.get_by_label("Redundancy r (0 or 1) (count)").fill("0")
    page.get_by_role("button", name="Run advice").click()
    _fake_banner(page)
    page.get_by_role("button", name="Accept").click()

    _run_m1(page)
    _fake_banner(page)
    for caption in (
        "System",
        "Bus voltages",
        "Inverter outputs",
        "Line flows",
    ):  # FR-23
        expect(page.get_by_role("table", name=caption)).to_be_visible()
    expect(page.get_by_role("table", name="System totals")).to_contain_text("ε_X")

    step(page, "Constraint check (M2)")
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "INFEASIBLE")
    _fake_banner(page)

    # INFEASIBLE → back to the design with the limiting element marked (K22)
    page.get_by_role("table", name="Limiting constraints").get_by_role(
        "link", name="INV1", exact=True
    ).click()
    expect(page.get_by_role("tab", name="Inverters")).to_have_attribute("aria-selected", "true")
    row = page.locator("tr[aria-current='true']")
    expect(row).to_have_count(1)
    row.get_by_label("Rating (kVA) of INV1").fill("50")

    step(page, "Constraint check (M2)")
    expect(page.get_by_test_id("m1-freshness")).to_have_text("M1 result: stale")
    step(page, "Report")
    expect(page.get_by_test_id("outdated").first).to_be_visible()

    _m1_m2(page)
    step(page, "Report")
    expect(page.get_by_test_id("verdict")).to_contain_text("INFEASIBLE")
    expect(page.get_by_test_id("outdated")).to_have_count(0)


def test_f1_inadmissible_stops_the_pipeline(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("m1-inadmissible"), gui_snapshot())
    step(page, "Power flow (M1)")
    page.get_by_role("button", name="Run M1").click()
    banner = page.get_by_role("status", name="Status")
    expect(banner).to_have_attribute("data-status", "PHYSICALLY_INADMISSIBLE")
    _fake_banner(page)
    step(page, "Constraint check (M2)")
    expect(page.get_by_role("button", name="Run M2")).to_be_disabled()
    expect(page.get_by_test_id("m1-blocked")).to_contain_text("Run power flow (M1) first")


def _saved_project(page: Page, base: str) -> dict[str, Any]:
    enter_design(page, base, gui_snapshot())
    _run_m1(page)
    with page.expect_download() as dl:
        page.get_by_role("button", name="Save").click()
    return json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))


def test_f2_open_refused_skipped_and_stage_1_issues(
    server: Callable[[str], str], page: Page, tmp_path: Path
) -> None:
    doc = _saved_project(page, server("default"))

    newer = tmp_path / "newer.mgproj.json"
    newer.write_text(json.dumps({**doc, "schema_version": 2}), encoding="utf-8")
    page.get_by_label("Open project file").set_input_files(newer)
    expect(page.get_by_test_id("file-check")).to_contain_text("Nothing was loaded")
    expect(page.get_by_test_id("project-name")).to_have_text("E2E project")  # NFR-16

    doc["project"]["name"] = "Reopened"
    doc["loads"][0]["p_kw"] = -1.0
    doc["run_records"][0]["result_hash"] = "0" * 64
    odd = tmp_path / "odd.mgproj.json"
    odd.write_text(json.dumps(doc), encoding="utf-8")
    page.get_by_label("Open project file").set_input_files(odd)
    expect(page.get_by_test_id("project-name")).to_have_text("Reopened")
    expect(page.get_by_test_id("file-check")).to_contain_text("run_records[0]")
    page.wait_for_url("**/workspace/")
    step(page, "Project")
    expect(page.get_by_role("heading", name="Project overview")).to_be_visible()
    expect(page.get_by_role("list", name="Readiness issues")).to_contain_text(
        "Power cannot be negative"
    )
    expect(page.get_by_role("table", name="Counts")).to_contain_text("RunRecords0")


def test_f3_fr_49_import_verify_rerun_in_another_project(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    enter_design(page, base, gui_snapshot())
    _run_m1(page)
    step(page, "Run history")
    runs = page.get_by_role("table", name="Runs").locator("tbody tr")
    expect(runs.first).to_contain_text("FAKE")
    with page.expect_download() as dl:
        runs.first.get_by_role("button", name="Export").click()
    exported = Path(dl.value.path())
    rec = json.loads(exported.read_text(encoding="utf-8"))
    assert len(rec) == 17  # FR-47 / FR-49: the whole record in one file

    page.once("dialog", lambda d: d.accept())
    page.get_by_role("link", name="Microgrid design tool").click()
    page.get_by_label("Project name").fill("Other")
    page.get_by_role("button", name="Create project").click()
    step(page, "Run history")
    expect(page.get_by_text("No runs recorded yet.")).to_be_visible()

    page.get_by_label("Import RunRecord").set_input_files(exported)
    expect(page.get_by_test_id("verify-result")).to_contain_text("The RunRecord is intact.")
    expect(page.get_by_test_id("version-comparison")).to_contain_text("stored FAKE")
    expect(runs).to_have_count(1)
    expect(page.get_by_role("region", name="Run detail")).to_contain_text(rec["snapshot_hash"])

    runs.first.get_by_role("button", name="Re-run").click()
    outcome = page.get_by_test_id("rerun-outcome")
    expect(outcome).to_contain_text("Reproduced")
    expect(outcome).to_contain_text("The original record is unchanged.")
    expect(runs).to_have_count(2)
    expect(page.get_by_test_id(f"run-{rec['record_id']}")).to_contain_text(rec["result_hash"][:12])
