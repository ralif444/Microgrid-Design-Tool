"""Request validation service, stage 1 (component 5; Doc 3 §4).

Runs before any engine call and collects **all** issues (FR-20). No physics judgements
(FR-21). Size limits are a separate step (services.limits).
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any, TypeGuard

from pydantic import ValidationError

from mgapp.domain.base import FiniteJson, Model
from mgapp.domain.battery import BatteryBank
from mgapp.domain.contract import ScenarioSnapshot, ValidationIssue
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import M4_POINT_METRICS, AnalysisType, IssueCode, IssueLevel
from mgapp.domain.profile import HOUR_AXIS, table_total_kw
from mgapp.services.battery import bank_issues
from mgapp.services.battery.service import parameter_issues as battery_parameter_issues
from mgapp.services.cable_sizing.service import parameter_issues as cable_parameter_issues
from mgapp.services.canonical import (
    normalise_raw,
    normalise_snapshot,
    safe_sha256_hex,
    sha256_hex,
)

ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,32}$")

MESSAGES: dict[IssueCode, str] = {
    IssueCode.NEGATIVE_POWER: "Power cannot be negative. Enter 0 or more.",
    IssueCode.EMPTY_REQUIRED: "This field is required.",
    IssueCode.NOT_POSITIVE: "This value must be greater than 0.",
    IssueCode.PF_OUT_OF_RANGE: "Power factor must be above 0 and at most 1.",
    IssueCode.PF_DIRECTION_MISSING: "Choose lagging or leading.",
    IssueCode.LOAD_Q_AMBIGUOUS: "Enter either reactive power or power factor.",
    IssueCode.BAND_INVERTED: "The lower limit must be below the upper limit.",
    IssueCode.LOADING_LIMIT_RANGE: "Loading limit must be above 0 and at most 1.",
    IssueCode.DUPLICATE_ID: "This id is already used.",
    IssueCode.ID_FORMAT: "Use letters, digits, underscore and hyphen (max 32).",
    IssueCode.DANGLING_BUS_REF: "This item points to a bus that does not exist.",
    IssueCode.SELF_LOOP_LINE: "A line must connect two different buses.",
    IssueCode.DUPLICATE_LINE: "There is already a line between these buses.",
    IssueCode.ISOLATED_BUS: "This bus is not connected.",
    IssueCode.DISCONNECTED_NETWORK: "The network is split into separate parts.",
    IssueCode.NO_INVERTER: "Add at least one inverter.",
    IssueCode.NO_LOAD: "Add at least one load.",
    IssueCode.PROFILE_LENGTH: "A daily profile needs 24 hourly values, hours 0–23 once each.",
    IssueCode.PROFILE_HOUR: "A daily profile needs 24 hourly values, hours 0–23 once each.",
    IssueCode.PS_PARAMETER_INVALID: "Check the sizing-advice settings.",
    IssueCode.SIZING_MARGIN_INVALID: "Enter the design margins (0 or more).",
    IssueCode.TAU_MISSING_FOR_M4: "Enter the power-filter time constants for every inverter.",
    IssueCode.SENSITIVITY_STEP_INVALID: "Give one step size: relative or absolute.",
    IssueCode.DISTURBANCE_INVALID: "Complete the disturbance definition.",
    IssueCode.MULTIPLE_INVERTERS_ON_BUS: "Stability analysis allows at most one inverter per bus.",
    IssueCode.SWEEP_RANGE_INVALID: "The sweep range or step count is not valid.",
    IssueCode.SCENARIO_PATH_INVALID: "This scenario changes something that does not exist.",
    IssueCode.SCENARIO_COUNT_INVALID: "Compare between 2 and the allowed number of scenarios.",
    IssueCode.DEPENDS_ON_NOT_ALLOWED: "This analysis does not use an earlier result.",
    IssueCode.MALFORMED_REQUEST: "The request could not be read.",
    IssueCode.CABLE_TABLES_INCOMPLETE: "The cable table file is not complete.",
    IssueCode.CABLE_TABLES_UNCHECKED: "The cable table file is not double-entry checked.",
    IssueCode.CABLE_SETTINGS_INVALID: "Check the cable sizing settings.",
    IssueCode.BATTERY_BANK_INVALID: "Check the battery bank.",
}

DISTURBANCE_KINDS = frozenset({"LOAD_STEP", "LOAD_SCALING", "REFERENCE_STEP", "INVERTER_OUTAGE"})
REFERENCES = frozenset({"P_SETPOINT", "Q_SETPOINT", "V_SETPOINT", "F_SETPOINT"})
SETTLING_FIELDS = ("frequency_band_hz", "voltage_band_kv", "window_s")
COLLECTIONS = {"buses", "lines", "loads", "inverters"}


class _Collector:
    def __init__(self) -> None:
        self.issues: list[ValidationIssue] = []

    def add(
        self,
        code: IssueCode,
        level: IssueLevel,
        entity: str | None = None,
        id_: str | None = None,
        field: str | None = None,
    ) -> None:
        self.issues.append(
            ValidationIssue(
                code=code, level=level, entity=entity, id=id_, field=field, message=MESSAGES[code]
            )
        )

    def required(self, entity: str, id_: str | None, obj: Any, fields: Iterable[str]) -> None:
        for f in fields:
            v = getattr(obj, f)
            if v is None or (isinstance(v, str) and not v.strip()):
                self.add(IssueCode.EMPTY_REQUIRED, IssueLevel.FIELD, entity, id_, f)

    def positive(self, entity: str, id_: str | None, obj: Any, fields: Iterable[str]) -> None:
        for f in fields:
            v = getattr(obj, f)
            if v is not None and v <= 0:
                self.add(IssueCode.NOT_POSITIVE, IssueLevel.FIELD, entity, id_, f)


def _ids(c: _Collector, entity: str, items: list[Any]) -> set[str]:
    seen: set[str] = set()
    for it in items:
        if it.id is None or not str(it.id).strip():
            c.add(IssueCode.EMPTY_REQUIRED, IssueLevel.FIELD, entity, None, "id")
            continue
        if not ID_PATTERN.match(it.id):
            c.add(IssueCode.ID_FORMAT, IssueLevel.FIELD, entity, it.id, "id")
        if it.id in seen:
            c.add(IssueCode.DUPLICATE_ID, IssueLevel.ENTITY, entity, it.id, "id")
        seen.add(it.id)
    return seen


def _entities(c: _Collector, s: ProjectSnapshot) -> set[str]:
    c.required("Project", None, s, ["nominal_voltage_kv", "nominal_frequency_hz"])
    c.positive("Project", None, s, ["nominal_voltage_kv", "nominal_frequency_hz"])

    bus_ids = _ids(c, "Bus", s.buses)
    _ids(c, "Line", s.lines)
    _ids(c, "Load", s.loads)
    _ids(c, "Inverter", s.inverters)

    for ln in s.lines:
        c.required(
            "Line",
            ln.id,
            ln,
            ["from_bus_id", "to_bus_id", "r_ohm_per_km", "x_ohm_per_km", "length_km"],
        )
        c.positive(
            "Line", ln.id, ln, ["r_ohm_per_km", "x_ohm_per_km", "length_km", "current_limit_a"]
        )
        for f in ("from_bus_id", "to_bus_id"):
            ref = getattr(ln, f)
            if ref is not None and ref not in bus_ids:
                c.add(IssueCode.DANGLING_BUS_REF, IssueLevel.ENTITY, "Line", ln.id, f)
        if ln.from_bus_id is not None and ln.from_bus_id == ln.to_bus_id:
            c.add(IssueCode.SELF_LOOP_LINE, IssueLevel.ENTITY, "Line", ln.id)

    for ld in s.loads:
        c.required("Load", ld.id, ld, ["bus_id", "p_kw"])
        if ld.bus_id is not None and ld.bus_id not in bus_ids:
            c.add(IssueCode.DANGLING_BUS_REF, IssueLevel.ENTITY, "Load", ld.id, "bus_id")
        for f in ("p_kw", "q_kvar"):
            v = getattr(ld, f)
            if v is not None and v < 0:
                c.add(IssueCode.NEGATIVE_POWER, IssueLevel.FIELD, "Load", ld.id, f)
        has_q, has_pf = ld.q_kvar is not None, ld.power_factor is not None
        if has_q == has_pf:
            c.add(IssueCode.LOAD_Q_AMBIGUOUS, IssueLevel.ENTITY, "Load", ld.id)
        if ld.power_factor is not None:
            if not 0 < ld.power_factor <= 1:
                c.add(IssueCode.PF_OUT_OF_RANGE, IssueLevel.FIELD, "Load", ld.id, "power_factor")
            if ld.pf_direction is None:
                c.add(
                    IssueCode.PF_DIRECTION_MISSING, IssueLevel.FIELD, "Load", ld.id, "pf_direction"
                )

    if s.load_profile is not None:
        lp = s.load_profile
        if lp.id is None:
            c.add(IssueCode.EMPTY_REQUIRED, IssueLevel.FIELD, "LoadProfile", None, "id")
        elif not ID_PATTERN.match(lp.id):
            c.add(IssueCode.ID_FORMAT, IssueLevel.FIELD, "LoadProfile", lp.id, "id")
        values = lp.values or []
        if len(values) != 24:
            c.add(IssueCode.PROFILE_LENGTH, IssueLevel.ENTITY, "LoadProfile", lp.id, "values")
        hours = [v.hour for v in values]
        if sorted(h for h in hours if h is not None) != list(range(24)) and len(values) == 24:
            c.add(IssueCode.PROFILE_HOUR, IssueLevel.ENTITY, "LoadProfile", lp.id, "values")
        for v in values:
            if v.p_kw is None:
                c.add(
                    IssueCode.EMPTY_REQUIRED, IssueLevel.FIELD, "LoadProfile", lp.id, "values.p_kw"
                )
            elif v.p_kw < 0:
                c.add(
                    IssueCode.NEGATIVE_POWER, IssueLevel.FIELD, "LoadProfile", lp.id, "values.p_kw"
                )

    for inv in s.inverters:
        req = [
            "bus_id",
            "rated_kva",
            "frequency_droop_hz_per_kw",
            "voltage_droop_kv_per_kvar",
            "frequency_setpoint_hz",
            "voltage_setpoint_kv",
        ]
        c.required("Inverter", inv.id, inv, req)
        c.positive("Inverter", inv.id, inv, [*req[1:], "tau_p_s", "tau_q_s"])
        if inv.bus_id is not None and inv.bus_id not in bus_ids:
            c.add(IssueCode.DANGLING_BUS_REF, IssueLevel.ENTITY, "Inverter", inv.id, "bus_id")

    dc = s.design_constraints
    c.positive(
        "DesignConstraints",
        None,
        dc,
        [
            "voltage_min_pu",
            "voltage_max_pu",
            "frequency_min_hz",
            "frequency_max_hz",
            "line_current_limit_a",
            "balance_tolerance_kw",
        ],
    )
    for lo, hi in (("voltage_min_pu", "voltage_max_pu"), ("frequency_min_hz", "frequency_max_hz")):
        a, b = getattr(dc, lo), getattr(dc, hi)
        if a is not None and b is not None and a >= b:
            c.add(IssueCode.BAND_INVERTED, IssueLevel.ENTITY, "DesignConstraints", None, lo)
    mu = dc.inverter_loading_limit_ratio
    if mu is not None and not 0 < mu <= 1:
        c.add(
            IssueCode.LOADING_LIMIT_RANGE,
            IssueLevel.FIELD,
            "DesignConstraints",
            None,
            "inverter_loading_limit_ratio",
        )
    return bus_ids


def _topology(c: _Collector, s: ProjectSnapshot, bus_ids: set[str]) -> None:
    pairs: set[frozenset[str]] = set()
    adj: dict[str, set[str]] = {b: set() for b in bus_ids}
    for ln in s.lines:
        a, b = ln.from_bus_id, ln.to_bus_id
        if a is None or b is None or a == b or a not in bus_ids or b not in bus_ids:
            continue
        pair = frozenset((a, b))
        if pair in pairs:
            c.add(IssueCode.DUPLICATE_LINE, IssueLevel.TOPOLOGY, "Line", ln.id)
        pairs.add(pair)
        adj[a].add(b)
        adj[b].add(a)
    if len(bus_ids) > 1:
        isolated = sorted(b for b, n in adj.items() if not n)
        for b in isolated:
            c.add(IssueCode.ISOLATED_BUS, IssueLevel.TOPOLOGY, "Bus", b)
        rest = [b for b in sorted(adj) if adj[b]]
        if rest:
            seen, stack = {rest[0]}, [rest[0]]
            while stack:
                for n in adj[stack.pop()]:
                    if n not in seen:
                        seen.add(n)
                        stack.append(n)
            if len(seen) < len(rest):
                c.add(IssueCode.DISCONNECTED_NETWORK, IssueLevel.TOPOLOGY)
    if not s.inverters:
        c.add(IssueCode.NO_INVERTER, IssueLevel.TOPOLOGY)


def _is_int(v: object) -> TypeGuard[int]:
    return isinstance(v, int) and not isinstance(v, bool)


def _is_num(v: object) -> TypeGuard[float]:
    return isinstance(v, int | float) and not isinstance(v, bool)


def _ratio_ok(v: Any) -> bool:
    return v is None or (_is_num(v) and 0 < v <= 1)


def _path_ok(s: ProjectSnapshot, path: Any) -> bool:
    if not isinstance(path, str) or path.count("/") != 2:
        return False
    coll, id_, field = path.split("/")
    if coll not in COLLECTIONS:
        return False
    for item in getattr(s, coll):
        if item.id == id_:
            return (
                field in type(item).model_fields
                and field not in {"id", "name"}
                and (_is_num(getattr(item, field)) or getattr(item, field) is None)
            )
    return False


def _axis_ok(s: ProjectSnapshot, axis: Any, hour_ok: bool = False) -> bool:
    if not isinstance(axis, dict):
        return False
    lo, hi, n = axis.get("range_min"), axis.get("range_max"), axis.get("step_count")
    if not (_is_num(lo) and _is_num(hi) and _is_int(n)) or lo >= hi or n < 2:
        return False
    kind = axis.get("kind")
    if kind == HOUR_AXIS:  # M3b only, fixed grid 0 … 23 (D-113 K333); λ needs table power (K334)
        return hour_ok and (lo, hi, n) == (0, 23, 24) and table_total_kw(s) > 0
    if kind == "PARAMETER":
        return _path_ok(s, axis.get("parameter_path"))
    if kind == "SCALE_FACTOR":
        es, field = axis.get("element_set"), axis.get("field")
        return (
            isinstance(es, list)
            and bool(es)
            and isinstance(field, str)
            and all(_path_ok(s, f"{p}/{field}") for p in es)
        )
    return kind == "LOAD_SCALE"


def _parameters(
    c: _Collector, t: AnalysisType, p: dict[str, Any], s: ProjectSnapshot, scen_count: int
) -> None:
    def bad(code: IssueCode, field: str | None = None) -> None:
        c.add(code, IssueLevel.REQUEST, "parameters", None, field)

    if t is AnalysisType.PS:
        m, n, r, h = (
            p.get(k) for k in ("inverter_margin_ratio", "unit_count", "redundancy", "autonomy_h")
        )
        ok = (
            _is_num(m)
            and m >= 0
            and _is_int(n)
            and n >= 1
            and r in (0, 1)
            and _is_int(r)
            and not (r == 1 and n == 1)
            and (h is None or (_is_int(h) and 1 <= h <= 24))
            and _ratio_ok(p.get("dc_efficiency_ratio"))
            and _ratio_ok(p.get("depth_of_discharge_ratio"))
        )
        if not ok:
            bad(IssueCode.PS_PARAMETER_INVALID)
    elif t is AnalysisType.CB:
        c.issues += cable_parameter_issues(p)
    elif t is AnalysisType.BA:
        c.issues += battery_parameter_issues(p, s)
    elif t is AnalysisType.M2:
        mi, ml, h = p.get("inverter_margin_ratio"), p.get("line_margin_ratio"), p.get("autonomy_h")
        if not (_is_num(mi) and mi >= 0 and _is_num(ml) and ml >= 0):
            bad(IssueCode.SIZING_MARGIN_INVALID)
        if not (
            (h is None or (_is_int(h) and 1 <= h <= 24))
            and _ratio_ok(p.get("dc_efficiency_ratio"))
            and _ratio_ok(p.get("depth_of_discharge_ratio"))
        ):
            bad(IssueCode.SIZING_MARGIN_INVALID)
    elif t is AnalysisType.M3A:
        rel, ab = p.get("step_relative"), p.get("step_absolute")
        step = rel if rel is not None else ab
        if (rel is None) == (ab is None) or not _is_num(step) or step <= 0:
            bad(IssueCode.SENSITIVITY_STEP_INVALID)
        for path in p.get("parameter_paths") or [None]:
            if not _path_ok(s, path):
                bad(IssueCode.SCENARIO_PATH_INVALID, "parameter_paths")
    elif t is AnalysisType.M3B:
        axis = p.get("axis")
        hour = isinstance(axis, dict) and axis.get("kind") == HOUR_AXIS
        if hour and s.load_profile is None:
            bad(IssueCode.PROFILE_LENGTH, "load_profile")  # FR-78 names the profile (K334)
        elif not _axis_ok(s, axis, hour_ok=True):
            bad(IssueCode.SWEEP_RANGE_INVALID, "axis")
    elif t is AnalysisType.M3D:
        for ax in ("axis_x", "axis_y"):
            if not _axis_ok(s, p.get(ax)):
                bad(IssueCode.SWEEP_RANGE_INVALID, ax)
    elif t is AnalysisType.M3C:
        if scen_count < 2:
            bad(IssueCode.SCENARIO_COUNT_INVALID)
    elif t is AnalysisType.M4B:
        d = p.get("disturbance")
        end = p.get("simulation_end_s")
        ok = isinstance(d, dict) and d.get("kind") in DISTURBANCE_KINDS
        if ok and isinstance(d, dict):
            start = d.get("start_time_s")
            ok = _is_num(start) and start >= 0 and _is_num(end) and end > start
            kind, el = d.get("kind"), d.get("element_id")
            loads = {x.id for x in s.loads}
            invs = {x.id for x in s.inverters}
            if kind == "LOAD_STEP":
                ok = ok and el in loads and _is_num(d.get("magnitude"))
            elif kind == "LOAD_SCALING":
                ok = (
                    ok
                    and (el in loads or el == "ALL")
                    and _is_num(d.get("magnitude"))
                    and d["magnitude"] > 0
                )
            elif kind == "REFERENCE_STEP":
                ok = (
                    ok
                    and el in invs
                    and d.get("reference") in REFERENCES
                    and _is_num(d.get("magnitude"))
                )
            elif kind == "INVERTER_OUTAGE":
                ok = ok and el in invs and d.get("duration_s") is None
            dur = d.get("duration_s")
            ok = ok and (dur is None or (_is_num(dur) and dur > 0))
        st = p.get("settling")  # optional, no defaults (D-53 K67, D-55 K90)
        if st is not None and not (
            isinstance(st, dict) and all(_is_num(st.get(k)) and st[k] > 0 for k in SETTLING_FIELDS)
        ):
            ok = False
        if not ok:
            bad(IssueCode.DISTURBANCE_INVALID, "disturbance")


def _needs_tau(t: AnalysisType, p: dict[str, Any]) -> bool:
    if t in (AnalysisType.M4A, AnalysisType.M4B):
        return True
    if t in (AnalysisType.M3B, AnalysisType.M3D):
        return bool(M4_POINT_METRICS & set(p.get("point_metrics") or []))
    return False


def validate_request(
    t: AnalysisType,
    snapshot: ProjectSnapshot,
    parameters: dict[str, Any],
    has_depends_on: bool,
    scenarios: list[ScenarioSnapshot] | None,
) -> list[ValidationIssue]:
    """All stage-1 issues for one analysis request (empty list = valid)."""
    c = _Collector()
    bus_ids = _entities(c, snapshot)
    if not snapshot.loads:
        c.add(IssueCode.NO_LOAD, IssueLevel.TOPOLOGY)
    if t is not AnalysisType.PS:
        _topology(c, snapshot, bus_ids)
    if _needs_tau(t, parameters):
        for inv in snapshot.inverters:
            if inv.tau_p_s is None or inv.tau_q_s is None:
                c.add(IssueCode.TAU_MISSING_FOR_M4, IssueLevel.ENTITY, "Inverter", inv.id)
    if has_depends_on and t in (AnalysisType.PS, AnalysisType.M1):
        c.add(IssueCode.DEPENDS_ON_NOT_ALLOWED, IssueLevel.REQUEST, None, None, "depends_on")
    _parameters(c, t, parameters, snapshot, len(scenarios or []))
    for sc in scenarios or []:
        found = validate_request(AnalysisType.M1, sc.project_snapshot, {}, False, None)
        for issue in found + _scenario_elements(snapshot, sc.project_snapshot):
            c.issues.append(
                issue.model_copy(update={"entity": f"Scenario {sc.scenario_id}: {issue.entity}"})
            )
    return c.issues


def _scenario_elements(base: ProjectSnapshot, scen: ProjectSnapshot) -> list[ValidationIssue]:
    """An M3c scenario holds exactly the base lines (D-112): the engine applies the base per-line
    current limits to every scenario. Loads and inverters may differ (N−1 removes one, FR-80)."""
    c = _Collector()
    for id_ in sorted(
        {ln.id for ln in base.lines if ln.id} ^ {ln.id for ln in scen.lines if ln.id}
    ):
        c.add(IssueCode.SCENARIO_PATH_INVALID, IssueLevel.ENTITY, "Line", id_)
    return c.issues


class ValidateRequest(Model):
    """Body of POST /api/projects/validate (Doc 6 §3.4)."""

    project_snapshot: ProjectSnapshot
    target_analysis_type: AnalysisType | None = None  # null = M1 rules
    parameters: FiniteJson | None = None  # null = no request-level checks
    # Outside the snapshot (D-106 K304); null = not checked, so the report is as before (D-108).
    battery_banks: list[BatteryBank] | None = None


class ValidationReport(Model):
    """Stage-1 result for live feedback; no RunRecord, no Status (Doc 6 §3.4)."""

    valid: bool
    issues: list[ValidationIssue]
    snapshot_hash: str  # same canonical hash as RunRecord.snapshot_hash, for the stale-M1 flag


def validate_raw(raw: Any) -> ValidationReport:
    """Stage-1 validation without an engine call; a body off the schema is reported, not raised."""
    try:
        req = ValidateRequest.model_validate(raw)
    except ValidationError:
        snap = normalise_raw(raw.get("project_snapshot") if isinstance(raw, dict) else None)
        issue = ValidationIssue(
            code=IssueCode.MALFORMED_REQUEST,
            level=IssueLevel.REQUEST,
            message=MESSAGES[IssueCode.MALFORMED_REQUEST],
        )
        return ValidationReport(valid=False, issues=[issue], snapshot_hash=safe_sha256_hex(snap))
    t = req.target_analysis_type or AnalysisType.M1
    issues = validate_request(t, req.project_snapshot, req.parameters or {}, False, None)
    if req.parameters is None:
        issues = [i for i in issues if i.level is not IssueLevel.REQUEST]
    if req.battery_banks is not None:
        issues += bank_issues(req.battery_banks, (i.id for i in req.project_snapshot.inverters))
    return ValidationReport(
        valid=not issues,
        issues=issues,
        snapshot_hash=sha256_hex(normalise_snapshot(req.project_snapshot)),
    )
