"""CB analysis: stage-1 checks and the app-side computation (ADR-014, D-102; guideline §5.2, §5.3).

Called by the pipeline in place of the execution guard; never calls the Engine Port.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from mgapp.domain.contract import AnalysisResult, RunRecordRef, ValidationIssue, Warning
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import IssueCode, IssueLevel, Status, StatusCode, WarningCode
from mgapp.services.cable_sizing.method import (
    CableSizingSettings,
    SizingElement,
    inverter_rated_current_a,
)
from mgapp.services.cable_sizing.registry import SizingMethod, get_method
from mgapp.services.cable_sizing.tables import load_tables, table_set_hash

CAVEAT_TEXT = (  # fixed text, guideline §0
    "Grid-forming inverters limit their fault current. A breaker sized here for overload may "
    "not trip on a fault in islanded operation. Fault protection is not assessed by this tool."
)
EXPERIMENTAL_TEXT = (
    "Experimental: cable and overload-protection sizing awaits supervisor approval "
    "(protection is out of the thesis scope)."
)


def _loc(prefix: str, err: Any) -> str:
    return ".".join([prefix, *(str(x) for x in err["loc"])])


def parameter_issues(p: dict[str, Any]) -> list[ValidationIssue]:
    """Stage-1 issues of the CB parameters (D-102 K281); empty list = valid."""
    out: list[ValidationIssue] = []

    def add(code: IssueCode, field: str, message: str) -> None:
        out.append(
            ValidationIssue(
                code=code,
                level=IssueLevel.REQUEST,
                entity="parameters",
                field=field,
                message=message,
            )
        )

    method: SizingMethod | None = None
    try:
        method = get_method(p.get("method_id"))  # type: ignore[arg-type]
    except (KeyError, TypeError):
        add(IssueCode.CABLE_SETTINGS_INVALID, "method_id", "Choose a known sizing method.")
    settings: CableSizingSettings | None = None
    try:
        settings = CableSizingSettings.model_validate(p.get("settings"))
    except ValidationError as exc:
        for err in exc.errors():
            add(
                IssueCode.CABLE_SETTINGS_INVALID,
                _loc("settings", err),
                f"Check the cable sizing settings: {err['msg']}.",
            )
    if settings is not None:
        for eid in settings.per_element_overrides:
            try:
                settings.for_element(eid)
            except ValidationError as exc:
                add(
                    IssueCode.CABLE_SETTINGS_INVALID,
                    f"settings.per_element_overrides.{eid}",
                    f"Check the settings override of {eid}: {exc.errors()[0]['msg']}.",
                )
    tables = None
    try:
        tables = load_tables(p.get("tables"))
    except ValidationError as exc:
        for err in exc.errors():
            add(
                IssueCode.CABLE_TABLES_INCOMPLETE,
                _loc("tables", err),
                f"The table file is not complete: {err['msg']}.",
            )
    if method is not None and settings is not None and tables is not None and not out:
        for issue in method.validate(settings, tables):
            add(IssueCode(issue.code.value), "tables", issue.message)
    return out


def compute(snapshot: ProjectSnapshot, p: dict[str, Any], m2: RunRecordRef) -> AnalysisResult:
    """Size every Line (I_B from M2) and Inverter feeder (I_B from rated_kva, D2); D-102 K284."""
    method = get_method(p["method_id"])
    settings = CableSizingSettings.model_validate(p["settings"])
    tables = load_tables(p["tables"])
    v_kv = snapshot.nominal_voltage_kv
    if v_kv is None or any(inv.rated_kva is None for inv in snapshot.inverters):
        raise ValueError("nominal voltage or inverter rating missing")  # stage 1 requires them
    payload_m2 = m2.result_payload or {}
    ib = {r["line_id"]: r["required_current_a"] for r in payload_m2["sizing_check"]["per_line"]}
    elements = [
        SizingElement(
            element_id=ln.id,
            element_kind="LINE",
            ib_a=ib[ln.id],
            ib_source="M2.sizing_check.per_line",
            r_line_ohm_per_km=ln.r_ohm_per_km,
        )
        for ln in snapshot.lines
    ] + [
        SizingElement(
            element_id=inv.id,
            element_kind="INVERTER_FEEDER",
            ib_a=inverter_rated_current_a(inv.rated_kva or 0.0, v_kv),
            ib_source="inverter_rated_current",
        )
        for inv in snapshot.inverters
    ]
    sized = method.size(elements, settings, tables)
    warnings = [Warning(code=WarningCode.FEATURE_EXPERIMENTAL, message=EXPERIMENTAL_TEXT)] + [
        Warning(
            code=WarningCode.LINE_R_MISMATCH,
            message=f"Line {e.element_id}: the entered resistance differs from the selected "
            "cable by more than 10 %. Check the line data.",
            path=f"payload.elements[{i}].r_check",
        )
        for i, e in enumerate(sized)
        if "LINE_R_MISMATCH" in e.warnings
    ]
    return AnalysisResult(
        status=Status.FEASIBLE,
        status_code=StatusCode.OK,
        message="Cable and breaker sizing completed (advice only, overload only). "
        "Check each element's outcome.",
        payload={
            "elements": [e.model_dump(mode="json", by_alias=True) for e in sized],
            "method_id": method.method_id,
            "table_set_id": tables.table_set_id,
            "table_set_hash": table_set_hash(p["tables"]),
            "caveat_text": CAVEAT_TEXT,
        },
        warnings=warnings,
        diagnostics={"computed_by": "app"},
    )
