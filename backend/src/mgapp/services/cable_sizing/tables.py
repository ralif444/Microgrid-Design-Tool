"""`cable_tables.json`: schema, loader, validator and table_set_hash (guideline §4).

The app ships no table values; the user transcribes them. Tests use a fictitious fixture.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal

from pydantic import Field

from mgapp.domain.base import Model
from mgapp.services.canonical import sha256_hex

Conductor = Literal["CU", "AL"]
Insulation = Literal["PVC", "XLPE"]
Method = Literal["B1", "A1", "C", "D_DUCT"]  # guideline §2.2, D9


class TableIssueCode(StrEnum):
    """Stage-1 codes of guideline §4 (to be merged into Doc 3 IssueCode at stage 1.5)."""

    CABLE_TABLES_INCOMPLETE = "CABLE_TABLES_INCOMPLETE"
    CABLE_TABLES_UNCHECKED = "CABLE_TABLES_UNCHECKED"


class TableIssue(Model):
    code: TableIssueCode
    message: str


class TableSource(Model):
    document: str
    edition: str
    entered_by: str
    entered_on: str
    double_entry_checked: bool


class AmpacityTable(Model):
    table: str
    page: str
    insulation: Insulation
    loaded_conductors: Literal[3]  # balanced three-phase, A6 (guideline §2.2)
    conductor: Conductor
    method: Method
    values_a: dict[str, float | None]  # null = blank cell, a gap, never 0 (§3.2)


class DeviceClass(Model):
    class_: Literal["MCB", "MCCB"] = Field(alias="class")
    standard: str
    k2: float = Field(gt=0)
    k2_source: str
    in_series_a: list[float]
    in_series_source: str
    max_in_a: float | None = None


class CableTables(Model):
    schema_version: Literal[1]
    table_set_id: str
    source: TableSource
    sizes_mm2: dict[Conductor, list[float]]
    # shortcut: factor tables kept as plain JSON until the method (slice 2) reads them.
    r20_ohm_per_km: dict[str, Any]
    ampacity: list[AmpacityTable]
    k_theta_air: dict[str, Any]
    k_theta_ground: dict[str, Any]
    k_rho: dict[str, Any]
    k_group: dict[str, Any]
    device_classes: list[DeviceClass]


def load_tables(raw: Any) -> CableTables:
    """Parse a decoded table file; raises pydantic.ValidationError when malformed."""
    return CableTables.model_validate(raw)


def validate_tables(tables: CableTables, method: Method) -> list[TableIssue]:
    """Completeness and double-entry checks for one installation method (guideline §4 rules)."""
    issues = [
        TableIssue(
            code=TableIssueCode.CABLE_TABLES_INCOMPLETE,
            message=f"Device class {d.class_} has an empty rated-current series (in_series_a).",
        )
        for d in tables.device_classes
        if not d.in_series_a
    ]
    if not any(t.method == method for t in tables.ampacity):
        issues.append(
            TableIssue(
                code=TableIssueCode.CABLE_TABLES_INCOMPLETE,
                message=f"No ampacity table for installation method {method}.",
            )
        )
    if not tables.source.double_entry_checked:
        issues.append(
            TableIssue(
                code=TableIssueCode.CABLE_TABLES_UNCHECKED,
                message="The table file is not double-entry checked (double_entry_checked).",
            )
        )
    return issues


def table_set_hash(raw: Any) -> str:
    """SHA-256 of the canonical table file (Doc 3 §7 rules), lowercase hex."""
    return sha256_hex(raw)
