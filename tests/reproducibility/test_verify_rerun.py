"""Seam 3 (WP 1.2.3): RunRecord export → verify → rerun on the Fake Engine.

FR-49 (one file, accepted by verify), FR-50 (tampered refused, no engine call), FR-51
(version mismatch warns and still runs), FR-52 (REPRODUCED / DIFFERS with differences),
FR-53 (new record with replay_of_record_id; imported record unchanged), NFR-01.
"""

from __future__ import annotations

import copy
import json
from typing import Any

from fastapi.testclient import TestClient
from fixtures.designs import PARAMETERS, two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine, Outcome, ScriptEntry
from mgapp.domain.contract import EngineIdentity
from mgapp.domain.enums import AnalysisType, EngineKind
from mgapp.main import create_app

SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}


def _client(engine: FakeEngine | None = None) -> TestClient:
    return TestClient(create_app(engine=engine or FakeEngine(), serve_static=False))


def _record(c: TestClient, t: str = "M1", **over: Any) -> dict[str, Any]:
    body = {
        "project_snapshot": two_bus_snapshot(),
        "parameters": dict(PARAMETERS[t]),
        "solver_config": SOLVER,
        **over,
    }
    r = c.post(f"/api/analyses/{t}", json=body)
    assert r.status_code == 200
    # FR-49: the export is the record as one JSON document
    return json.loads(json.dumps(r.json()["run_record"]))


def _post(c: TestClient, path: str, rec: Any) -> dict[str, Any]:
    r = c.post(f"/api/run-records/{path}", json={"run_record": rec})
    assert r.status_code == 200, r.text
    return r.json()


def test_fr_49_fr_50_unchanged_record_accepted() -> None:
    c = _client()
    v = _post(c, "verify", _record(c))
    assert v["file_check"]["accepted"] is True
    assert v["file_check"]["code"] == "OK"
    assert v["file_check"]["details"] == []
    assert v["engine_comparison"]["differs"] is False


def test_fr_50_tampered_snapshot_and_result_refused_without_engine_call() -> None:
    eng = FakeEngine()
    c = _client(eng)
    rec = _record(c)
    rec["snapshot"]["loads"][0]["p_kw"] = 99.0
    rec["result"]["payload"]["system_frequency_hz"] = 1.0
    n = len(eng.call_log)
    for path in ("verify", "rerun"):
        out = _post(c, path, rec)
        assert out["file_check"]["accepted"] is False
        assert out["file_check"]["code"] == "HASH_MISMATCH"
        assert {d["path"] for d in out["file_check"]["details"]} == {"snapshot_hash", "result_hash"}
    assert len(eng.call_log) == n


def test_verify_refuses_unknown_version_and_non_record() -> None:
    c = _client()
    rec = _record(c)
    newer = _post(c, "verify", {**rec, "schema_version": 2})
    assert newer["file_check"]["code"] == "UNKNOWN_SCHEMA_VERSION"
    assert (
        _post(c, "verify", {"x": 1, "schema_version": 1})["file_check"]["code"] == "MALFORMED_FILE"
    )
    assert _post(c, "verify", None)["file_check"]["code"] == "MALFORMED_FILE"


def test_nfr_01_fr_52_fr_53_rerun_reproduced_new_record_imported_unchanged() -> None:
    c = _client()
    for t, over in (("M1", {}), ("PS", {}), ("M1", {"project_snapshot": {}})):
        rec = _record(c, t, **over)
        before = copy.deepcopy(rec)
        out = _post(c, "rerun", rec)
        assert rec == before
        assert out["reproduction"]["outcome"] == "REPRODUCED"
        assert out["reproduction"]["differences"] == []
        new = out["analysis"]["run_record"]
        assert new["replay_of_record_id"] == rec["record_id"]
        assert new["record_id"] != rec["record_id"]
        assert new["result_hash"] == rec["result_hash"]


def test_rerun_of_dependent_m2_reproduced() -> None:
    c = _client()
    m1 = _record(c)
    ref = {
        "record_id": m1["record_id"],
        "analysis_type": "M1",
        "snapshot_hash": m1["snapshot_hash"],
        "status": m1["result"]["status"],
        "result_hash": m1["result_hash"],
        "result_payload": m1["result"]["payload"],
    }
    out = _post(c, "rerun", _record(c, "M2", depends_on=ref))
    assert out["reproduction"]["outcome"] == "REPRODUCED"


def test_fr_52_rerun_differs_lists_differences() -> None:
    rec = _record(_client())
    other = _client(FakeEngine(script={AnalysisType.M1: ScriptEntry(Outcome.SOLVER_FAILED)}))
    rep = _post(other, "rerun", rec)["reproduction"]
    assert rep["outcome"] == "DIFFERS"
    kinds = {(d["path"], d["kind"]) for d in rep["differences"]}
    assert ("status", "STATUS") in kinds
    assert ("status_code", "STATUS_CODE") in kinds


class _OtherVersion(FakeEngine):
    def identity(self) -> EngineIdentity:
        return EngineIdentity(
            engine_kind=EngineKind.FAKE, engine_version="fake-x", engine_git_commit="none"
        )


def test_fr_51_version_mismatch_warns_and_still_runs() -> None:
    rec = _record(_client())
    out = _post(_client(_OtherVersion()), "rerun", rec)
    assert out["reproduction"]["version_mismatch"]["differs"] is True
    assert "ENGINE_VERSION_MISMATCH" in {w["code"] for w in out["analysis"]["result"]["warnings"]}
    assert out["analysis"]["run_record"]["engine_version"] == "fake-x"
    assert out["reproduction"]["outcome"] == "REPRODUCED"  # warnings are outside result_hash
