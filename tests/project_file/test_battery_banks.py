"""Seam 4 (battery round BESS-2): BatteryBank in the Project file and its stage-1 rules
(Doc 12 FR-75, FR-118; D-106 K304, K306; D-108). The module is the fictitious TEST ONLY MOD-T1.

Banks sit outside the canonical snapshot: they never change `snapshot_hash`; their issues are
`BATTERY_BANK_INVALID` with the field path; a Project without banks answers as before.
"""

from __future__ import annotations

import copy
from typing import Any

import pytest
from fastapi.testclient import TestClient
from fixtures.designs import two_bus_snapshot
from test_import import project_file

from mgapp.adapters.fake_engine import FakeEngine
from mgapp.main import create_app

PROV = {"manufacturer": "Test maker", "model": "T-1", "document": "Test sheet", "revision": "r1"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(engine=FakeEngine(), serve_static=False))


def bank(inverter_id: str = "INV1", **over: Any) -> dict[str, Any]:
    return {
        "inverter_id": inverter_id,
        "module": {
            "catalog_ref": {"entry_id": "M1", "provenance": PROV, "catalog_schema_version": 1},
            "energy_kwh": 5,
            "voltage_min_v": 44.8,
            "voltage_max_v": 57.6,
            "discharge_power_kw": 2.5,
            "c_rate_per_h": None,
        },
        "series_count": 8,
        "parallel_count": 2,
        "dc_efficiency_ratio": 0.95,
        "depth_of_discharge_ratio": 0.8,
        "initial_soc_ratio": 1.0,
        **over,
    }


def _validate(c: TestClient, banks: list[dict[str, Any]] | None) -> dict[str, Any]:
    body: dict[str, Any] = {"project_snapshot": two_bus_snapshot()}
    if banks is not None:
        body["battery_banks"] = banks
    return c.post("/api/projects/validate", json=body).json()


def test_fr_75_project_file_with_banks_opens_unchanged(client: TestClient) -> None:
    doc = project_file(client) | {"battery_banks": [bank(), bank("INV2", initial_soc_ratio=None)]}
    out = client.post("/api/projects/import", json=copy.deepcopy(doc)).json()
    assert out["file_check"]["accepted"] and out["validation"]["valid"]
    assert out["project"] == doc


def test_fr_75_banks_change_no_snapshot_hash(client: TestClient) -> None:
    assert _validate(client, [bank()])["snapshot_hash"] == _validate(client, None)["snapshot_hash"]
    assert _validate(client, [])["valid"]


@pytest.mark.parametrize(
    ("banks", "field"),
    [
        ([bank(), bank()], "battery_banks[1].inverter_id"),  # second bank on one inverter
        ([bank("INV9")], "battery_banks[0].inverter_id"),
        ([bank(series_count=0)], "battery_banks[0].series_count"),
        ([bank(parallel_count=-1)], "battery_banks[0].parallel_count"),
        ([bank(dc_efficiency_ratio=1.2)], "battery_banks[0].dc_efficiency_ratio"),
        ([bank(depth_of_discharge_ratio=0)], "battery_banks[0].depth_of_discharge_ratio"),
        ([bank(initial_soc_ratio=-0.5)], "battery_banks[0].initial_soc_ratio"),
        (
            [bank(module={**bank()["module"], "energy_kwh": None})],
            "battery_banks[0].module.energy_kwh",
        ),
        (
            [bank(module={**bank()["module"], "c_rate_per_h": 0})],
            "battery_banks[0].module.c_rate_per_h",
        ),
    ],
)
def test_fr_75_bank_rules_name_the_field(
    client: TestClient, banks: list[dict[str, Any]], field: str
) -> None:
    out = _validate(client, banks)
    assert not out["valid"]
    assert [(i["code"], i["field"]) for i in out["issues"]] == [("BATTERY_BANK_INVALID", field)]


def test_fr_118_empty_ratios_are_not_issues(client: TestClient) -> None:
    empty = bank(dc_efficiency_ratio=None, depth_of_discharge_ratio=None, initial_soc_ratio=None)
    assert _validate(client, [empty])["valid"]


def test_fr_75_invalid_bank_in_a_file_is_reported_not_refused(client: TestClient) -> None:
    doc = project_file(client) | {"battery_banks": [bank("INV9")]}
    out = client.post("/api/projects/import", json=doc).json()
    assert out["file_check"]["accepted"] and not out["validation"]["valid"]
    assert out["validation"]["issues"][0]["code"] == "BATTERY_BANK_INVALID"


def test_fr_75_bank_of_the_wrong_shape_refuses_the_file(client: TestClient) -> None:
    doc = project_file(client) | {"battery_banks": [bank(series_count=1.5)]}
    out = client.post("/api/projects/import", json=doc).json()
    assert out["file_check"]["code"] == "MALFORMED_FILE"
