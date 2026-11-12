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


def breaker(**values: Any) -> dict[str, Any]:
    return {
        "id": "B1",
        "kind": "BREAKER",
        "provenance": PROV,
        "sources": {"in_a": "p. 5"},
        "breaker": {
            "standard": "S-1",
            "class": "MCB",
            "in_a": 20,
            "curve": "C",
            "poles": 3,
            **values,
        },
    }


def test_fr_115_breaker_entry_roundtrip(client: TestClient) -> None:  # D-104 K296
    doc = catalog(
        breaker(),
        conductor(
            conductor={
                "r_ohm_per_km": 0.5,
                "x_ohm_per_km": 0.3,
                "material": "CU",
                "insulation": "PVC",
                "cores": 3,
                "size_mm2": 10,
            }
        ),
    )
    out = _import(client, copy.deepcopy(doc))
    assert out["file_check"]["accepted"] and out["catalog"] == doc
    assert [c["usable"] for c in out["entry_checks"]] == [True, True]


@pytest.mark.parametrize(
    ("entry", "reason"),
    [
        (breaker(standard=None), "standard is missing"),
        (breaker(**{"class": None}), "class is missing"),
        ({**breaker(), "sources": {}}, "sources.in_a (page or section) is missing"),
    ],
)
def test_fr_115_breaker_guard_names_the_gap(
    client: TestClient, entry: dict[str, Any], reason: str
) -> None:
    out = _import(client, catalog(entry))
    assert reason in out["entry_checks"][0]["reasons"]


@pytest.mark.parametrize(
    "values",
    [{"material": "Cu"}, {"insulation": "EPR"}, {"cores": 0}, {"size_mm2": -1}],
)
def test_fr_115_conductor_match_fields_are_checked(
    client: TestClient, values: dict[str, Any]
) -> None:  # D-104 K293
    doc = catalog(conductor(conductor={"r_ohm_per_km": 0.5, "x_ohm_per_km": 0.3, **values}))
    assert _import(client, doc)["file_check"]["code"] == "MALFORMED_FILE"


# Battery round BESS-1 (Doc 12 FR-73; D-106, D-107). Values are fictitious (MOD-T1 of the
# verification framework §2), test data only.
def module(**values: Any) -> dict[str, Any]:
    fields = {"energy_kwh": 5, "voltage_min_v": 44.8, "voltage_max_v": 57.6}
    return {
        "id": "M1",
        "kind": "BATTERY_MODULE",
        "provenance": PROV,
        "sources": {f: "p. 3" for f in fields},
        "battery_module": {**fields, **values},
    }


def test_fr_73_battery_module_roundtrip(client: TestClient) -> None:
    doc = catalog(
        module(discharge_power_kw=2.5, nominal_voltage_v=51.2),
        {**module(c_rate_per_h=0.2), "id": "M2"},
    )
    doc["entries"][0]["sources"] |= {"discharge_power_kw": "p. 4", "nominal_voltage_v": "p. 3"}
    doc["entries"][1]["sources"] |= {"c_rate_per_h": "p. 4"}
    out = _import(client, copy.deepcopy(doc))
    assert out["file_check"]["accepted"] and out["catalog"] == doc
    assert [c["usable"] for c in out["entry_checks"]] == [True, True]


def test_fr_73_module_without_power_capability_is_stored_and_usable(client: TestClient) -> None:
    # D-107: the B2 warning is shown by S-18; B1 can still use the entry.
    out = _import(client, catalog(module()))
    assert out["file_check"]["accepted"] and out["entry_checks"][0]["usable"]


@pytest.mark.parametrize(
    ("entry", "reason"),
    [
        (module(energy_kwh=None), "energy_kwh is missing"),
        (module(voltage_max_v=None), "voltage_max_v is missing"),
        (
            {**module(), "sources": {"energy_kwh": "p. 3", "voltage_min_v": "p. 3"}},
            "sources.voltage_max_v (page or section) is missing",
        ),
        (
            module(recommended_dod_ratio=0.8),
            "sources.recommended_dod_ratio (page or section) is missing",
        ),
        (module(voltage_min_v=60), "voltage_min_v is above voltage_max_v"),
        ({**module(), "battery_module": None}, "battery_module values are missing"),
    ],
)
def test_fr_73_module_guard_names_the_gap(
    client: TestClient, entry: dict[str, Any], reason: str
) -> None:
    out = _import(client, catalog(entry))
    assert out["file_check"]["accepted"] and not out["entry_checks"][0]["usable"]
    assert reason in out["entry_checks"][0]["reasons"]


@pytest.mark.parametrize(
    "values",
    [{"energy_kwh": 0}, {"c_rate_per_h": -1}, {"recommended_dod_ratio": 1.2}, {"voltage_min_v": 0}],
)
def test_fr_73_module_values_out_of_range_refused(
    client: TestClient, values: dict[str, Any]
) -> None:
    assert _import(client, catalog(module(**values)))["file_check"]["code"] == "MALFORMED_FILE"
