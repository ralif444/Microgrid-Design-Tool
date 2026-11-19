"""Analysis type RS: coupling reactor sizing advice (ADR-017; Doc 12 X11).

App-side composition of existing runs, like BA (ADR-015): each probe adds one series reactor per
inverter (a terminal bus and a REACTOR line of 1 m) and runs M1, then M4a, through the execution
guard. No equation, state or assumption is added to the model; the reactor is an ordinary RL line.

Sizing rule (user decision Q3, 2026-11-19): every inverter gets the same percentage p of its own
base impedance Z_b = V_LL^2 / S_rated. The smallest p in (0, ceiling] with stability class STABLE
and zeta_min >= the user's target is found by bisection; the search assumes damping grows with p
(stated in the result). Voltage limits are checked against the Project's design limits.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from mgapp.domain.contract import (
    AnalysisResult,
    EngineIdentity,
    RunRecordRef,
    ValidationIssue,
)
from mgapp.domain.entities import Bus, Line, ProjectSnapshot
from mgapp.domain.enums import (
    AnalysisType,
    EngineKind,
    IssueCode,
    IssueLevel,
    Status,
    StatusCode,
)
from mgapp.services.canonical import normalise_snapshot, sha256_hex
from mgapp.services.guard import FAKE_WARNING, GuardedOutcome

REACTOR_LENGTH_KM = 0.001  # Q2: a reactor is stored as a 1 m line
BISECTION_STEPS = 10  # resolution ceiling / 1024
CAVEAT_TEXT = (
    "Advice only: the search adds one series reactor per inverter, each the same share of its "
    "inverter's base impedance, and assumes damping grows with reactor size. The result does not "
    "change any verdict; apply it and run small-signal stability again."
)

RunEngine = Callable[..., GuardedOutcome]


def _issue(field: str, message: str) -> ValidationIssue:
    return ValidationIssue(
        code=IssueCode.REACTOR_SIZING_INVALID,
        level=IssueLevel.REQUEST,
        entity="parameters",
        field=field,
        message=message,
    )


def _num(v: Any) -> bool:
    return isinstance(v, int | float) and not isinstance(v, bool) and math.isfinite(v)


def parameter_issues(p: dict[str, Any], s: ProjectSnapshot) -> list[ValidationIssue]:
    """RS parameters {damping_target_ratio, max_percent, reactor_x_over_r, reactors}."""
    out: list[ValidationIssue] = []
    z = p.get("damping_target_ratio")
    if not (_num(z) and 0 < z < 1):
        out.append(_issue("damping_target_ratio", "Enter a damping target between 0 and 1."))
    m = p.get("max_percent")
    if not (_num(m) and 0 < m <= 100):
        out.append(_issue("max_percent", "Enter a search ceiling above 0 and at most 100 %."))
    q = p.get("reactor_x_over_r")
    if not (_num(q) and q > 0):
        out.append(_issue("reactor_x_over_r", "Enter the reactor X/R used by the search (> 0)."))
    rs = p.get("reactors", [])
    keys = ("inductance_mh", "resistance_mohm", "rated_current_a")
    if not isinstance(rs, list) or not all(
        isinstance(r, dict)
        and isinstance(r.get("entry_id"), str)
        and all(_num(r.get(k)) and r[k] > 0 for k in keys)
        for r in rs
    ):
        out.append(
            _issue(
                "reactors",
                "Each catalogue reactor needs an id, inductance, resistance and rated current.",
            )
        )
    if s.nominal_voltage_kv is None or s.nominal_frequency_hz is None:
        out.append(_issue("project", "Enter the nominal voltage and frequency first."))
    return out


def base_ohm(s: ProjectSnapshot, rated_kva: float) -> float:
    """Z_b = V_LL^2 / S in ohm (kV^2 / MVA)."""
    return (s.nominal_voltage_kv or 0.0) ** 2 / (rated_kva / 1000.0)


def rated_current_a(s: ProjectSnapshot, rated_kva: float) -> float:
    return rated_kva / (math.sqrt(3) * (s.nominal_voltage_kv or 0.0))


def _free_id(taken: set[str], want: str) -> str:
    k, out = 2, want
    while out in taken:
        out, k = f"{want}{k}", k + 1
    taken.add(out)
    return out


def placement(s: ProjectSnapshot) -> list[dict[str, str]]:
    """Per inverter: its bus, the new terminal bus and the reactor line id (explicit, Q1)."""
    buses = {b.id for b in s.buses if b.id}
    lines = {ln.id for ln in s.lines if ln.id}
    return [
        {
            "inverter_id": inv.id or "",
            "bus_id": inv.bus_id or "",
            "terminal_bus_id": _free_id(buses, f"{inv.id}T"),
            "line_id": _free_id(lines, f"LR{inv.id}"),
        }
        for inv in s.inverters
    ]


def with_reactors(
    s: ProjectSnapshot, place: list[dict[str, str]], rx_ohm: list[tuple[float, float]]
) -> ProjectSnapshot:
    """Snapshot with one REACTOR line (R, X in ohm) between each inverter and its bus."""
    new_buses = [Bus(id=p["terminal_bus_id"]) for p in place]
    new_lines = [
        Line(
            id=p["line_id"],
            kind="REACTOR",
            from_bus_id=p["terminal_bus_id"],
            to_bus_id=p["bus_id"],
            r_ohm_per_km=r / REACTOR_LENGTH_KM,
            x_ohm_per_km=x / REACTOR_LENGTH_KM,
            length_km=REACTOR_LENGTH_KM,
        )
        for p, (r, x) in zip(place, rx_ohm, strict=True)
    ]
    invs = [
        inv.model_copy(update={"bus_id": p["terminal_bus_id"]})
        for inv, p in zip(s.inverters, place, strict=True)
    ]
    return s.model_copy(
        update={"buses": [*s.buses, *new_buses], "lines": [*s.lines, *new_lines], "inverters": invs}
    )


@dataclass
class Probe:
    ok: bool  # stable, damped to the target and within the voltage limits
    damped: bool  # stable and damped to the target
    point: dict[str, Any]


@dataclass
class Search:
    run: RunEngine
    target: float
    limits: tuple[float | None, float | None]
    budget_s: float
    t0: float = field(default_factory=time.monotonic)
    calls: int = 0
    identity: EngineIdentity | None = None
    timed_out: bool = False
    steps: list[dict[str, Any]] = field(default_factory=list)

    def probe(self, s: ProjectSnapshot, percent: float | None) -> Probe:
        if time.monotonic() - self.t0 > self.budget_s:
            self.timed_out = True
            return Probe(False, False, {"percent": percent, "reason": "time budget"})
        m1 = self.run(s)
        self.calls += 1
        self.identity = self.identity or m1.identity
        r1 = m1.result
        point: dict[str, Any] = {"percent": percent, "m1_status": r1.status.value}
        if r1.status is not Status.FEASIBLE or not r1.payload:
            point["reason"] = r1.message
            self.steps.append(point)
            return Probe(False, False, point)
        v = [b["voltage_pu"] for b in r1.payload.get("bus_results", [])]
        point["min_voltage_pu"], point["max_voltage_pu"] = min(v), max(v)
        ref = RunRecordRef(
            record_id="rs-probe",
            analysis_type=AnalysisType.M1,
            snapshot_hash=sha256_hex(normalise_snapshot(s)),
            status=r1.status,
            result_hash=sha256_hex(r1.payload),
            result_payload=r1.payload,
        )
        m4 = self.run(s, AnalysisType.M4A, {}, ref)
        self.calls += 1
        r4 = m4.result
        p4 = r4.payload or {}
        point["m4a_status"] = r4.status.value
        point["stability_class"] = p4.get("stability_class")
        point["zeta_min"] = p4.get("zeta_min")
        osc = [m for m in p4.get("modes") or [] if m.get("frequency_hz")]
        point["frequency_hz"] = (
            min(osc, key=lambda m: m["damping_ratio"])["frequency_hz"] if osc else None
        )
        zeta = point["zeta_min"]
        damped = point["stability_class"] == "STABLE" and (zeta is None or zeta >= self.target)
        lo, hi = self.limits
        volt_ok = (lo is None or min(v) >= lo) and (hi is None or max(v) <= hi)
        point["voltage_ok"] = volt_ok
        self.steps.append(point)
        return Probe(damped and volt_ok, damped, point)


def _reactance(s: ProjectSnapshot, percent: float, xr: float) -> list[tuple[float, float]]:
    out = []
    for inv in s.inverters:
        x = percent / 100.0 * base_ohm(s, inv.rated_kva or 0.0)
        out.append((x / xr, x))
    return out


def compute(
    snapshot: ProjectSnapshot,
    p: dict[str, Any],
    _m1: RunRecordRef,
    run: RunEngine,
    budget_s: float,
) -> tuple[AnalysisResult, EngineIdentity | None]:
    s = snapshot
    target, ceiling, xr = (
        float(p["damping_target_ratio"]),
        float(p["max_percent"]),
        float(p["reactor_x_over_r"]),
    )
    dc = s.design_constraints
    search = Search(run, target, (dc.voltage_min_pu, dc.voltage_max_pu), budget_s)
    place = placement(s)
    w = 2 * math.pi * (s.nominal_frequency_hz or 0.0)

    def result(outcome: str, message: str, **extra: Any) -> tuple[AnalysisResult, Any]:
        fake = search.identity is not None and search.identity.engine_kind is EngineKind.FAKE
        if search.timed_out:
            return AnalysisResult(
                status=Status.UNAVAILABLE,
                status_code=StatusCode.TIMEOUT,
                message=f"The reactor sizing took longer than the time budget of {budget_s:g} s "
                f"over {search.calls} runs and was stopped. Run again.",
                payload=None,
                warnings=[FAKE_WARNING] if fake else [],
                diagnostics={"computed_by": "app", "engine_calls": search.calls},
            ), search.identity
        payload = {
            "outcome": outcome,
            "damping_target_ratio": target,
            "max_percent": ceiling,
            "reactor_x_over_r": xr,
            "placement": place,
            "steps": search.steps,
            "caveat_text": CAVEAT_TEXT,
            **extra,
        }
        return AnalysisResult(
            status=Status.FEASIBLE,
            status_code=StatusCode.OK,
            message=message,
            payload=payload,
            warnings=[FAKE_WARNING] if fake else [],
            diagnostics={"computed_by": "app", "engine_calls": search.calls},
        ), search.identity

    base = search.probe(s, None)
    if search.timed_out:
        return result("", "")
    if base.point.get("m4a_status") != Status.FEASIBLE.value:
        return result(
            "BASE_NOT_EVALUATED",
            "Small-signal stability could not be evaluated on this design, so no reactor size "
            "can be advised. Run M1 and M4a and correct what they report.",
            base=base.point,
        )
    if base.damped:
        return result(
            "NOT_NEEDED",
            "The design already reaches the damping target without reactors.",
            base=base.point,
        )
    top = search.probe(with_reactors(s, place, _reactance(s, ceiling, xr)), ceiling)
    if not top.damped:
        return result(
            "NOT_FOUND_BELOW_CEILING",
            f"No reactor up to {ceiling:g} % of the inverter base impedance reaches the damping "
            "target. The cause may be something other than resistive coupling.",
            base=base.point,
        )
    lo, hi = 0.0, ceiling
    for _ in range(BISECTION_STEPS):
        mid = (lo + hi) / 2
        pr = search.probe(with_reactors(s, place, _reactance(s, mid, xr)), mid)
        if search.timed_out:
            return result("", "")
        lo, hi = (lo, mid) if pr.damped else (mid, hi)
    need = search.probe(with_reactors(s, place, _reactance(s, hi, xr)), hi)
    inverters = []
    for inv, pl in zip(s.inverters, place, strict=True):
        zb = base_ohm(s, inv.rated_kva or 0.0)
        need_mh = hi / 100.0 * zb / w * 1000.0
        i_r = rated_current_a(s, inv.rated_kva or 0.0)
        fits = [
            r
            for r in p.get("reactors", [])
            if r["inductance_mh"] >= need_mh and r["rated_current_a"] >= i_r
        ]
        pick = min(fits, key=lambda r: (r["rated_current_a"], r["inductance_mh"]), default=None)
        inverters.append(
            {
                **pl,
                "rated_current_a": i_r,
                "needed_inductance_mh": need_mh,
                "entry_id": pick["entry_id"] if pick else None,
                "entry": pick,
            }
        )
    common = {
        "base": base.point,
        "percent_of_base": hi,
        "at_percent": need.point,
        "inverters": inverters,
    }
    if not need.point.get("voltage_ok", True):
        return result(
            "VOLTAGE_LIMITED",
            f"Reactors of {hi:.3g} % of the base impedance reach the damping target but break a "
            "voltage limit; larger reactors would lower the voltage further.",
            **common,
        )
    if any(i["entry"] is None for i in inverters):
        return result(
            "NO_CATALOGUE_PART",
            "The needed reactor size was found, but the Catalogue has no reactor with enough "
            "inductance and rated current for every inverter. Add one from a datasheet.",
            **common,
        )
    picked = [
        (i["entry"]["resistance_mohm"] / 1000.0, w * i["entry"]["inductance_mh"] / 1000.0)
        for i in inverters
    ]
    conf = search.probe(with_reactors(s, place, picked), None)
    if search.timed_out:
        return result("", "")
    if not conf.ok:
        return result(
            "NOT_CONFIRMED",
            "The catalogue reactors were checked with M1 and M4a and do not reach the target "
            "or a voltage limit. See the confirmation row.",
            confirmed=conf.point,
            **common,
        )
    return result(
        "FOUND",
        "Catalogue reactors found and confirmed with M1 and M4a (advice only). Apply them and "
        "run small-signal stability again.",
        confirmed=conf.point,
        **common,
    )
