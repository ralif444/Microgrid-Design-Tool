"""Seam 5 (WP 1.2.3): S-16 Report, S-15 Run history and the Project file on the Fake Engine.

FR-58, FR-59 (report: verdict, limiting constraints, hash, a table and a chart), FR-49 (one-file
RunRecord export), FR-50 (tampered import refused, nothing added), FR-52, FR-53 (re-run adds a
record, Reproduced), FR-54, FR-55 (Save then Open restores the Project), K17 (confirm on unsaved).
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from pathlib import Path

from flows import enter_design, gui_snapshot
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _margins, _run_m1


def _m1_m2(page: Page) -> None:
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    _margins(page)
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_be_visible()


def test_fr_58_fr_59_report_shows_verdict_constraints_hash_table_chart(
    server: Callable[[str], str], page: Page
) -> None:
    enter_design(page, server("m2-infeasible"), gui_snapshot())
    page.get_by_role("link", name="8 Report").click()
    expect(page.get_by_text("No results yet.")).to_be_visible()
    _m1_m2(page)
    page.get_by_role("link", name="8 Report").click()
    expect(page.get_by_test_id("verdict")).to_contain_text("INFEASIBLE")
    expect(page.get_by_role("table", name="Limiting constraints")).to_contain_text("Violated by")
    expect(page.get_by_role("img", name="Bus voltage (p.u.) bar chart")).to_be_visible()
    expect(page.get_by_role("table", name="Bus voltages")).to_be_visible()
    trace = page.get_by_role("table", name="Traceability")
    expect(trace).to_contain_text("M2")
    expect(trace.locator("code").first).to_have_text(re.compile(r"^[0-9a-f]{64}$"))
    expect(page.get_by_role("table", name="Model assumptions")).to_contain_text(
        "Tiga fasa seimbang"
    )
    expect(page.get_by_test_id("fake-note")).to_be_visible()
    expect(page.get_by_test_id("outdated")).to_have_count(0)


def test_fr_49_fr_50_fr_53_runs_export_import_rerun_and_project_file(
    server: Callable[[str], str], page: Page, tmp_path: Path
) -> None:
    base = server("default")
    enter_design(page, base, gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="Run history").click()
    rows = page.get_by_role("table", name="Runs").locator("tbody tr")
    expect(rows).to_have_count(1)

    with page.expect_download() as dl:
        rows.first.get_by_role("button", name="Export").click()
    assert re.fullmatch(r"[0-9a-f]+\.mgrun\.json", dl.value.suggested_filename)
    rec = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))

    bad = tmp_path / "bad.mgrun.json"
    rec["result"]["payload"]["system_frequency_hz"] = 1.0
    bad.write_text(json.dumps(rec), encoding="utf-8")
    page.get_by_label("Import RunRecord").set_input_files(bad)
    expect(page.get_by_test_id("verify-result")).to_contain_text("changed after it was created")
    expect(rows).to_have_count(1)

    rows.first.get_by_role("button", name="Re-run").click()
    expect(page.get_by_test_id("rerun-outcome")).to_contain_text("Reproduced")
    expect(rows).to_have_count(2)

    with page.expect_download() as dl:
        page.get_by_role("button", name="Save").click()
    assert dl.value.suggested_filename == "E2E project.mgproj.json"
    saved = Path(dl.value.path())
    expect(page.get_by_title("Unsaved changes")).to_have_count(0)

    page.once("dialog", lambda d: d.accept())
    page.get_by_role("link", name="Microgrid design tool").click()
    page.get_by_label("Project name").fill("Other")
    page.get_by_role("button", name="Create project").click()
    expect(page.get_by_test_id("project-name")).to_contain_text("Other")

    page.once("dialog", lambda d: d.accept())  # K17: unsaved "Other" is discarded
    page.get_by_label("Open project file").set_input_files(saved)
    expect(page.get_by_test_id("project-name")).to_have_text("E2E project")
    page.get_by_role("link", name="Run history").click()
    expect(rows).to_have_count(2)


def test_fr_83_compare_two_runs(server: Callable[[str], str], page: Page) -> None:
    enter_design(page, server("default"), gui_snapshot())
    _run_m1(page)
    page.get_by_role("link", name="3 Network").click()
    page.get_by_role("tab", name="Lines").click()
    page.get_by_label("R (Ω/km) of LN1").fill("0.9")
    _run_m1(page)
    page.get_by_role("link", name="Run history").click()
    rows = page.get_by_role("table", name="Runs").locator("tbody tr")
    expect(rows).to_have_count(2)
    ids = [str(rows.nth(k).get_attribute("data-testid")).removeprefix("run-") for k in (0, 1)]
    page.get_by_label("First run").select_option(ids[0])
    page.get_by_label("Second run").select_option(ids[1])
    diff = page.get_by_role("table", name="Input differences")
    expect(diff).to_contain_text("lines[LN1].r_ohm_per_km")
    expect(diff).to_contain_text("0.9")
    # Fake M1 results do not depend on R, so no result difference is expected here.
    expect(page.get_by_text("Result differences: no differences.")).to_be_visible()
