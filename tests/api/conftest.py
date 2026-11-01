"""Seam 1 fixtures: the app built through the composition-root factory with a Fake Engine."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from fixtures.designs import PARAMETERS, scenarios, two_bus_snapshot

from mgapp.adapters.fake_engine import FakeEngine, ScriptEntry
from mgapp.domain.enums import AnalysisType
from mgapp.engine_port import EnginePort
from mgapp.main import create_app
from mgapp.services.limits import Limits

SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}

RUN_RECORD_FIELDS = {
    "record_id",
    "schema_version",
    "app_version",
    "created_at",
    "analysis_type",
    "parameters",
    "snapshot",
    "snapshot_hash",
    "scenarios",
    "depends_on",
    "solver_config",
    "engine_version",
    "engine_git_commit",
    "engine_kind",
    "result",
    "result_hash",
    "replay_of_record_id",
}


class Api:
    def __init__(self, engine: EnginePort, limits: Limits | None = None) -> None:
        self.engine = engine
        self.client = TestClient(create_app(engine=engine, limits=limits, serve_static=False))

    def body(self, t: str, **over: Any) -> dict[str, Any]:
        b: dict[str, Any] = {
            "project_snapshot": two_bus_snapshot(),
            "parameters": dict(PARAMETERS[t]),
            "solver_config": dict(SOLVER),
        }
        if t == "M3c":
            b["scenarios"] = scenarios()
        b.update(over)
        return b

    def post(self, t: str, body: Any) -> Any:
        return self.client.post(f"/api/analyses/{t}", json=body)

    def run(self, t: str, **over: Any) -> dict[str, Any]:
        r = self.post(t, self.body(t, **over))
        assert r.status_code == 200, r.text
        return r.json()

    def m1_ref(self, **over: Any) -> dict[str, Any]:
        resp = self.run("M1", **over)
        rec = resp["run_record"]
        return {
            "record_id": rec["record_id"],
            "analysis_type": "M1",
            "snapshot_hash": rec["snapshot_hash"],
            "status": rec["result"]["status"],
            "result_hash": rec["result_hash"],
            "result_payload": rec["result"]["payload"],
        }


@pytest.fixture
def api_factory() -> Callable[..., Api]:
    def make(
        script: dict[AnalysisType, ScriptEntry] | None = None,
        limits: Limits | None = None,
        engine: EnginePort | None = None,
    ) -> Api:
        return Api(engine or FakeEngine(script=script or {}), limits)

    return make


@pytest.fixture
def api(api_factory: Callable[..., Api]) -> Api:
    return api_factory()
