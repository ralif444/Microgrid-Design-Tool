"""Fake Engine: deterministic canned results for development and tests (Doc 8 §5)."""

from mgapp.adapters.fake_engine.engine import (
    FAKE_ENGINE_VERSION,
    Call,
    FakeEngine,
    FakeEngineDefectError,
    Outcome,
    ScriptEntry,
    build_result,
)

__all__ = [
    "FAKE_ENGINE_VERSION",
    "Call",
    "FakeEngine",
    "FakeEngineDefectError",
    "Outcome",
    "ScriptEntry",
    "build_result",
]
