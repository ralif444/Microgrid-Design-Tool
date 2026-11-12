"""Project file service (component 12; Doc 3 §8, Doc 6 §3.6, ADR-010).

Checks `schema_version` first, then the document shape, then each embedded RunRecord (bad
ones are listed and skipped, Doc 9 D-47 K16), then runs stage-1 validation. The server
stores nothing; the accepted document is returned unchanged except for skipped records.
No migration chain exists yet (v1 is the only version; FR-56 is Should).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import ValidationError

from mgapp.domain.base import Model
from mgapp.domain.battery import BatteryBank
from mgapp.domain.entities import Bus, DesignConstraints, Inverter, Line, Load, LoadProfile
from mgapp.domain.meta import PROJECT_SCHEMA_VERSION
from mgapp.services.file_check import (
    FileCheckCode,
    FileCheckDetail,
    FileCheckResult,
    check_record,
    check_version,
    refused,
    schema_errors,
)
from mgapp.services.validation import ValidationReport, validate_raw


class ProjectMeta(Model):
    """Doc 3 §3.1 (nominal values live here in the file, D-47 K14)."""

    id: str
    name: str
    description: str | None = None
    created_at: str
    modified_at: str
    nominal_voltage_kv: float | None = None
    nominal_frequency_hz: float | None = None


class SizingAdviceItem(Model):
    """Doc 3 §3.8."""

    id: str
    created_at: str
    input_hash: str
    ps_parameters: dict[str, Any]
    state: Literal["PROPOSED", "ACCEPTED", "EDITED", "SKIPPED"]
    result: dict[str, Any]
    edited_values: dict[str, Any] | None = None


class ProjectFile(Model):
    """Doc 3 §8 top-level layout."""

    schema_version: int
    app_version: str
    project: ProjectMeta
    buses: list[Bus]
    lines: list[Line]
    loads: list[Load]
    inverters: list[Inverter]
    load_profile: LoadProfile | None
    design_constraints: DesignConstraints
    sizing_advice: list[SizingAdviceItem]
    scenarios: list[Any]
    run_records: list[Any]  # checked one by one (check_record)
    # Optional, omitted when empty; outside the snapshot (D-106 K304, K306)
    battery_banks: list[BatteryBank] = []


class ImportResponse(Model):
    file_check: FileCheckResult
    project: dict[str, Any] | None
    migrated_from_version: int | None
    validation: ValidationReport | None


def _refused(fc: FileCheckResult) -> ImportResponse:
    return ImportResponse(file_check=fc, project=None, migrated_from_version=None, validation=None)


def import_project(raw: Any) -> ImportResponse:
    if not isinstance(raw, dict):
        return _refused(refused(FileCheckCode.MALFORMED_FILE, "This file is not a Project file."))
    bad = check_version(raw, PROJECT_SCHEMA_VERSION, "Project file")
    if bad:
        return _refused(bad)
    try:
        doc = ProjectFile.model_validate(raw)
    except ValidationError as exc:
        return _refused(
            refused(
                FileCheckCode.MALFORMED_FILE,
                "This file is not a valid Project file.",
                schema_errors(exc),
            )
        )
    kept, details = [], []
    for i, rec in enumerate(raw["run_records"]):
        fc, _ = check_record(rec)
        if fc.accepted:
            kept.append(rec)
        else:
            details.append(
                FileCheckDetail(path=f"run_records[{i}]", code=fc.code, message=fc.message)
            )
    message = "The Project file was opened."
    if details:
        message += f" {len(details)} run record(s) could not be read and were skipped."
    snapshot = {
        "nominal_voltage_kv": doc.project.nominal_voltage_kv,
        "nominal_frequency_hz": doc.project.nominal_frequency_hz,
        **{
            k: raw[k]
            for k in ("buses", "lines", "loads", "inverters", "load_profile", "design_constraints")
        },
    }
    return ImportResponse(
        file_check=FileCheckResult(
            accepted=True, code=FileCheckCode.OK, message=message, details=details
        ),
        project={**raw, "run_records": kept},
        migrated_from_version=None,
        validation=validate_raw(
            {"project_snapshot": snapshot}
            | ({"battery_banks": raw["battery_banks"]} if "battery_banks" in raw else {})
        ),
    )
