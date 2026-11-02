"""Seam 1, REAL only (WP 1.4.2): startup selection and unit conversion through HTTP.

Expected values follow from the fixture (fixtures/designs.py) by hand: two equal inverters
with droop 0.05 Hz/kW share 10 kW, so f = 50 − 0.05 · 5 = 49.75 Hz (Eq. 4.5); the network
carries no flow (each bus serves its own 5 kW load).
"""

from __future__ import annotations

import pytest
from api.conftest import Api
from fastapi.testclient import TestClient
from fixtures.designs import two_bus_snapshot

from mgapp.adapters.real_engine import RealEngine
from mgapp.config import EngineChoice, Settings
from mgapp.main import create_app


@pytest.fixture
def real() -> Api:
    return Api(RealEngine())


def test_real_selected_at_startup() -> None:
    c = TestClient(create_app(Settings(engine=EngineChoice.REAL), serve_static=False))
    assert c.get("/api/meta").json()["engine"]["engine_kind"] == "REAL"


def test_m1_contract_units(real: Api) -> None:
    p = real.run("M1")["result"]["payload"]
    assert p["system_frequency_hz"] == pytest.approx(49.75, abs=1e-9)
    assert [b["voltage_kv"] for b in p["bus_results"]] == pytest.approx([0.4, 0.4], abs=1e-9)
    assert [i["p_kw"] for i in p["inverter_results"]] == pytest.approx([5.0, 5.0], abs=1e-9)
    assert p["inverter_results"][0]["loading_ratio"] == pytest.approx(0.5, abs=1e-9)
    assert p["epsilon_x_ratio"] == pytest.approx(0.25 / 50, abs=1e-9)  # (4.1)


def test_ps_kva(real: Api) -> None:
    p = real.run("PS")["result"]["payload"]  # m_inv 0.2, n 2, r 0
    assert p["load_apparent_kva"] == pytest.approx(10.0)
    assert p["required_inverter_kva"]["value_kva"] == pytest.approx(12.0)
    assert p["inverter_plan"]["unit_rating_kva"] == pytest.approx(6.0)  # (4.3)


def test_m2_infeasible_frequency_in_hz(real: Api) -> None:
    snap = two_bus_snapshot()
    snap["design_constraints"] = {"frequency_min_hz": 49.8}  # FIXTURE ONLY: above 49.75 Hz
    res = real.run("M2", project_snapshot=snap, depends_on=real.m1_ref(project_snapshot=snap))
    r = res["result"]
    assert r["status"] == "INFEASIBLE" and r["status_code"] == "CONSTRAINT_VIOLATED"
    (lc,) = r["limiting_constraints"]
    assert (lc["kind"], lc["unit"]) == ("FREQUENCY_MIN", "Hz")
    assert lc["value"] == pytest.approx(49.75, abs=1e-9)
    assert lc["margin"] == pytest.approx(-0.05, abs=1e-9)
    assert lc["normalised_margin"] == pytest.approx(-0.05 / 49.8, abs=1e-12)  # (4.18) one-sided
