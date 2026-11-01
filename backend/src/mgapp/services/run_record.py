"""RunRecord service (component 10; Doc 3 §7). Builds a RunRecord for EVERY request.

Verification of imported records and re-run comparison are added in stage 1.2 (WP 1.2.3).
"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from mgapp import __version__
from mgapp.domain.contract import AnalysisResult, EngineIdentity
from mgapp.domain.enums import AnalysisType
from mgapp.domain.run_record import RECORD_SCHEMA_VERSION, RunRecord
from mgapp.services.dependency import result_hash


def utc_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def new_record_id() -> str:
    return uuid.uuid4().hex  # 32 chars, matches the Doc 3 id pattern


class RunRecordService:
    def __init__(
        self,
        clock: Callable[[], str] = utc_now,
        id_factory: Callable[[], str] = new_record_id,
    ) -> None:
        self._clock = clock
        self._id = id_factory

    def build(
        self,
        *,
        analysis_type: AnalysisType,
        parameters: Any,
        snapshot: Any,
        snapshot_hash: str,
        scenarios: list[Any] | None,
        depends_on: Any,
        solver_config: Any,
        identity: EngineIdentity | None,
        result: AnalysisResult,
        replay_of_record_id: str | None = None,
    ) -> RunRecord:
        return RunRecord(
            record_id=self._id(),
            schema_version=RECORD_SCHEMA_VERSION,
            app_version=__version__,
            created_at=self._clock(),
            analysis_type=analysis_type,
            parameters=parameters,
            snapshot=snapshot,
            snapshot_hash=snapshot_hash,
            scenarios=scenarios,
            depends_on=depends_on,
            solver_config=solver_config,
            engine_version=identity.engine_version if identity else None,
            engine_git_commit=identity.engine_git_commit if identity else None,
            engine_kind=identity.engine_kind if identity else None,
            result=result,
            result_hash=result_hash(result.status, result.payload),
            replay_of_record_id=replay_of_record_id,
        )
