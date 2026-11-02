"""Seam 4 (WP 1.5.1 K): POST /api/catalogs/import and catalog_ref (Doc 12 FR-64 - FR-69; D-61).

catalogue_roundtrip, newer_version_refused, gfm_guard_refuses_use, provenance names the missing
field, duplicate ids refused, catalog_ref never reaches the engine. Entries are test fixtures
only; the app ships none (D-59 K107).
"""

from __future__ import annotations

import copy
from typing import Any

import pytest
from fastapi.testclient import TestClient
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine
from mgapp.adapters.real_engine import RealEngine
from mgapp.main import create_app

SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}
PROV = {"manufacturer": "Test maker", "model": "T-1", "document": "Test sheet", "revision": "r1"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(engine=FakeEngine(), serve_static=False))


def conductor(**over: Any) -> dict[str, Any]:
    return {
        "id": "C1",
        "kind": "CONDUCTOR",
        "provenance": PROV,
        "sources": {"r_ohm_per_km": "p. 2", "x_ohm_per_km": "p. 2"},
        "conductor": {"r_ohm_per_km": 0.5, "x_ohm_per_km": 0.3, "shunt_capacitance_uf_per_km": 0.2},
        **over,
    }


def inverter(**values: Any) -> dict[str, Any]:
    fields = {
        "rated_kva": 10,
        "nominal_voltage_kv": 0.4,
        "nominal_frequency_hz": 50,
        "frequency_droop_min_hz_per_kw": 0.01,
        "frequency_droop_max_hz_per_kw": 0.1,
        "voltage_droop_min_kv_per_kvar": 0.001,
        "voltage_droop_max_kv_per_kvar": 0.01,
    }
    return {
        "id": "I1",
        "kind": "INVERTER",
        "provenance": PROV,
        "sources": {f: "p. 1" for f in fields},
        "inverter": {**fields, **values},
    }


def catalog(*entries: dict[str, Any]) -> dict[str, Any]:
    return {"schema_version": 1, "app_version": "0.1.0", "entries": list(entries)}


def _import(c: TestClient, doc: Any) -> dict[str, Any]:
    r = c.post("/api/catalogs/import", json=doc)
    assert r.status_code == 200
    return r.json()


def test_fr_64_catalogue_roundtrip(client: TestClient) -> None:
    doc = catalog(conductor(), inverter(grid_forming=True, grid_forming_reference="p. 4"))
    out = _import(client, copy.deepcopy(doc))
    assert out["file_check"]["accepted"] and out["catalog"] == doc
    assert [c["usable"] for c in out["entry_checks"]] == [True, True]


@pytest.mark.parametrize(
    ("version", "code"),
    [(2, "UNKNOWN_SCHEMA_VERSION"), (0, "UNMIGRATABLE"), (None, "UNKNOWN_SCHEMA_VERSION")],
)
def test_fr_64_newer_or_unmigratable_version_refused(
    client: TestClient, version: Any, code: str
) -> None:
    out = _import(client, {**catalog(conductor()), "schema_version": version})
    assert not out["file_check"]["accepted"] and out["file_check"]["code"] == code
    assert out["catalog"] is None


def test_fr_66_gfm_guard_refuses_use_but_keeps_entry(client: TestClient) -> None:
    out = _import(client, catalog(inverter(grid_forming=True)))  # no datasheet reference
    check = out["entry_checks"][0]
    assert out["file_check"]["accepted"] and not check["usable"]
    assert "information only" in check["reasons"][0]
    assert out["catalog"]["entries"][0]["id"] == "I1"


def test_fr_65_missing_provenance_names_the_field(client: TestClient) -> None:
    entry = conductor(sources={"r_ohm_per_km": "p. 2"}, provenance={**PROV, "revision": None})
    reasons = _import(client, catalog(entry))["entry_checks"][0]["reasons"]
    assert reasons == [
        "provenance.revision is missing",
        "sources.x_ohm_per_km (page or section) is missing",
    ]


def test_duplicate_entry_ids_refused(client: TestClient) -> None:
    out = _import(client, catalog(conductor(), conductor()))
    assert out["file_check"]["code"] == "MALFORMED_FILE"
    assert out["file_check"]["details"][0]["path"] == "entries[1].id"


def test_fr_69_catalog_ref_is_hashed_but_never_reaches_the_engine() -> None:
    c = TestClient(create_app(engine=RealEngine(), serve_static=False))
    snap = two_bus_snapshot()
    ref = {"entry_id": "C1", "provenance": PROV, "catalog_schema_version": 1}
    with_ref = copy.deepcopy(snap)
    with_ref["lines"][0]["catalog_ref"] = ref
    a, b = (
        c.post(
            "/api/analyses/M1",
            json={"project_snapshot": s, "parameters": {}, "solver_config": SOLVER},
        ).json()
        for s in (snap, with_ref)
    )
    assert a["result"]["status"] == b["result"]["status"] == "FEASIBLE"
    assert a["result"]["payload"] == b["result"]["payload"]
    assert a["run_record"]["snapshot_hash"] != b["run_record"]["snapshot_hash"]
