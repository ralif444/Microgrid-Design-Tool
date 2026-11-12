"""Seam 1: size limits (FR-44) and transport errors (Doc 6 §5.2)."""

from __future__ import annotations

import json
from collections.abc import Callable

import pytest
from api.conftest import Api
from fixtures.designs import two_bus_snapshot

from mgapp.domain.enums import AnalysisType
from mgapp.services.limits import Limits, check_size_limits


def _sweep(steps: int) -> dict:
    return {
        "axis": {
            "kind": "PARAMETER",
            "parameter_path": "inverters/INV1/rated_kva",
            "range_min": 5.0,
            "range_max": 15.0,
            "step_count": steps,
        }
    }


def test_fr_44_sweep_one_above_cap_input_invalid_zero_calls(
    api_factory: Callable[..., Api],
) -> None:
    api = api_factory(limits=Limits(sweep_cap=5))
    ref = api.m1_ref()
    n = len(api.engine.call_log)  # type: ignore[attr-defined]
    r = api.run("M3b", depends_on=ref, parameters=_sweep(6))["result"]
    assert (r["status"], r["status_code"]) == ("INPUT_INVALID", "SWEEP_CAP_EXCEEDED")
    assert len(api.engine.call_log) == n  # type: ignore[attr-defined]


def test_fr_44_sweep_at_cap_accepted(api_factory: Callable[..., Api]) -> None:
    api = api_factory(limits=Limits(sweep_cap=5))
    r = api.run("M3b", depends_on=api.m1_ref(), parameters=_sweep(5))["result"]
    assert r["status"] == "FEASIBLE"


def test_m3d_cap_uses_product_of_steps(api_factory: Callable[..., Api]) -> None:
    api = api_factory(limits=Limits(sweep_cap=8))
    ax = _sweep(3)["axis"]
    r = api.run("M3d", depends_on=api.m1_ref(), parameters={"axis_x": ax, "axis_y": ax})["result"]
    assert r["status_code"] == "SWEEP_CAP_EXCEEDED"


def test_d67_lambda_c_point_cap(api_factory: Callable[..., Api]) -> None:
    api = api_factory(limits=Limits(lambda_c_point_cap=5))
    ref = api.m1_ref()
    for steps, code in ((6, "SWEEP_CAP_EXCEEDED"), (5, "OK")):
        params = _sweep(steps) | {"point_metrics": ["LAMBDA_C"]}
        r = api.run("M3b", depends_on=ref, parameters=params)["result"]
        assert r["status_code"] == code, r
    r = api.run("M3b", depends_on=ref, parameters=_sweep(6))["result"]  # no LAMBDA_C, no cap
    assert r["status_code"] == "OK"


def test_d67_m4b_duration_cap_60_s(api: Api) -> None:
    m4b = {
        "disturbance": {"kind": "LOAD_STEP", "element_id": "LD1", "magnitude": 1.0,
                        "start_time_s": 0.1, "duration_s": None},
        "simulation_end_s": 61.0,
    }  # fmt: skip
    ref = api.m1_ref(project_snapshot=two_bus_snapshot())
    r = api.run("M4b", depends_on=ref, parameters=m4b)["result"]
    assert r["status_code"] == "DURATION_CAP_EXCEEDED", r
    # 60 s passes stage 1; not run here: the two-inverter fixture is unstable and slow on REAL.
    ok = check_size_limits(AnalysisType.M4B, m4b | {"simulation_end_s": 60.0}, 0, Limits())
    assert ok == []


def test_unknown_analysis_type_404_no_runrecord(api: Api) -> None:
    r = api.client.post("/api/analyses/M9", json={})
    assert r.status_code == 404
    assert r.json() == {"code": "UNKNOWN_ANALYSIS_TYPE", "message": "Unknown analysis type 'M9'."}


def test_unknown_route_404(api: Api) -> None:
    r = api.client.get("/api/nothing")
    assert (r.status_code, r.json()["code"]) == (404, "NOT_FOUND")


def test_wrong_method_405(api: Api) -> None:
    r = api.client.get("/api/analyses/M1")
    assert (r.status_code, r.json()["code"]) == (405, "METHOD_NOT_ALLOWED")


def test_malformed_json_400(api: Api) -> None:
    r = api.client.post(
        "/api/analyses/M1", content=b"{not json", headers={"content-type": "application/json"}
    )
    assert (r.status_code, r.json()["code"]) == (400, "MALFORMED_JSON")


def test_json_nested_too_deep_400(api: Api) -> None:
    """A body too deeply nested to decode is a transport error, not a 500."""
    raw = "[" * 100_000 + "]" * 100_000
    r = api.client.post(
        "/api/analyses/M1", content=raw, headers={"content-type": "application/json"}
    )
    assert r.status_code == 400
    assert r.json()["code"] == "MALFORMED_JSON"


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity", "1e999", "1" + "0" * 400])
def test_non_finite_parameter_is_malformed_request_zero_calls(api: Api, bad: str) -> None:
    """Doc 3 §1: numbers are finite; `parameters` follows the rule the snapshot already has."""
    body = json.dumps(api.body("PS")).replace(
        '"inverter_margin_ratio": 0.2', f'"inverter_margin_ratio": {bad}'
    )
    assert bad in body
    r = api.client.post(
        "/api/analyses/PS", content=body, headers={"content-type": "application/json"}
    )
    assert r.status_code == 200, r.text
    res = r.json()
    assert (res["result"]["status"], res["result"]["status_code"]) == (
        "INPUT_INVALID",
        "MALFORMED_REQUEST",
    )
    assert res["run_record"]["engine_kind"] is None  # engine not called
    assert len(api.engine.call_log) == 0  # type: ignore[attr-defined]


def test_non_finite_parameter_in_validate_is_reported(api: Api) -> None:
    body = json.dumps(
        {
            "project_snapshot": two_bus_snapshot(),
            "target_analysis_type": "PS",
            "parameters": {"x": 1},
        }
    ).replace('"x": 1', '"x": NaN')
    r = api.client.post(
        "/api/projects/validate", content=body, headers={"content-type": "application/json"}
    )
    assert r.status_code == 200
    rep = r.json()
    assert rep["valid"] is False
    assert [i["code"] for i in rep["issues"]] == ["MALFORMED_REQUEST"]


def test_wrong_media_type_415(api: Api) -> None:
    r = api.client.post("/api/analyses/M1", content=b"x", headers={"content-type": "text/plain"})
    assert (r.status_code, r.json()["code"]) == (415, "UNSUPPORTED_MEDIA_TYPE")


def test_body_over_limit_413(api: Api) -> None:
    big = b'{"x":"' + b"a" * (10 * 1024 * 1024) + b'"}'
    r = api.client.post(
        "/api/analyses/M1", content=big, headers={"content-type": "application/json"}
    )
    assert (r.status_code, r.json()["code"]) == (413, "PAYLOAD_TOO_LARGE")


def test_health_and_meta(api: Api) -> None:
    assert api.client.get("/api/health").json() == {"status": "OK"}
    meta = api.client.get("/api/meta").json()
    assert meta["engine"]["engine_kind"] == api.engine.identity().engine_kind
    assert meta["limits"] == {
        "time_budget_s": 30.0,
        "sweep_cap": 1000,
        "margin_warn": 0.05,
        "body_limit_mib": 10,
        "scenario_cap": None,
        "m3a_parameter_cap": None,
        "m4b_duration_cap_s": 60.0,
        "lambda_c_point_cap": 50,
    }
