"""Catalogue file check and selection guard (Doc 12 §6 endpoint 16; FR-64 - FR-66; D-61).

Version first, then shape, then unique entry ids; a refused file loads nothing. Accepted
files come back unchanged with one EntryCheck per entry: `usable` is the selection guard
(provenance per used value, grid-forming declaration with reference, droop ranges). An
unusable entry is still stored, as information only.
"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from mgapp.domain.base import Model
from mgapp.domain.catalog import CATALOG_SCHEMA_VERSION, Catalog, CatalogEntry
from mgapp.services.file_check import (
    FileCheckCode,
    FileCheckDetail,
    FileCheckResult,
    check_version,
    refused,
    schema_errors,
)

PROVENANCE_FIELDS = ("manufacturer", "model", "document", "revision")
# Values the model uses: required ones, then optional ones that need a source when present.
REQUIRED = {
    "INVERTER": (
        "rated_kva",
        "nominal_voltage_kv",
        "nominal_frequency_hz",
        "frequency_droop_min_hz_per_kw",
        "frequency_droop_max_hz_per_kw",
        "voltage_droop_min_kv_per_kvar",
        "voltage_droop_max_kv_per_kvar",
    ),
    "CONDUCTOR": ("r_ohm_per_km", "x_ohm_per_km"),
    "BREAKER": ("in_a",),
}
OPTIONAL = {"INVERTER": ("tau_in_s",), "CONDUCTOR": ("ampacity_a",), "BREAKER": ()}


class EntryCheck(Model):
    entry_id: str
    usable: bool
    reasons: list[str]


class CatalogImportResponse(Model):
    file_check: FileCheckResult
    catalog: dict[str, Any] | None
    entry_checks: list[EntryCheck]


def entry_reasons(e: CatalogEntry) -> list[str]:
    """Why an entry may not be used in a Project; empty means usable."""
    reasons = [
        f"provenance.{f} is missing" for f in PROVENANCE_FIELDS if not getattr(e.provenance, f)
    ]
    block = {"INVERTER": e.inverter, "CONDUCTOR": e.conductor, "BREAKER": e.breaker}[e.kind]
    if block is None:
        return [*reasons, f"{e.kind.lower()} values are missing"]
    if e.breaker is not None:  # D-104 K296: the match needs the standard and the class
        reasons += [
            f"{f} is missing"
            for f, v in (("standard", e.breaker.standard), ("class", e.breaker.device_class))
            if not v
        ]
    for f in REQUIRED[e.kind]:
        if getattr(block, f) is None:
            reasons.append(f"{f} is missing")
        elif not e.sources.get(f):
            reasons.append(f"sources.{f} (page or section) is missing")
    for f in OPTIONAL[e.kind]:
        if getattr(block, f) is not None and not e.sources.get(f):
            reasons.append(f"sources.{f} (page or section) is missing")
    if e.inverter is not None and not (
        e.inverter.grid_forming and e.inverter.grid_forming_reference
    ):
        reasons.append(
            "not declared grid-forming with a datasheet reference, so it is information only"
        )
    return reasons


def _refused(fc: FileCheckResult) -> CatalogImportResponse:
    return CatalogImportResponse(file_check=fc, catalog=None, entry_checks=[])


def import_catalog(raw: Any) -> CatalogImportResponse:
    if not isinstance(raw, dict):
        return _refused(refused(FileCheckCode.MALFORMED_FILE, "This file is not a Catalogue."))
    bad = check_version(raw, CATALOG_SCHEMA_VERSION, "Catalogue")
    if bad:
        return _refused(bad)
    try:
        doc = Catalog.model_validate(raw)
    except ValidationError as exc:
        return _refused(
            refused(
                FileCheckCode.MALFORMED_FILE,
                "This file is not a valid Catalogue.",
                schema_errors(exc),
            )
        )
    seen: set[str] = set()
    dupes = []
    for i, e in enumerate(doc.entries):
        if e.id in seen:
            dupes.append(
                FileCheckDetail(
                    path=f"entries[{i}].id",
                    code=FileCheckCode.MALFORMED_FILE,
                    message=f"Entry id {e.id!r} is used twice.",
                )
            )
        seen.add(e.id)
    if dupes:
        return _refused(refused(FileCheckCode.MALFORMED_FILE, "Entry ids must be unique.", dupes))
    checks = []
    for e in doc.entries:
        reasons = entry_reasons(e)
        checks.append(EntryCheck(entry_id=e.id, usable=not reasons, reasons=reasons))
    return CatalogImportResponse(
        file_check=FileCheckResult(
            accepted=True, code=FileCheckCode.OK, message="The Catalogue was opened."
        ),
        catalog=raw,
        entry_checks=checks,
    )
