"""Seam 5 helper: enter a design through the screens S-01, S-05, S-03 (D-46 K7).

Labels mirror the frontend (EntityTable "<header> of <id>", S-03 row labels). Entity ids in the
snapshot must follow the generated order (LN1…, INV1…, L1…) so lookups by id work.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from playwright.sync_api import Locator, Page, expect

LINE_LABELS = {
    "from_bus_id": "From bus",
    "to_bus_id": "To bus",
    "r_ohm_per_km": "R (Ω/km)",
    "x_ohm_per_km": "X (Ω/km)",
    "length_km": "Length (km)",
    "current_limit_a": "Current limit, optional (A)",
}
INVERTER_LABELS = {
    "bus_id": "Bus",
    "rated_kva": "Rating (kVA)",
    "frequency_droop_hz_per_kw": "P–f droop (Hz/kW)",
    "voltage_droop_kv_per_kvar": "Q–V droop (kV/kvar)",
    "frequency_setpoint_hz": "Frequency setpoint (Hz)",
    "voltage_setpoint_kv": "Voltage setpoint, line-to-line (kV)",
    "p_setpoint_kw": "P setpoint, optional (kW)",
    "q_setpoint_kvar": "Q setpoint, optional (kvar)",
    "tau_p_s": "τ_P, needed for M4 (s)",
    "tau_q_s": "τ_Q, needed for M4 (s)",
}
SELECTS = {"from_bus_id", "to_bus_id", "bus_id"}


def _fill_row(page: Page, labels: dict[str, str], row: dict[str, Any]) -> None:
    rid = row["id"]
    for field, label in labels.items():
        if row.get(field) is None:
            continue
        box = page.get_by_label(f"{label} of {rid}", exact=True)
        if field in SELECTS:
            box.select_option(row[field])
        else:
            box.fill(str(row[field]))


def delete(page: Page, name: str) -> None:
    """Click "Delete <name>" and confirm the dialog (plan F2: every removal asks first)."""
    page.get_by_role("button", name=f"Delete {name}", exact=True).click()
    page.get_by_role("dialog").get_by_role("button", name="Delete", exact=True).click()
    expect(page.get_by_role("dialog")).to_have_count(0)


def create_project(
    page: Page, base: str, snap: dict[str, Any], name: str = "E2E project"
) -> None:
    page.goto(base + "/")
    page.get_by_label("Project name").fill(name)
    if snap.get("nominal_voltage_kv") is not None:
        page.get_by_label("Nominal voltage, line-to-line (kV)").fill(
            str(snap["nominal_voltage_kv"])
        )
    page.get_by_role("button", name="Create project").click()
    expect(page.get_by_role("heading", name="Model", level=1)).to_be_visible()


def enter_design(page: Page, base: str, snap: dict[str, Any]) -> None:
    """Create a Project and enter `snap` through the screens (client-side navigation only)."""
    create_project(page, base, snap)
    step(page, "Network")
    for bus in snap["buses"]:
        page.get_by_label("Bus id", exact=True).fill(bus["id"])
        page.get_by_role("button", name="Add bus").click()
    if snap["lines"]:
        page.get_by_role("tab", name="Lines").click()
        for ln in snap["lines"]:
            page.get_by_role("button", name="+ Add line").click()
            _fill_row(page, LINE_LABELS, ln)
    if snap["inverters"]:
        page.get_by_role("tab", name="Inverters").click()
        for inv in snap["inverters"]:
            page.get_by_role("button", name="+ Add inverter").click()
            _fill_row(page, INVERTER_LABELS, inv)
    step(page, "Loads")
    for ld in snap["loads"]:
        page.get_by_role("button", name="+ Add load").click()
        rid = ld["id"]
        row = page.get_by_test_id(f"load-{rid}")
        row.get_by_label(f"Bus of {rid}").select_option(ld["bus_id"])
        row.get_by_label(f"P of {rid} (kW)").fill(str(ld["p_kw"]))
        if ld.get("power_factor") is not None:
            row.get_by_label("PF", exact=True).check()
            row.get_by_label(f"Power factor of {rid} (ratio)").fill(
                str(ld["power_factor"])
            )
            row.get_by_label(f"PF direction of {rid}").select_option(ld["pf_direction"])
        else:
            row.get_by_label(f"Q of {rid} (kvar)").fill(str(ld["q_kvar"]))


def gui_snapshot() -> dict[str, Any]:
    """The shared two-bus fixture with ids in generated order (LN1, L1, L2)."""
    from fixtures.designs import two_bus_snapshot

    snap = two_bus_snapshot()
    snap["lines"][0]["id"] = "LN1"
    for k, ld in enumerate(snap["loads"], start=1):
        ld["id"] = f"L{k}"
    return snap


# Area navigation (ADR-016 option B, Doc 14 D15): every test reaches a screen through these helpers, so
# a shell change edits only STEP_LINK. Values: (area tab, screen link) as drawn by AreaNav.
STEP_LINK = {
    "Project": ("Model", "Project"),
    "Loads": ("Model", "Loads"),
    "Sizing advice": ("Model", "Sizing advice"),
    "Network": ("Model", "Network"),
    "Constraints": ("Model", "Constraints"),
    "Power flow (M1)": ("Check", "Power flow (M1)"),
    "Constraint check (M2)": ("Check", "Constraint check (M2)"),
    "Report": ("Report", "Report"),
    "Run history": ("Report", "Run history"),
    "Sensitivity (M3a)": ("Studies", "Sensitivity (M3a)"),
    "Sweep (M3b)": ("Studies", "Sweep (M3b)"),
    "Scenarios (M3c)": ("Studies", "Scenarios (M3c)"),
    "Envelope (M3d)": ("Studies", "Envelope (M3d)"),
    "Small-signal (M4a)": ("Studies", "Small-signal (M4a)"),
    "Transient (M4b)": ("Studies", "Transient (M4b)"),
}


def area_tab(page: Page, name: str) -> Locator:
    """A header area tab: Model, Check, Studies or Report."""
    return page.get_by_role("navigation", name="Areas").get_by_role(
        "link", name=name, exact=True
    )


def area(page: Page, name: str) -> None:
    """Open an area (client-side navigation, so the Project stays open)."""
    area_tab(page, name).click()
    expect(area_tab(page, name)).to_have_attribute("aria-current", "page")


def studies(page: Page) -> Locator:
    """Open the Studies area and return its list of screens (the former step-7 list)."""
    area(page, "Studies")
    return page.get_by_role("list", name="Studies")


def step_link(
    page: Page, name: str, go: Callable[[Locator], None] | None = None
) -> Locator:
    """The screen link of a former pipeline step; opens its area first (with `go`, default click)."""
    tab_name, link = STEP_LINK[name]
    tab = area_tab(page, tab_name)
    if tab.get_attribute("aria-current") != "page":
        (go or (lambda t: t.click()))(tab)
        expect(tab).to_have_attribute("aria-current", "page")
    return page.get_by_role("navigation", name="Screens").get_by_role(
        "link", name=link, exact=True
    )


def step(page: Page, name: str) -> None:
    """Go to a screen (client-side navigation, so the Project stays open)."""
    step_link(page, name).click()


ROUTE_STEP = {
    "project": "Project",
    "loads": "Loads",
    "sizing": "Sizing advice",
    "network": "Network",
    "constraints": "Constraints",
    "power-flow": "Power flow (M1)",
    "constraint-check": "Constraint check (M2)",
    "sensitivity": "Sensitivity (M3a)",
    "sweep": "Sweep (M3b)",
    "scenarios": "Scenarios (M3c)",
    "envelope": "Envelope (M3d)",
    "small-signal": "Small-signal (M4a)",
    "transient": "Transient (M4b)",
    "runs": "Run history",
    "report": "Report",
}


def go_route(page: Page, route: str) -> None:
    """Open `/<route>/` through the area navigation, or its header link (Catalogue, About)."""
    if route in ROUTE_STEP:
        step(page, ROUTE_STEP[route])
    else:
        page.get_by_role("banner").locator(f'a[href="/{route}/"]').first.click()
    page.wait_for_url(f"**/{route}/")
