"""Startup configuration (composition root input).

Read once at startup from environment variables; never per request (Doc 4 §6, D-21).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import StrEnum


class EngineChoice(StrEnum):
    FAKE = "FAKE"
    REAL = "REAL"


# Loopback only (NFR-17). Not configurable on purpose.
BIND_HOST = "127.0.0.1"
# [ASSUMPTION] Port 8000 is the uvicorn default; the docs fix no port (Doc 9 A-55).
DEFAULT_PORT = 8000


@dataclass(frozen=True)
class Settings:
    engine: EngineChoice = EngineChoice.FAKE
    port: int = DEFAULT_PORT
    # Name of a Fake Engine fixture profile for E2E runs (Doc 8 §5); None = default profile.
    fake_profile: str | None = None
    # Override of TIME_BUDGET in seconds, for tests only (Doc 8 §5). None = MetaInfo value.
    time_budget_s_override: float | None = None
    # X9 cable and breaker sizing (docs/CABLE_BREAKER_FEATURE_GUIDELINES.md §0): experimental,
    # off by default until the supervisor approves the scope change (KONFLIK, protection out of scope).
    feature_cable_sizing: bool = False

    @staticmethod
    def from_env(env: dict[str, str] | None = None) -> Settings:
        e = os.environ if env is None else env
        engine = EngineChoice(e.get("MGAPP_ENGINE", EngineChoice.FAKE.value).upper())
        port = int(e.get("MGAPP_PORT", str(DEFAULT_PORT)))
        profile = e.get("MGAPP_FAKE_PROFILE") or None
        tb = e.get("MGAPP_TIME_BUDGET_S")
        cable = e.get("MGAPP_FEATURE_CABLE_SIZING", "").strip().lower() in {"1", "true", "yes", "on"}
        return Settings(
            engine=engine,
            port=port,
            fake_profile=profile,
            time_budget_s_override=float(tb) if tb else None,
            feature_cable_sizing=cable,
        )
