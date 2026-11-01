"""Seam 4 (WP 1.2.3): POST /api/projects/import (Doc 3 §8, Doc 6 §3.6, Doc 9 D-47).

FR-54 (schema_version present), FR-55 (accepted document returned unchanged), FR-57 (newer or
unmigratable refused, nothing loaded), NFR-12, NFR-16; embedded RunRecords checked (K16).
"""

from __future__ import annotations

import copy
from typing import Any

import pytest
from fastapi.testclient import TestClient
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine
from mgapp.main import create_app

SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(engine=FakeEngine(), serve_static=False))


def project_file(c: TestClient) -> dict[str, Any]:
    snap = two_bus_snapshot()
    body = {"project_snapshot": snap, "parameters": {}, "solver_config": SOLVER}
    rec = c.post("/api/analyses/M1", json=body).json()["run_record"]
    return {
        "schema_version": 1,
        "app_version": "0.1.0",
        "project": {
            "id": "p1",
            "name": "Fixture",
            "description": None,
            "created_at": "2026-11-01T00:00:00Z",
            "modified_at": "2026-11-01T00:00:00Z",
            "nominal_voltage_kv": snap.pop("nominal_voltage_kv"),
            "nominal_frequency_hz": snap.pop("nominal_frequency_hz"),
        },
        **snap,
        "sizing_advice": [],
        "scenarios": [],
        "run_records": [rec],
    }


def _import(c: TestClient, doc: Any) -> dict[str, Any]:
    r = c.post("/api/projects/import", json=doc)
    assert r.status_code == 200, r.text
    return r.json()


def test_fr_54_fr_55_current_file_accepted_unchanged(client: TestClient) -> None:
    doc = project_file(client)
    out = _import(client, copy.deepcopy(doc))
    assert out["file_check"]["accepted"] is True
    assert out["file_check"]["code"] == "OK"
    assert out["project"] == doc
    assert out["migrated_from_version"] is None
    assert out["validation"]["valid"] is True


@pytest.mark.parametrize(
    ("version", "code"),
    [
        (2, "UNKNOWN_SCHEMA_VERSION"),
        (None, "UNKNOWN_SCHEMA_VERSION"),
        ("1", "UNKNOWN_SCHEMA_VERSION"),
        (0, "UNMIGRATABLE"),
    ],
)
def test_fr_57_version_refused_nothing_loaded(client: TestClient, version: Any, code: str) -> None:
    out = _import(client, {**project_file(client), "schema_version": version})
    assert out["file_check"]["accepted"] is False
    assert out["file_check"]["code"] == code
    assert out["project"] is None
    assert out["validation"] is None


def test_not_a_project_is_malformed_file(client: TestClient) -> None:
    assert _import(client, [1, 2])["file_check"]["code"] == "MALFORMED_FILE"
    doc = project_file(client)
    del doc["project"]
    out = _import(client, doc)
    assert out["file_check"]["code"] == "MALFORMED_FILE"
    assert any(d["path"].startswith("project") for d in out["file_check"]["details"])


def test_stage_1_issues_reported_not_fixed(client: TestClient) -> None:
    doc = project_file(client)
    doc["loads"][0]["p_kw"] = -1.0
    out = _import(client, copy.deepcopy(doc))
    assert out["file_check"]["accepted"] is True
    assert out["project"]["loads"][0]["p_kw"] == -1.0
    assert "NEGATIVE_POWER" in {i["code"] for i in out["validation"]["issues"]}


def test_bad_run_record_reported_and_skipped(client: TestClient) -> None:
    doc = project_file(client)
    bad = copy.deepcopy(doc["run_records"][0])
    bad["result_hash"] = "0" * 64
    doc["run_records"].append(bad)
    out = _import(client, doc)
    assert out["file_check"]["accepted"] is True
    assert [d["path"] for d in out["file_check"]["details"]] == ["run_records[1]"]
    assert out["project"]["run_records"] == doc["run_records"][:1]
