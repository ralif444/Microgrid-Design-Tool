"""RunRecord: 17 fields (Doc 3 §7, manuscript Tabel D.2) and the HTTP response wrapper."""

from __future__ import annotations

from typing import Any

from mgapp.domain.base import Model
from mgapp.domain.contract import AnalysisResult
from mgapp.domain.enums import AnalysisType, EngineKind

RECORD_SCHEMA_VERSION = 1


class RunRecord(Model):
    # Identity (4)
    record_id: str
    schema_version: int
    app_version: str
    created_at: str
    # Input (7)
    analysis_type: AnalysisType
    parameters: Any
    snapshot: Any
    snapshot_hash: str
    scenarios: list[Any] | None = None
    depends_on: Any = None
    solver_config: Any
    # Engine (3); null when the engine was not called
    engine_version: str | None
    engine_git_commit: str | None
    engine_kind: EngineKind | None
    # Result (2)
    result: AnalysisResult
    result_hash: str
    # Replay (1)
    replay_of_record_id: str | None = None


class AnalysisResponse(Model):
    """HTTP 200 body of every /api/analyses/{type} call (Doc 6 §3.2)."""

    result: AnalysisResult
    run_record: RunRecord


__all__ = ["RECORD_SCHEMA_VERSION", "AnalysisResponse", "RunRecord"]
