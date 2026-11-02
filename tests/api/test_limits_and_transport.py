"""Seam 1: size limits (FR-44) and transport errors (Doc 6 §5.2)."""

from __future__ import annotations

from collections.abc import Callable

from api.conftest import Api

from mgapp.services.limits import Limits


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
        "m4b_duration_cap_s": None,
    }
