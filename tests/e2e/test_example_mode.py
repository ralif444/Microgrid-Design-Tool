"""Doc 12 X9 example mode (EX-1 – EX-5; D-92 – D-97): entering and leaving the guided example D2.

FR-99: S-01 opens the guided example as a new unsaved copy; the header shows "Example mode" and
"Leave example mode"; leaving keeps the Project. FR-101: a normal Project shows no example mode.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from playwright.sync_api import Page, expect
from test_network_m1_m2 import _run_m1


def test_fr_99_guided_example_enters_and_leaves_example_mode(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    page.wait_for_url("**/project/")
    expect(page.get_by_test_id("project-name")).to_have_text(
        re.compile(r"^Guided example D2\s*\*unsaved")
    )
    mode = page.get_by_test_id("example-mode")
    expect(mode).to_contain_text("Example mode")
    mode.get_by_role("button", name="About example mode").click()
    expect(page.get_by_role("note")).to_contain_text("the example settings are not saved")
    page.keyboard.press("Escape")
    expect(page.get_by_role("note")).to_have_count(0)
    # The guided Project carries the Doc 3 §3.7 limits and the Doc 13 §4 scenarios.
    page.get_by_role("link", name="4 Constraints").click()
    expect(page.get_by_label("Bus voltage, lower limit")).to_have_value("0.95")
    page.get_by_role("button", name="Leave example mode").click()
    expect(mode).to_have_count(0)
    expect(page.get_by_test_id("project-name")).to_have_text(re.compile(r"^Guided example D2"))
    expect(page.get_by_label("Bus voltage, lower limit")).to_have_value("0.95")


def test_fr_101_other_projects_leave_example_mode(server: Callable[[str], str], page: Page) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    page.wait_for_url("**/project/")
    expect(page.get_by_test_id("example-mode")).to_be_visible()
    page.get_by_role("link", name="Microgrid Design Tool").click()  # client-side: the store stays
    page.once("dialog", lambda d: d.accept())  # unsaved-changes confirm (K17)
    page.get_by_role("button", name="Open example D2:").click()
    page.wait_for_url("**/project/")
    expect(page.get_by_test_id("project-name")).to_have_text(re.compile(r"^Example D2"))
    expect(page.get_by_test_id("example-mode")).to_have_count(0)


def _tags(page: Page):
    return page.get_by_role("button", name=re.compile(r"^Example source: "))


def test_fr_100_s04_s06_s08_prefill_and_run_without_typing(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    page.wait_for_url("**/project/")
    page.get_by_role("link", name="2 Sizing advice").click()
    expect(page.get_by_label("Inverter margin m_inv (ratio)")).to_have_value("0.2")
    expect(page.get_by_label("Number of inverter units n (count)")).to_have_value("2")
    expect(page.get_by_label("Redundancy r (0 or 1) (count)")).to_have_value("0")
    expect(page.get_by_label("Storage autonomy t_aut, optional (h)")).to_have_value("")
    expect(_tags(page)).to_have_count(3)
    _tags(page).first.click()
    expect(page.get_by_role("note")).to_contain_text("D-92 K230")
    page.keyboard.press("Escape")
    page.get_by_role("button", name="Run advice").click()
    expect(page.get_by_role("status", name="Status")).to_have_attribute("data-status", "FEASIBLE")

    page.get_by_role("link", name="4 Constraints").click()
    expect(page.get_by_test_id("example-constraints")).to_contain_text("Doc 3 §3.7")

    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_label("Inverter design margin m_inv (ratio)")).to_have_value("0.2")
    expect(_tags(page)).to_have_count(2)
    page.get_by_label("Line design margin m_line (ratio)").fill("0.3")
    expect(_tags(page)).to_have_count(1)  # a typed value is the user's, not the example's
    page.get_by_role("button", name="Reset to example values").click()
    expect(page.get_by_label("Line design margin m_line (ratio)")).to_have_value("0.2")
    expect(_tags(page)).to_have_count(2)
    page.get_by_label("Line design margin m_line (ratio)").fill("0.25")
    page.get_by_role("button", name="Run M2").click()
    expect(page.get_by_role("status", name="Status")).to_be_visible()
    # Back on the screen, the last M2 RunRecord wins over the example (K149 before example).
    page.get_by_role("link", name="5 Power flow (M1)").click()
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_label("Line design margin m_line (ratio)")).to_have_value("0.25")
    expect(_tags(page)).to_have_count(0)


def test_fr_101_normal_project_forms_stay_empty(server: Callable[[str], str], page: Page) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open example D2:").click()
    page.wait_for_url("**/project/")
    page.get_by_role("link", name="2 Sizing advice").click()
    expect(page.get_by_label("Inverter margin m_inv (ratio)")).to_have_value("")
    expect(_tags(page)).to_have_count(0)
    expect(page.get_by_role("button", name="Reset to example values")).to_have_count(0)
    page.get_by_role("link", name="4 Constraints").click()
    expect(page.get_by_test_id("example-constraints")).to_have_count(0)
    _run_m1(page)
    page.get_by_role("link", name="6 Constraint check (M2)").click()
    expect(page.get_by_label("Inverter design margin m_inv (ratio)")).to_have_value("")
    expect(_tags(page)).to_have_count(0)
    expect(page.get_by_test_id("example-guide")).to_have_count(0)
    expect(page.get_by_test_id("example-next")).to_have_count(0)


def test_fr_100_s09_to_s12_prefill_and_run(server: Callable[[str], str], page: Page) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    page.wait_for_url("**/project/")
    _run_m1(page)
    not_set = page.get_by_text("Not set in the example: enter a value.")

    page.get_by_role("link", name="Sensitivity (M3a)", exact=True).click()
    expect(page.get_by_label("inverters/INV2/frequency_droop_hz_per_kw")).to_be_checked()
    expect(page.get_by_label("inverters/INV1/p_setpoint_kw")).not_to_be_checked()
    expect(page.get_by_label("Total line losses (kW)")).to_be_checked()
    expect(_tags(page)).to_have_count(2)
    expect(not_set).to_have_count(1)  # step_relative: no value given (D-92 K231)
    page.get_by_label("Step (ratio)").fill("0.01")  # a test value, not an example value
    expect(not_set).to_have_count(0)
    page.get_by_role("button", name="Run M3a").click()
    expect(page.get_by_role("status", name="Status")).to_be_visible()

    page.get_by_role("link", name="Sweep (M3b)", exact=True).click()
    expect(page.get_by_label("Axis", exact=True)).to_have_value("LOAD_SCALE")
    expect(page.get_by_label("From (factor)")).to_have_value("1")
    expect(page.get_by_label("To (factor)")).to_have_value("4")
    expect(page.get_by_label("Lowest damping ζ_min")).to_be_checked()
    expect(
        page.get_by_label("Include the eigenvalues of each point", exact=True)
    ).not_to_be_checked()
    expect(_tags(page)).to_have_count(3)
    expect(not_set).to_have_count(1)  # step_count
    page.get_by_label("From (factor)").fill("2")
    expect(_tags(page)).to_have_count(2)
    page.get_by_role("button", name="Reset to example values").click()
    expect(page.get_by_label("From (factor)")).to_have_value("1")
    expect(_tags(page)).to_have_count(3)
    page.get_by_label("Points (count)").fill("4")
    with page.expect_request("**/api/analyses/M3b") as req:
        page.get_by_role("button", name="Run sweep").click()
    sent = req.value.post_data_json["parameters"]
    assert sent["axis"]["kind"] == "LOAD_SCALE" and sent["point_metrics"] == ["ZETA_MIN"]
    assert "include_eigenvalues" not in sent
    expect(page.get_by_role("status", name="Status")).to_be_visible()

    page.get_by_role("link", name="Scenarios (M3c)", exact=True).click()
    expect(page.get_by_test_id("example-scenarios")).to_contain_text("D2 base")

    page.get_by_role("link", name="Envelope (M3d)", exact=True).click()
    expect(page.get_by_label("X axis: Axis", exact=True)).to_have_value("LOAD_SCALE")
    expect(page.get_by_label("X axis: To (factor)")).to_have_value("4")
    expect(page.get_by_label("Y axis: Axis", exact=True)).to_have_value("PARAMETER")
    expect(_tags(page)).to_have_count(1)
    expect(not_set).to_have_count(3)  # x step count, y axis, y step count
    page.get_by_label("X axis: Points (count)").fill("2")  # test values from here on
    page.get_by_label("Y axis: Parameter").select_option("inverters/INV1/rated_kva")
    page.get_by_label("Y axis: From (kVA)").fill("60")
    page.get_by_label("Y axis: To (kVA)").fill("80")
    page.get_by_label("Y axis: Points (count)").fill("2")
    expect(not_set).to_have_count(0)
    page.get_by_role("button", name="Run envelope").click()
    expect(page.get_by_role("status", name="Status")).to_be_visible()


def test_fr_101_normal_sweep_sends_no_point_metrics(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open example D2:").click()
    page.wait_for_url("**/project/")  # the open navigates; clicking on before it lands is lost
    _run_m1(page)
    page.get_by_role("link", name="Sweep (M3b)", exact=True).click()
    expect(page.get_by_label("Axis", exact=True)).to_have_value("PARAMETER")
    expect(page.get_by_label("Lowest damping ζ_min")).not_to_be_checked()
    expect(_tags(page)).to_have_count(0)
    page.get_by_label("Axis", exact=True).select_option("LOAD_SCALE")
    page.get_by_label("From (factor)").fill("1")
    page.get_by_label("To (factor)").fill("2")
    page.get_by_label("Points (count)").fill("2")
    with page.expect_request("**/api/analyses/M3b") as req:
        page.get_by_role("button", name="Run sweep").click()
    assert set(req.value.post_data_json["parameters"]) == {"axis"}


def test_fr_103_s13_runs_and_s14_offers_the_doc13_disturbances(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    page.wait_for_url("**/project/")
    _run_m1(page)

    # S-13: tau_in and the damping threshold stay empty (D-92 K231); Run needs no typing.
    page.get_by_role("link", name="Small-signal (M4a)", exact=True).click()
    page.get_by_role("button", name="Run M4a").click()
    expect(page.get_by_role("status", name="Status")).to_be_visible()

    page.get_by_role("link", name="Transient (M4b)", exact=True).click()
    preset = page.get_by_label("Example disturbance", exact=True)
    kind = page.get_by_label("Disturbance", exact=True)
    expect(preset).to_have_value("DR-01")  # first preset fills the form on arrival
    expect(kind).to_have_value("LOAD_STEP")
    expect(page.get_by_label("Element", exact=True)).to_have_value("L1")
    expect(page.get_by_label("Step size (kW)")).to_have_value("2.5")
    expect(page.get_by_label("Reactive step, optional (kvar)")).to_have_value("1")
    expect(page.get_by_label("Start time (s)")).to_have_value("1")
    expect(page.get_by_label("Simulation end (s)")).to_have_value("4")
    expect(page.get_by_label("Permanent")).to_be_checked()
    expect(_tags(page)).to_have_count(1)
    expect(page.get_by_text("Not set in the example: enter a value.")).to_have_count(1)

    preset.select_option("DR-02")
    expect(kind).to_have_value("REFERENCE_STEP")
    expect(page.get_by_label("Reference", exact=True)).to_have_value("P_SETPOINT")
    expect(page.get_by_label("Element", exact=True)).to_have_value("INV1")
    expect(page.get_by_label("Step size (kW)")).to_have_value("2")

    preset.select_option("TS-02")
    expect(kind).to_have_value("INVERTER_OUTAGE")
    expect(page.get_by_label("Element", exact=True)).to_have_value("INV2")
    expect(page.get_by_label("Simulation end (s)")).to_have_value("5")
    with page.expect_request("**/api/analyses/M4b") as req:
        page.get_by_role("button", name="Run M4b").click()
    sent = req.value.post_data_json["parameters"]
    assert sent["disturbance"] == {
        "kind": "INVERTER_OUTAGE",
        "element_id": "INV2",
        "start_time_s": 1,
        "duration_s": None,
    }
    assert sent["simulation_end_s"] == 5 and "settling" not in sent
    expect(page.get_by_role("status", name="Status")).to_be_visible()

    page.get_by_label("Start time (s)").fill("2")  # an edit makes the values the user's
    expect(preset).to_have_value("")
    expect(_tags(page)).to_have_count(0)
    page.get_by_role("button", name="Reset to example values").click()
    expect(preset).to_have_value("DR-01")
    expect(page.get_by_label("Start time (s)")).to_have_value("1")


def test_fr_101_normal_transient_form_starts_empty(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open example D2:").click()
    page.wait_for_url("**/project/")
    _run_m1(page)
    page.get_by_role("link", name="Transient (M4b)", exact=True).click()
    expect(page.get_by_label("Example disturbance", exact=True)).to_have_count(0)
    expect(page.get_by_label("Element", exact=True)).to_have_value("")
    expect(page.get_by_label("Start time (s)")).to_have_value("")


def test_fr_102_guidance_and_next_links_lead_through_the_pipeline(
    server: Callable[[str], str], page: Page
) -> None:
    base = server("default")
    page.goto(base + "/")
    page.get_by_role("button", name="Open guided example (D2)").click()
    page.wait_for_url("**/project/")
    page.get_by_role("link", name="1 Loads").click()
    guide = page.get_by_test_id("example-guide")
    expect(guide).to_contain_text("Example mode: this screen shows the guided example.")
    expect(guide).to_contain_text("Results on the Fake Engine are placeholders.")
    guide.get_by_text("What this step shows").click()
    expect(guide).to_contain_text("reference design D2")
    expect(guide).to_contain_text("Source: Doc 13 §4")
    status = page.get_by_role("status", name="Status")
    nxt = page.get_by_role("link", name=re.compile(r"^Next: "))

    def go(name: str) -> None:
        expect(nxt).to_have_text(f"Next: {name}")
        nxt.click()

    go("Sizing advice")
    expect(guide).to_contain_text("Press Run.")
    guide.get_by_text("What this step shows").click()
    expect(guide).to_contain_text("Do not Accept it here")
    expect(nxt).to_have_count(0)  # only after a run
    page.get_by_role("button", name="Run advice").click()
    go("Network")
    go("Constraints")
    go("Power flow (M1)")
    page.get_by_role("button", name="Run M1").click()
    go("Constraint check (M2)")
    page.get_by_role("button", name="Run M2").click()
    go("Sensitivity (M3a)")
    page.get_by_label("Step (ratio)").fill(
        "0.01"
    )  # test values for the fields the example leaves empty
    page.get_by_role("button", name="Run M3a").click()
    go("Sweep (M3b)")
    page.get_by_label("Points (count)").fill("4")
    page.get_by_role("button", name="Run sweep").click()
    go("Scenarios (M3c)")
    for name in ("D2 base", "D2S load × 2.4", "D2H load × 4.0"):
        page.get_by_role("region", name=f"Scenario {name}").get_by_role("checkbox").check()
    page.get_by_role("button", name="Compare").click()
    go("Envelope (M3d)")
    page.get_by_label("X axis: Points (count)").fill("2")
    page.get_by_label("Y axis: Parameter").select_option("inverters/INV1/rated_kva")
    page.get_by_label("Y axis: From (kVA)").fill("60")
    page.get_by_label("Y axis: To (kVA)").fill("80")
    page.get_by_label("Y axis: Points (count)").fill("2")
    page.get_by_role("button", name="Run envelope").click()
    go("Small-signal (M4a)")
    page.get_by_role("button", name="Run M4a").click()
    go("Transient (M4b)")
    page.get_by_role("button", name="Run M4b").click()
    expect(status).to_be_visible()
    go("Report")
    expect(page.get_by_test_id("example-report")).to_have_text(
        "Produced in example mode from the guided example D2."
    )
    expect(guide).to_contain_text("this screen shows the guided example")
    expect(nxt).to_have_count(0)  # the Report is the last step
