"""Seam 6: loopback bind (NFR-17) and engine selection by startup configuration (D-21)."""

from __future__ import annotations

import pytest

from mgapp.config import BIND_HOST, EngineChoice, Settings


def test_nfr_17_bind_host_is_loopback() -> None:
    assert BIND_HOST == "127.0.0.1"


def test_engine_default_is_fake() -> None:
    assert Settings.from_env({}).engine is EngineChoice.FAKE


def test_engine_selected_from_env() -> None:
    assert Settings.from_env({"MGAPP_ENGINE": "real"}).engine is EngineChoice.REAL


def test_unknown_engine_refused() -> None:
    with pytest.raises(ValueError):
        Settings.from_env({"MGAPP_ENGINE": "MAYBE"})


def test_feature_cable_sizing_off_by_default() -> None:
    assert Settings.from_env({}).feature_cable_sizing is False


@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on"])
def test_feature_cable_sizing_enabled_from_env(value: str) -> None:
    assert Settings.from_env({"MGAPP_FEATURE_CABLE_SIZING": value}).feature_cable_sizing is True


@pytest.mark.parametrize("value", ["", "0", "false", "no"])
def test_feature_cable_sizing_stays_off(value: str) -> None:
    assert Settings.from_env({"MGAPP_FEATURE_CABLE_SIZING": value}).feature_cable_sizing is False
