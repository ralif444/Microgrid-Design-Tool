"""Seam 6: OpenAPI and generated TS types are current; units declared (NFR-15, FR-05, NFR-05)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import gen
import pytest

SPEC: dict[str, Any] = json.loads(gen.OPENAPI.read_text(encoding="utf-8"))

API_PATHS = {
    "/api/health",
    "/api/meta",
    "/api/projects/validate",  # WP 1.2.1
    "/api/projects/import",
    "/api/run-records/verify",
    "/api/run-records/rerun",
    "/api/catalogs/import",
    *(f"/api/analyses/{t}" for t in ("PS", "M1", "M2", "M3a", "M3b", "M3c", "M3d", "M4a", "M4b")),
}

# Unit suffixes of Doc 3 §1 plus derived forms used in payloads.
UNIT_SUFFIX = re.compile(
    r"_(kw|kvar|kva|kv|ohm|ohm_per_km|km|a|hz|hz_per_kw|kv_per_kvar|deg|s|kwh|h|pu|ratio|"
    r"per_s|hz_per_s|w|mib|v|uf_per_km)$"
)
# Numeric fields without a unit, by Doc 3 definition (counts, indices, versions, unitless
# margins and indicators, axis values whose unit is given by the axis, and LimitingConstraint
# fields whose unit is in the sibling `unit` field).
UNITLESS = {
    "unit_count",
    "redundancy",
    "iterations",
    "hour",
    "step_count",
    "rank",
    "eigenvalue_index",
    "schema_version",
    "record_schema_version",
    "catalog_schema_version",
    "migrated_from_version",  # a schema version number
    "max_iterations",
    "sweep_cap",
    "scenario_cap",
    "m3a_parameter_cap",
    "margin_warn",
    "lambda_c",
    "lambda_s",
    "lambda_ub",
    "resolution",
    "grid_step",
    "zeta_min",
    "r_tau",
    "kappa",
    "value",
    "limit",
    "margin",
    "normalised_margin",
    "normalised_value",
    "delta",
    "x_value",
    "y_value",
    "range_min",
    "range_max",
    "feasible_fraction",
    "factors",
    "values",
    "first_infeasible_value",
    "power_factor",
    "diagram_x",
    "diagram_y",
}


def _numeric(prop: dict[str, Any]) -> bool:
    types = {prop.get("type")} | {a.get("type") for a in prop.get("anyOf", [])}
    item = prop.get("items", {})
    types |= {item.get("type")} | {a.get("type") for a in item.get("anyOf", [])}
    return bool(types & {"number", "integer"})


def test_nfr_15_generated_files_are_current() -> None:
    assert gen.main(["--check"]) == 0


def test_nfr_15_drift_is_detected(tmp_path: Path) -> None:
    committed = gen.OPENAPI.read_text(encoding="utf-8")
    copy = tmp_path / "openapi.json"
    copy.write_text(committed.replace('"rated_kva"', '"rated_kva_x"', 1), encoding="utf-8")
    assert gen.stale([(copy, committed)]) == [copy]
    assert gen.stale([(gen.OPENAPI, committed)]) == []


def test_types_file_carries_generated_header() -> None:
    assert gen.TYPES.read_text(encoding="utf-8").startswith(gen.HEADER)


def test_implemented_endpoints_only() -> None:
    assert set(SPEC["paths"]) == API_PATHS


def test_no_422_documented() -> None:
    for path, ops in SPEC["paths"].items():
        for op in ops.values():
            assert "422" not in op.get("responses", {}), path


def test_analysis_routes_document_body_and_response() -> None:
    for t in ("M1", "M4b"):
        op = SPEC["paths"][f"/api/analyses/{t}"]["post"]
        ref = op["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        assert ref.endswith("/AnalysisRequestBody")
        resp = op["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
        assert resp.endswith("/AnalysisResponse")


@pytest.mark.parametrize("name", sorted(SPEC["components"]["schemas"]))
def test_fr_05_every_numeric_field_declares_unit(name: str) -> None:
    schema = SPEC["components"]["schemas"][name]
    for field, prop in schema.get("properties", {}).items():
        if _numeric(prop) and field not in UNITLESS:
            assert UNIT_SUFFIX.search(field), f"{name}.{field} has no unit suffix"


def test_unit_check_detects_missing_suffix() -> None:
    assert not UNIT_SUFFIX.search("rated_power") and UNIT_SUFFIX.search("rated_kva")
