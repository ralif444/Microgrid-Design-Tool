"""Analysis type BA (ADR-015; Doc 12 FR-116): stage-1 rules of the parameters and the result.

Power part (B2) from the depends_on M1 payload; autonomy part (B3) from up to 24 hour M1 calls
through `run_m1`, the execution guard (ADR-015 Q1 – Q3; D-110).
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pydantic import TypeAdapter, ValidationError

from mgapp.domain.battery import BatteryBank
from mgapp.domain.contract import (
    AnalysisResult,
    EngineIdentity,
    RunRecordRef,
    ValidationIssue,
    Warning,
)
from mgapp.domain.entities import ProjectSnapshot
from mgapp.domain.enums import EngineKind, IssueCode, IssueLevel, Status, StatusCode, WarningCode
from mgapp.services.battery.autonomy import Walk, autonomy, hour_walk, lambdas
from mgapp.services.battery.banks import bank_issues
from mgapp.services.battery.power import power_part
from mgapp.services.guard import FAKE_WARNING, GuardedOutcome

CAVEAT_TEXT = (
    "Discharge only: recharging is not modelled. The battery is not part of the network model "
    "(assumption A2). These results are advice and do not change the feasibility verdict."
)
_BANKS = TypeAdapter(list[BatteryBank])


def _issue(field: str, message: str) -> ValidationIssue:
    return ValidationIssue(
        code=IssueCode.BATTERY_BANK_INVALID,
        level=IssueLevel.REQUEST,
        entity="parameters",
        field=field,
        message=message,
    )


def parameter_issues(p: dict[str, Any], s: ProjectSnapshot) -> list[ValidationIssue]:
    """BA parameters {banks, start_hour} (D-109); empty list = valid."""
    out: list[ValidationIssue] = []
    h = p.get("start_hour")
    if not (isinstance(h, int) and not isinstance(h, bool) and 0 <= h <= 23):
        out.append(_issue("start_hour", "Enter a start hour from 0 to 23."))
    try:
        banks = _BANKS.validate_python(p.get("banks"))
    except ValidationError as exc:
        return out + [
            _issue(
                "banks" + "".join(f"[{x}]" if isinstance(x, int) else f".{x}" for x in e["loc"]),
                f"Check the battery bank: {e['msg']}.",
            )
            for e in exc.errors()
        ]
    if not banks:
        return out + [_issue("banks", "Attach a battery bank to an inverter first.")]
    return out + bank_issues(banks, (i.id for i in s.inverters), prefix="banks")


def compute(
    snapshot: ProjectSnapshot,
    p: dict[str, Any],
    m1: RunRecordRef,
    run_m1: Callable[[ProjectSnapshot], GuardedOutcome],
    budget_s: float,
) -> tuple[AnalysisResult, EngineIdentity | None]:
    banks = _BANKS.validate_python(p["banks"])
    start = int(p["start_hour"])
    rows = power_part(banks, m1.result_payload or {})
    lam, reason_all = lambdas(snapshot)
    w = hour_walk(snapshot, lam, start, run_m1, budget_s) if lam is not None else Walk()
    diag = {"computed_by": "app", "engine_calls": w.calls}
    fake = [FAKE_WARNING] if w.identity and w.identity.engine_kind is EngineKind.FAKE else []
    ident = w.identity if w.calls else None  # Q1
    if w.timed_out:  # Q2, D-110 K324
        return AnalysisResult(
            status=Status.UNAVAILABLE,
            status_code=StatusCode.TIMEOUT,
            message=f"The battery check took longer than the time budget of {budget_s:g} s over "
            f"{w.calls} hourly power flow runs and was stopped. Run again.",
            payload=None,
            warnings=fake,
            diagnostics=diag,
        ), ident
    for r, b in zip(rows, banks, strict=True):
        r["autonomy"] = autonomy(b, start, w.powers, w.failed, reason_all)
    warnings = [
        Warning(
            code=WarningCode.BATTERY_POWER_SHORT,
            message=f"The battery bank of {r['inverter_id']} cannot deliver the inverter's power "
            "(advice only).",
            path=f"payload.banks[{k}].power",
        )
        for k, r in enumerate(rows)
        if r["power"]["outcome"] == "SHORT"
    ]
    if lam is not None and max(lam) > 1:
        warnings.append(
            Warning(
                code=WarningCode.PROFILE_PEAK_ABOVE_LOADS,
                message="The LoadProfile peak is above the sum of the Load table; some hours "
                "scale the loads above their table values (Eq. 12.9).",
                path="payload.hours",
            )
        )
    return AnalysisResult(
        status=Status.FEASIBLE,
        status_code=StatusCode.OK,
        message="Battery adequacy check completed (advice only, discharge only). "
        "Check each bank's outcome.",
        payload={"banks": rows, "hours": w.hours, "caveat_text": CAVEAT_TEXT},
        warnings=warnings + fake,
        diagnostics=diag,
    ), ident
