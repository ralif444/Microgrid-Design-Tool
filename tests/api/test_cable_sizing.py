"""Seam 1: POST /api/analyses/CB, FR-105, FR-107, FR-111 (guideline §5.2, §5.3, §7; ADR-014, D-102).

Fake-Engine M1/M2 fixtures and the FICTITIOUS table file `FAKE_cable_tables_TEST_ONLY.json`
(round numbers, not PUIL). Fake M2 gives required_current_a = 0 for every Line.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest
from api.conftest import SOLVER
from fastapi.testclient import TestClient
from fixtures.designs import PARAMETERS, two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine
from mgapp.config import Settings
from mgapp.main import create_app
from mgapp.services.cable_sizing.tables import table_set_hash

TABLES = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "FAKE_cable_tables_TEST_ONLY.json").read_text(
        encoding="utf-8"
    )
)
SETTINGS = {
    "method": "B1",
    "conductor": "CU",
    "insulation": "PVC",
    "ambient_temp_c": 30,
    "grouping_count": 1,
    "grouping_arrangement": "BUNCHED",
    "cable_construction": "MULTICORE",
}


class Cb:
    def __init__(self, enabled: bool = True) -> None:
        self.engine = FakeEngine()
        app = create_app(
            Settings(feature_cable_sizing=enabled), engine=self.engine, serve_static=False
        )
        self.client = TestClient(app)

    def run(self, t: str, body: dict[str, Any]) -> dict[str, Any]:
        r = self.client.post(f"/api/analyses/{t}", json=body)
        assert r.status_code == 200, r.text
        return r.json()

    def ref(self, t: str, depends_on: dict[str, Any] | None = None) -> dict[str, Any]:
        body = {
            "project_snapshot": two_bus_snapshot(),
            "parameters": dict(PARAMETERS[t]),
            "solver_config": dict(SOLVER),
        }
        if depends_on:
            body["depends_on"] = depends_on
        rec = self.run(t, body)["run_record"]
        return {
            "record_id": rec["record_id"],
            "analysis_type": t,
            "snapshot_hash": rec["snapshot_hash"],
            "status": rec["result"]["status"],
            "result_hash": rec["result_hash"],
            "result_payload": rec["result"]["payload"],
        }

    def m2_ref(self) -> dict[str, Any]:
        return self.ref("M2", self.ref("M1"))

    def cb(self, depends_on: Any = "m2", **params: Any) -> dict[str, Any]:
        body: dict[str, Any] = {
            "project_snapshot": two_bus_snapshot(),
            "parameters": {
                "method_id": "IEC60364_OVERLOAD_PUIL2011",
                "settings": dict(SETTINGS),
                "tables": copy.deepcopy(TABLES),
                **params,
            },
            "solver_config": dict(SOLVER),
        }
        dep = self.m2_ref() if depends_on == "m2" else depends_on
        if dep is not None:
            body["depends_on"] = dep
        return self.run("CB", body)


@pytest.fixture
def cb() -> Cb:
    return Cb()


def _engine_fields_null(resp: dict[str, Any]) -> None:
    rec = resp["run_record"]
    assert (rec["engine_kind"], rec["engine_version"], rec["engine_git_commit"]) == (None,) * 3


def test_fr_105_flag_off_returns_not_applicable() -> None:
    api = Cb(enabled=False)
    resp = api.cb(depends_on=None)
    r = resp["result"]
    assert (r["status"], r["status_code"]) == ("UNAVAILABLE", "NOT_APPLICABLE")
    assert resp["run_record"]["analysis_type"] == "CB"
    _engine_fields_null(resp)


def test_fr_111_engine_fields_null_and_computed_by_app(cb: Cb) -> None:
    ref = cb.m2_ref()
    n = len(cb.engine.call_log)
    resp = cb.cb(depends_on=ref)
    r = resp["result"]
    assert r["status"] == "FEASIBLE", r
    assert r["diagnostics"]["computed_by"] == "app"
    _engine_fields_null(resp)
    assert len(cb.engine.call_log) == n  # no Engine Port call for CB


def test_fr_111_payload_and_warnings(cb: Cb) -> None:
    r = cb.cb()["result"]
    p = r["payload"]
    assert p["method_id"] == "IEC60364_OVERLOAD_PUIL2011"
    assert p["table_set_id"] == "FAKE_TEST_ONLY"
    assert p["table_set_hash"] == table_set_hash(TABLES)
    assert "Fault protection is not assessed by this tool." in p["caveat_text"]
    kinds = {(e["element_id"], e["element_kind"]) for e in p["elements"]}
    assert kinds == {("L1", "LINE"), ("INV1", "INVERTER_FEEDER"), ("INV2", "INVERTER_FEEDER")}
    inv = next(e for e in p["elements"] if e["element_id"] == "INV1")
    assert inv["ib_a"] == pytest.approx(10 / (3**0.5 * 0.4))  # D2: 10 kVA at 0.4 kV
    assert inv["device"]["class"] == "MCB"
    assert "FEATURE_EXPERIMENTAL" in {w["code"] for w in r["warnings"]}


def test_fr_111_per_element_outcome_does_not_change_status(cb: Cb) -> None:
    tables = copy.deepcopy(TABLES)
    tables["device_classes"][0]["in_series_a"] = [1]  # nothing ≥ I_B of the inverters …
    tables["device_classes"][1]["in_series_a"] = [2]  # … in either class
    r = cb.cb(tables=tables)["result"]
    assert r["status"] == "FEASIBLE"
    outcomes = {e["element_id"]: e["outcome"] for e in r["payload"]["elements"]}
    assert outcomes["INV1"] == "NO_DEVICE_FITS"
    assert outcomes["L1"] == "SIZED"  # Fake M2 I_B = 0


@pytest.mark.parametrize("dep", ["missing", "m1", "stale", "altered"])
def test_fr_111_depends_on_m2_missing_or_stale(cb: Cb, dep: str) -> None:
    ref: dict[str, Any] | None
    if dep == "missing":
        ref = None
    elif dep == "m1":
        ref = cb.ref("M1")
    else:
        ref = cb.m2_ref()
        if dep == "stale":
            ref["snapshot_hash"] = "0" * 64
        else:
            ref["result_payload"]["sizing_check"]["per_line"][0]["required_current_a"] = 99.0
    resp = cb.cb(depends_on=ref)
    r = resp["result"]
    assert (r["status"], r["status_code"]) == ("UNAVAILABLE", "DEPENDENCY_NOT_MET")
    assert "M2" in r["message"]
    _engine_fields_null(resp)


def test_fr_107_unchecked_tables_input_invalid(cb: Cb) -> None:
    tables = copy.deepcopy(TABLES)
    tables["source"]["double_entry_checked"] = False
    r = cb.cb(tables=tables)["result"]
    assert (r["status"], r["status_code"]) == ("INPUT_INVALID", "CABLE_TABLES_UNCHECKED")


def test_fr_107_incomplete_tables_input_invalid(cb: Cb) -> None:
    tables = copy.deepcopy(TABLES)
    tables["device_classes"][0]["in_series_a"] = []
    r = cb.cb(tables=tables)["result"]
    assert (r["status"], r["status_code"]) == ("INPUT_INVALID", "CABLE_TABLES_INCOMPLETE")
    assert "MCB" in r["diagnostics"]["issues"][0]["message"]


def test_fr_107_malformed_tables_are_incomplete(cb: Cb) -> None:
    tables = copy.deepcopy(TABLES)
    del tables["device_classes"]
    r = cb.cb(tables=tables)["result"]
    assert r["status_code"] == "CABLE_TABLES_INCOMPLETE"
    assert r["diagnostics"]["issues"][0]["field"].startswith("tables")


@pytest.mark.parametrize(
    "params",
    [
        {"settings": {**SETTINGS, "grouping_arrangement": "DUCT_TOUCHING"}},
        {"settings": {k: v for k, v in SETTINGS.items() if k != "ambient_temp_c"}},
        {"settings": {**SETTINGS, "per_element_overrides": {"L1": {"method": "D_DUCT"}}}},
        {"method_id": "NOPE"},
    ],
)
def test_d102_invalid_settings_are_cable_settings_invalid(cb: Cb, params: dict[str, Any]) -> None:
    r = cb.cb(**params)["result"]
    assert (r["status"], r["status_code"]) == ("INPUT_INVALID", "CABLE_SETTINGS_INVALID")


def test_d102_server_overwrites_table_set_hash(cb: Cb) -> None:
    resp = cb.cb(table_set_hash="client-value")
    assert resp["run_record"]["parameters"]["table_set_hash"] == table_set_hash(TABLES)


def test_fr_111_rerun_reproduces(cb: Cb) -> None:
    rec = cb.cb()["run_record"]
    r = cb.client.post("/api/run-records/rerun", json={"run_record": rec})
    assert r.status_code == 200, r.text
    assert r.json()["reproduction"]["outcome"] == "REPRODUCED"
