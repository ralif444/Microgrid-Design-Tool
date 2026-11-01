"""WP 1.1.4: the six canonicalisation rules, observed through HTTP (Doc 3 §7, manuscript 4.3.5).

FR-48: same input → same hash; one changed value → different hash.
"""

from __future__ import annotations

import copy
import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from fixtures.designs import two_bus_snapshot
from fixtures.reference_canonical import _num, sha256

from mgapp.adapters.fake_engine import FakeEngine
from mgapp.main import create_app

SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(engine=FakeEngine(), serve_static=False))


def snapshot_hash(client: TestClient, snap: dict, t: str = "M1", **extra: object) -> str:
    body = {"project_snapshot": snap, "parameters": {}, "solver_config": SOLVER, **extra}
    r = client.post(f"/api/analyses/{t}", json=body)
    assert r.status_code == 200, r.text
    return str(r.json()["run_record"]["snapshot_hash"])


def raw_hash(client: TestClient, raw_json: str) -> dict:
    r = client.post(
        "/api/analyses/M1", content=raw_json.encode(), headers={"content-type": "application/json"}
    )
    assert r.status_code == 200, r.text
    return dict(r.json())


def test_rule_2_key_order_does_not_change_hash(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = json.loads(json.dumps(a), object_pairs_hook=lambda kv: dict(reversed(kv)))
    assert list(a) != list(b)
    assert snapshot_hash(client, a) == snapshot_hash(client, b)


def test_rule_3_entity_array_order_does_not_change_hash(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = copy.deepcopy(a)
    for k in ("buses", "loads", "inverters"):
        b[k].reverse()
    assert snapshot_hash(client, a) == snapshot_hash(client, b)


def test_rule_4_integral_float_equals_integer(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = copy.deepcopy(a)
    b["nominal_frequency_hz"] = 50  # int instead of 50.0
    assert snapshot_hash(client, a) == snapshot_hash(client, b)


def test_rule_4_negative_zero_equals_zero(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = copy.deepcopy(a)
    b["loads"][0]["q_kvar"] = -0.0
    assert snapshot_hash(client, a) == snapshot_hash(client, b)


def test_rule_4_nan_and_infinity_refused(client: TestClient) -> None:
    raw = json.dumps(
        {"project_snapshot": two_bus_snapshot(), "parameters": {}, "solver_config": SOLVER}
    )
    for bad in ("NaN", "Infinity"):
        resp = raw_hash(
            client, raw.replace('"nominal_voltage_kv": 0.4', f'"nominal_voltage_kv": {bad}')
        )
        assert resp["result"]["status_code"] == "MALFORMED_REQUEST"


@pytest.mark.parametrize(
    ("x", "text"),
    [
        (1.0, "1"),
        (0.1, "0.1"),
        (1e21, "1e+21"),
        (1e20, "100000000000000000000"),
        (1e-7, "1e-7"),
        (1.5e-6, "0.0000015"),
        (-12.5, "-12.5"),
        (5e-324, "5e-324"),
    ],
)
def test_rule_4_reference_number_format(x: float, text: str) -> None:
    """ECMAScript Number-to-String vectors for the reference canonicaliser."""
    assert _num(x) == text


def test_fr_48_one_changed_value_changes_hash(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = copy.deepcopy(a)
    b["inverters"][0]["rated_kva"] = 10.000001
    assert snapshot_hash(client, a) != snapshot_hash(client, b)


def test_server_overwrites_client_derived_impedance(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = copy.deepcopy(a)
    b["lines"][0]["r_ohm"] = 999.0
    b["lines"][0]["x_ohm"] = 999.0
    assert snapshot_hash(client, a) == snapshot_hash(client, b)


def test_labels_and_layout_excluded_from_snapshot(client: TestClient) -> None:
    a = two_bus_snapshot()
    b = copy.deepcopy(a)
    b["buses"][0].update(name="Main bus", diagram_x=10.0, diagram_y=20.0)
    assert snapshot_hash(client, a) == snapshot_hash(client, b)


def test_known_answer_snapshot_hash(client: TestClient) -> None:
    """Rules 1, 2, 6 against a hand-written canonical text (no whitespace, sorted keys)."""
    snap = {"nominal_voltage_kv": 0.4, "nominal_frequency_hz": 50.0}
    expected = (
        '{"buses":[],"design_constraints":{},"inverters":[],"lines":[],"loads":[],'
        '"nominal_frequency_hz":50,"nominal_voltage_kv":0.4}'
    )
    assert snapshot_hash(client, snap) == hashlib.sha256(expected.encode()).hexdigest()


def test_known_answer_full_snapshot_matches_reference(client: TestClient) -> None:
    snap = two_bus_snapshot()
    expected = copy.deepcopy(snap)
    expected.pop("load_profile")
    ln = expected["lines"][0]
    ln["r_ohm"] = ln["r_ohm_per_km"] * ln["length_km"]
    ln["x_ohm"] = ln["x_ohm_per_km"] * ln["length_km"]
    assert snapshot_hash(client, snap) == sha256(expected)


@pytest.mark.parametrize(
    "label", ['quote " and \\ backslash', "baris\nbaru\ttab", "Δ λ ω — ünïcödé"]
)
def test_rule_5_string_escaping(client: TestClient, label: str) -> None:
    """Scenario labels are free text inside the hashed M3c input."""
    empty = {"nominal_voltage_kv": 0.4, "nominal_frequency_hz": 50.0}
    canon_empty = {
        "buses": [],
        "design_constraints": {},
        "inverters": [],
        "lines": [],
        "loads": [],
        "nominal_frequency_hz": 50,
        "nominal_voltage_kv": 0.4,
    }
    scen = [{"scenario_id": "S1", "label": label, "project_snapshot": empty}]
    got = snapshot_hash(client, empty, t="M3c", scenarios=scen)
    expected_obj = {
        "snapshot": canon_empty,
        "scenarios": [{"scenario_id": "S1", "label": label, "project_snapshot": canon_empty}],
    }
    assert got == sha256(expected_obj)
    text = json.dumps(label, ensure_ascii=False)
    assert "\\n" in text or '\\"' in text or "Δ" in text  # escaping is the standard JSON form


@pytest.mark.parametrize("x", [1e-7, 1.5e-6, 123456.789, 1e21, 0.1 + 0.2, 2.0**53 + 2, 7.0e22])
def test_rule_4_numbers_match_reference_over_http(client: TestClient, x: float) -> None:
    snap = two_bus_snapshot()
    snap["inverters"][0]["rated_kva"] = x
    expected = copy.deepcopy(snap)
    expected.pop("load_profile")
    ln = expected["lines"][0]
    ln["r_ohm"] = ln["r_ohm_per_km"] * ln["length_km"]
    ln["x_ohm"] = ln["x_ohm_per_km"] * ln["length_km"]
    assert snapshot_hash(client, snap) == sha256(expected)
