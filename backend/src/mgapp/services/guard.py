"""Execution guard (component 9; Doc 4 §5, §7c). The ONLY service that imports the Engine Port.

Reads engine identity, makes the one `run` call under TIME_BUDGET in a worker thread,
maps overrun to UNAVAILABLE/TIMEOUT (a late result is discarded), exceptions and
disallowed Statuses to UNAVAILABLE/ENGINE_ERROR. Decision: thread + abandon for stage 1.1
(Doc 9 A-15); a thread cannot be killed, revisit at WP 1.4.3.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass

from mgapp.domain.contract import AnalysisRequest, AnalysisResult, EngineIdentity, Warning
from mgapp.domain.enums import ALLOWED_STATUS, EngineKind, Status, StatusCode, WarningCode
from mgapp.engine_port import EnginePort

log = logging.getLogger("mgapp.guard")

MSG_ENGINE_ERROR = (
    "The calculation engine failed unexpectedly (internal error, not a solver result). "
    "Run again; if it repeats, report the RunRecord."
)
FAKE_WARNING = Warning(
    code=WarningCode.ENGINE_KIND_FAKE,
    message="Result from the Fake Engine; not an engine calculation.",
)


@dataclass(frozen=True)
class GuardedOutcome:
    result: AnalysisResult
    identity: EngineIdentity | None  # None only if identity() itself failed
    engine_called: bool


def _app_result(code: StatusCode, message: str, identity: EngineIdentity | None) -> AnalysisResult:
    warnings = [FAKE_WARNING] if identity and identity.engine_kind is EngineKind.FAKE else []
    return AnalysisResult(
        status=Status.UNAVAILABLE,
        status_code=code,
        message=message,
        payload=None,
        warnings=warnings,
        diagnostics={},
    )


class ExecutionGuard:
    def __init__(self, engine: EnginePort, time_budget_s: float) -> None:
        self._engine = engine
        self.time_budget_s = time_budget_s

    def identity(self) -> EngineIdentity:
        return self._engine.identity()

    def run(self, request: AnalysisRequest) -> GuardedOutcome:
        try:
            ident = self._engine.identity()
        except Exception:
            log.exception("engine identity() raised")
            return GuardedOutcome(
                _app_result(StatusCode.ENGINE_ERROR, MSG_ENGINE_ERROR, None), None, False
            )

        box: dict[str, object] = {}

        def work() -> None:
            try:
                box["result"] = self._engine.run(request)
            except BaseException as exc:  # noqa: BLE001 - every exception is an engine defect
                box["error"] = exc

        worker = threading.Thread(target=work, name="mgapp-engine", daemon=True)
        worker.start()
        worker.join(self.time_budget_s)
        if worker.is_alive():
            msg = (
                f"The analysis took longer than the time budget of {self.time_budget_s:g} s and "
                "was stopped. Reduce the study size or run again."
            )
            return GuardedOutcome(_app_result(StatusCode.TIMEOUT, msg, ident), ident, True)
        if "error" in box:
            err = box["error"]
            log.error(
                "engine run() raised", exc_info=err if isinstance(err, BaseException) else None
            )
            return GuardedOutcome(
                _app_result(StatusCode.ENGINE_ERROR, MSG_ENGINE_ERROR, ident), ident, True
            )
        res = box.get("result")
        if not isinstance(res, AnalysisResult):
            log.error("engine returned %r, not an AnalysisResult", type(res))
            return GuardedOutcome(
                _app_result(StatusCode.ENGINE_ERROR, MSG_ENGINE_ERROR, ident), ident, True
            )
        if res.status not in ALLOWED_STATUS[request.analysis_type]:
            log.error(
                "engine returned disallowed status %s for %s", res.status, request.analysis_type
            )
            return GuardedOutcome(
                _app_result(StatusCode.ENGINE_ERROR, MSG_ENGINE_ERROR, ident), ident, True
            )
        return GuardedOutcome(res, ident, True)
