"""Seam 6: S-10 hour mode (P11; Doc 12 FR-78, FR-79; Doc 7 S-10; D-113 K337, K338).

Profile: PF-T of tests/fixtures/FAKE_battery_TEST_ONLY.json (fictitious, TEST ONLY) as λ × 10 kW
on the GUI design. The GUI has no load-profile editor (FR-04 Should), so the profile goes into a
saved Project file that is opened again. Fake profile `m3b-hours` gives placeholder hours (not
engineering values).
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from pathlib import Path

from flows import enter_design, gui_snapshot, step
from playwright.sync_api import Page, expect
from test_network_m1_m2 import _run_m1

FIX = json.loads(
    (Path(__file__).parents[1] / "fixtures/FAKE_battery_TEST_ONLY.json").read_text(encoding="utf-8")
)
LAM = [v / 25 for v in FIX["profile_pf_t_kw"]]


def _sweep_with_profile(page: Page, base: str, tmp_path: Path, lam: list[float]) -> None:
    enter_design(page, base, gui_snapshot())
    step(page, "Sweep (M3b)")
    page.wait_for_url("**/sweep/")
    # no LoadProfile yet: the hour axis is not offered (K337)
    expect(page.locator("#axis-kind option[value=LOAD_PROFILE_HOUR]")).to_have_count(0)
    with page.expect_download() as dl:
        page.get_by_role("button", name="Save", exact=True).click()
    doc = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
    doc["load_profile"] = {
        "id": "PF-T",
        "values": [{"hour": h, "p_kw": 10 * x} for h, x in enumerate(lam)],
    }
    f = tmp_path / "p.mgproj.json"
    f.write_text(json.dumps(doc), encoding="utf-8")
    page.get_by_label("Open project file").set_input_files(f)
    expect(page).to_have_url(re.compile(r"/workspace/$"))  # the import is done (FR-120 race)
    _run_m1(page)
    step(page, "Sweep (M3b)")
    page.wait_for_url("**/sweep/")
    page.get_by_text("M1 result: current").wait_for()
    page.get_by_label("Axis", exact=True).select_option("LOAD_PROFILE_HOUR")
    expect(page.get_by_label("From")).to_have_count(0)  # range fixed to 0 … 23 (K333)
    page.get_by_role("button", name="Run sweep").click()


def test_fr_78_fr_79_hour_mode_worst_hours(
    server: Callable[[str], str], page: Page, tmp_path: Path
) -> None:
    _sweep_with_profile(page, server("m3b-hours"), tmp_path, LAM)
    summary = page.get_by_test_id("hour-summary")
    summary.wait_for()
    worst = {
        "system_frequency_hz": "19",
        "min_voltage_pu": "19",
        "max_loading_ratio": "20",
        "total_losses_kw": "21",
    }
    for metric, hour in worst.items():
        expect(summary.get_by_test_id(f"hour-{metric}").locator("td").nth(1)).to_have_text(hour)
    # hour 22 is not FEASIBLE: never the worst, but named as the first hour not FEASIBLE
    expect(page.get_by_test_id("first-infeasible")).to_have_text("First hour not FEASIBLE: 22 h")
    expect(page.get_by_role("alert").filter(has_text="hour(s)")).to_have_count(0)


def test_fr_79_lambda_above_one_warns(
    server: Callable[[str], str], page: Page, tmp_path: Path
) -> None:
    _sweep_with_profile(page, server("default"), tmp_path, [1.2] + LAM[1:])
    page.get_by_test_id("hour-summary").wait_for()
    expect(
        page.get_by_role("alert").filter(has_text="above the sum of the Load table")
    ).to_have_count(1)
