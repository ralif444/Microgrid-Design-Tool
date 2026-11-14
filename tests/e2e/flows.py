"""Seam 5 helper: enter a design through the screens S-01, S-05, S-03 (D-46 K7).

Labels mirror the frontend (EntityTable "<header> of <id>", S-03 row labels). Entity ids in the
snapshot must follow the generated order (LN1…, INV1…, L1…) so lookups by id work.
"""

from __future__ import annotations

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


def create_project(page: Page, base: str, snap: dict[str, Any], name: str = "E2E project") -> None:
    page.goto(base + "/")
    page.get_by_label("Project name").fill(name)
    if snap.get("nominal_voltage_kv") is not None:
        page.get_by_label("Nominal voltage, line-to-line (kV)").fill(
            str(snap["nominal_voltage_kv"])
        )
    page.get_by_role("button", name="Create project").click()
    expect(page.get_by_role("heading", name="Workspace")).to_be_visible()


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
            row.get_by_label(f"Power factor of {rid} (ratio)").fill(str(ld["power_factor"]))
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


# Stepper navigation (plan W4a): every test goes to a step through these two, so a new shell changes
# only STEP_LINK. Keys are the step names of Doc 7 P1; values the accessible link names drawn today.
STEP_LINK = {
    "Project": "Project",
    "Loads": "1 Loads",
    "Sizing advice": "2 Sizing advice",
    "Network": "3 Network",
    "Constraints": "4 Constraints",
    "Power flow (M1)": "5 Power flow (M1)",
    "Constraint check (M2)": "6 Constraint check (M2)",
    "Report": "8 Report",
    "Sensitivity (M3a)": "Sensitivity (M3a)",
    "Sweep (M3b)": "Sweep (M3b)",
    "Scenarios (M3c)": "Scenarios (M3c)",
    "Envelope (M3d)": "Envelope (M3d)",
    "Small-signal (M4a)": "Small-signal (M4a)",
    "Transient (M4b)": "Transient (M4b)",
}


def step_link(page: Page, name: str) -> Locator:
    """The navigation link of a pipeline step."""
    return page.get_by_role("link", name=STEP_LINK[name], exact=True)


def step(page: Page, name: str) -> None:
    """Go to a pipeline step (client-side navigation, so the Project stays open)."""
    step_link(page, name).click()
