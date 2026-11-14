"""Plan W4: the diagram workspace beside the step pages (ADR-016). Model edits through the inspector
reach the same design as the tables, with the same issues and the FR-11 Bus guard; Check keeps the
stale-M1 rule (FR-38, FR-40, FR-93) and shows the results in the drawer."""

from __future__ import annotations

from collections.abc import Callable

from flows import area, enter_design, gui_snapshot, step, step_link, studies
from playwright.sync_api import Page, expect


def _open(page: Page, base: str) -> None:
    enter_design(page, base, gui_snapshot())
    area(page, "Model")
    page.wait_for_url("**/workspace/")


def _pick(page: Page, name: str) -> None:
    page.get_by_role("navigation", name="Elements").get_by_role(
        "button", name=name, exact=True
    ).click()


def test_w4_model_inspector_edits_the_design(server: Callable[[str], str], page: Page) -> None:
    _open(page, server("default"))
    _pick(page, "INV1")
    insp = page.get_by_role("complementary", name="Inspector: Inverter INV1")
    expect(insp.get_by_role("heading", name="Inverter INV1")).to_be_focused()  # FR-90
    insp.get_by_label("Rating").fill("12")
    # an invalid entry gets the tables' stage-1 message on the field
    insp.get_by_label("P–f droop").fill("-1")
    expect(insp.get_by_label("P–f droop")).to_have_attribute("aria-invalid", "true")
    insp.get_by_label("P–f droop").fill("0.05")
    expect(insp.get_by_label("P–f droop")).not_to_have_attribute("aria-invalid", "true")
    # FR-11: a Bus with dependents is refused, by name
    _pick(page, "B1")
    page.get_by_role("complementary", name="Inspector: Bus B1").get_by_role(
        "button", name="Delete B1"
    ).click()
    expect(page.get_by_text("Bus B1 cannot be deleted: it is used by")).to_be_visible()
    # the design limits are edited in the same column
    _pick(page, "Design limits")
    limits = page.get_by_role("complementary", name="Inspector: Design limits")
    expect(limits.get_by_test_id("not-evaluated-voltage_min_pu")).to_be_visible()
    limits.get_by_label("Bus voltage, lower limit").fill("0.95")
    expect(limits.get_by_test_id("not-evaluated-voltage_min_pu")).to_have_count(0)
    # a load switches between Q and power factor as on S-03
    _pick(page, "L1")
    load = page.get_by_role("complementary", name="Inspector: Load L1")
    load.get_by_label("PF", exact=True).check()
    expect(load.get_by_label("Power factor")).to_be_visible()
    expect(load.locator("#insp-q_kvar")).to_have_count(0)
    # the tables show the same design
    step(page, "Network")
    page.get_by_role("tab", name="Inverters").click()
    expect(
        page.get_by_test_id("inverters-0").get_by_label("Rating (kVA) of INV1", exact=True)
    ).to_have_value("12")
    step(page, "Constraints")
    expect(page.get_by_label("Bus voltage, lower limit")).to_have_value("0.95")


def test_w4_check_area_runs_and_keeps_the_stale_rule(
    server: Callable[[str], str], page: Page
) -> None:
    _open(page, server("default"))
    area(page, "Check")
    run_m2 = page.get_by_role("button", name="Run M2")
    expect(page.get_by_test_id("m1-blocked")).to_be_visible()
    expect(run_m2).to_be_disabled()
    page.get_by_role("button", name="Run M1").click()
    expect(page.get_by_role("region", name="Check status")).to_contain_text("Power flow solved")
    expect(run_m2).to_be_disabled()  # margins still empty (D-46 K11)
    page.get_by_label("Inverter design margin m_inv").fill("0.1")
    page.get_by_label("Line design margin m_line").fill("0.1")
    run_m2.click()
    drawer = page.get_by_role("region", name="Results")
    expect(drawer.get_by_role("region", name="Constraint check results")).to_be_visible()
    drawer.get_by_role("tab", name="Power flow").click()
    expect(drawer.get_by_role("tabpanel", name="Power flow")).to_be_visible()
    drawer.get_by_role("button", name="Hide results").click()
    expect(drawer.get_by_role("tabpanel")).to_have_count(0)
    # an edit in Model makes M1 stale: M2 is blocked again (FR-38, FR-40)
    area(page, "Model")
    _pick(page, "INV1")
    page.get_by_role("complementary", name="Inspector: Inverter INV1").get_by_label("Rating").fill(
        "11"
    )
    area(page, "Check")
    expect(page.get_by_test_id("m1-blocked")).to_contain_text("Re-run M1")
    expect(run_m2).to_be_disabled()


def test_w6_area_tabs_replace_the_stepper(server: Callable[[str], str], page: Page) -> None:
    """ADR-016 option B (Doc 14 D15): the header area tabs and their screens replace the
    stepper; the stepper's blocked state stays on the screen it guards (FR-38, FR-40)."""
    missing: list[str] = []  # link prefetches must find their files (build_frontend.py)
    page.on("response", lambda r: missing.append(r.url) if r.status == 404 else None)
    _open(page, server("default"))
    expect(page.get_by_role("navigation", name="Pipeline")).to_have_count(0)
    area(page, "Check")
    screens = page.get_by_role("navigation", name="Screens")
    expect(screens.get_by_role("link", name="Diagram")).to_have_attribute("aria-current", "page")
    expect(page.get_by_test_id("step-6-blocked")).to_contain_text("M1 missing")
    page.get_by_role("button", name="Run M1").click()
    expect(page.get_by_role("region", name="Check status")).to_contain_text("Power flow solved")
    expect(page.get_by_test_id("step-6-blocked")).to_have_count(0)
    further = studies(page)
    expect(further.get_by_role("link", name="Sensitivity (M3a)")).to_have_attribute(
        "aria-current", "page"
    )
    step(page, "Transient (M4b)")
    expect(page.get_by_role("heading", name="Transient (M4b)", level=1)).to_be_visible()
    step(page, "Run history")
    expect(page.get_by_role("heading", name="Run history", level=1)).to_be_visible()
    expect(page.get_by_role("main")).to_contain_text("M1")
    expect(step_link(page, "Report")).to_be_visible()
    assert not missing, f"404 responses: {missing}"
