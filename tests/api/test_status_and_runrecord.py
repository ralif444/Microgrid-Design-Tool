"""Seam 1: every Status over HTTP returns 200 with a 17-field RunRecord (exit 1.1 items 2-3).

FR-17, FR-21, FR-35, FR-36, FR-42, FR-43, FR-46-FR-48.
"""

from __future__ import annotations

from collections.abc import Callable

import pytest
from api.conftest import RUN_RECORD_FIELDS, Api

from mgapp.adapters.fake_engine import Outcome, ScriptEntry
from mgapp.domain.enums import AnalysisType
from mgapp.services.limits import Limits

ALL_TYPES = [t.value for t in AnalysisType]


def assert_record(resp: dict, *, engine_called: bool) -> dict:
    rec = resp["run_record"]
    assert set(rec) == RUN_RECORD_FIELDS
    assert rec["result"] == resp["result"]
    assert len(rec["snapshot_hash"]) == 64 and len(rec["result_hash"]) == 64
    engine_fields = (rec["engine_kind"], rec["engine_version"], rec["engine_git_commit"])
    if engine_called:
        assert rec["engine_kind"] in ("FAKE", "REAL") and all(engine_fields)
    else:
        assert engine_fields == (None, None, None)
    r = resp["result"]
    assert r["status_code"] and r["message"]
    return rec


def _with_m1_ref(api: Api, t: str) -> dict:
    over = {"depends_on": api.m1_ref()} if t not in ("PS", "M1") else {}
    return api.run(t, **over)


@pytest.mark.parametrize("t", ALL_TYPES)
def test_fr_46_feasible_for_every_type(api: Api, t: str) -> None:
    resp = _with_m1_ref(api, t)
    kind = api.engine.identity().engine_kind
    not_yet = kind == "REAL" and t not in ("PS", "M1", "M2")  # Doc 9 D-54 K81
    assert resp["result"]["status"] == ("UNAVAILABLE" if not_yet else "FEASIBLE")
    codes = [w["code"] for w in resp["result"]["warnings"]]
    assert ("ENGINE_KIND_FAKE" in codes) == (kind == "FAKE")
    assert assert_record(resp, engine_called=True)["engine_kind"] == kind


@pytest.mark.parametrize(
    ("t", "outcome", "status"),
    [
        ("M2", Outcome.INFEASIBLE, "INFEASIBLE"),
        ("M1", Outcome.SOLVER_FAILED, "SOLVER_FAILED"),
        ("M1", Outcome.PHYSICALLY_INADMISSIBLE, "PHYSICALLY_INADMISSIBLE"),
        ("M4a", Outcome.SOLVER_FAILED, "SOLVER_FAILED"),
        ("M1", Outcome.INPUT_INVALID, "INPUT_INVALID"),
        ("M1", Outcome.NOT_APPLICABLE, "UNAVAILABLE"),
    ],
)
def test_fr_35_engine_statuses_reach_the_client(
    api_factory: Callable[..., Api], t: str, outcome: Outcome, status: str
) -> None:
    api = api_factory(script={AnalysisType(t): ScriptEntry(outcome)})
    resp = _with_m1_ref(api, t) if t != "M1" else api.run(t)
    assert resp["result"]["status"] == status
    assert_record(resp, engine_called=True)
    if outcome is Outcome.NOT_APPLICABLE:
        assert resp["result"]["status_code"] == "NOT_APPLICABLE"


def test_fr_21_physically_inadmissible_not_rejected_by_app(api_factory: Callable[..., Api]) -> None:
    api = api_factory(script={AnalysisType.M1: ScriptEntry(Outcome.PHYSICALLY_INADMISSIBLE)})
    assert api.run("M1")["result"]["status"] == "PHYSICALLY_INADMISSIBLE"


def test_fr_36_three_failure_messages_distinct(api_factory: Callable[..., Api]) -> None:
    msgs = set()
    for t, o in [("M1", Outcome.SOLVER_FAILED), ("M1", Outcome.PHYSICALLY_INADMISSIBLE)]:
        msgs.add(api_factory(script={AnalysisType(t): ScriptEntry(o)}).run(t)["result"]["message"])
    api = api_factory(script={AnalysisType.M2: ScriptEntry(Outcome.INFEASIBLE)})
    msgs.add(_with_m1_ref(api, "M2")["result"]["message"])
    assert len(msgs) == 3


def test_fr_17_input_invalid_zero_engine_calls(api: Api) -> None:
    snap = api.body("M1")["project_snapshot"]
    snap["loads"][0]["p_kw"] = -1.0
    resp = api.run("M1", project_snapshot=snap)
    assert resp["result"]["status"] == "INPUT_INVALID"
    assert resp["result"]["payload"] is None
    assert resp["result"]["diagnostics"]["issues"][0]["code"] == "NEGATIVE_POWER"
    assert_record(resp, engine_called=False)
    assert api.engine.call_log == []  # type: ignore[attr-defined]


def test_fr_20_all_issues_listed(api: Api) -> None:
    snap = api.body("M1")["project_snapshot"]
    snap["loads"][0]["p_kw"] = -1.0
    snap["inverters"][0]["rated_kva"] = 0.0
    resp = api.run("M1", project_snapshot=snap)
    codes = {i["code"] for i in resp["result"]["diagnostics"]["issues"]}
    assert {"NEGATIVE_POWER", "NOT_POSITIVE"} <= codes
    assert resp["result"]["status_code"] == "MULTIPLE_ISSUES"


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (
            lambda s: s["loads"][0].update(power_factor=0.9, pf_direction="LAGGING"),
            "LOAD_Q_AMBIGUOUS",
        ),
        (lambda s: s["lines"].clear(), "ISOLATED_BUS"),
        (lambda s: s["inverters"].clear(), "NO_INVERTER"),
        (lambda s: s["lines"].append({**s["lines"][0], "id": "L2"}), "DUPLICATE_LINE"),
        (lambda s: s["buses"].append({"id": "B1"}), "DUPLICATE_ID"),
        (lambda s: s["loads"][0].update(bus_id="NOPE"), "DANGLING_BUS_REF"),
        (
            lambda s: s["design_constraints"].update(voltage_min_pu=1.1, voltage_max_pu=1.0),
            "BAND_INVERTED",
        ),
    ],
)
def test_fr_19_stage1_codes(api: Api, mutate: Callable[[dict], object], code: str) -> None:
    snap = api.body("M1")["project_snapshot"]
    mutate(snap)
    resp = api.run("M1", project_snapshot=snap)
    assert code in {i["code"] for i in resp["result"]["diagnostics"]["issues"]}
    assert api.engine.call_log == []  # type: ignore[attr-defined]


def test_malformed_request_is_input_invalid_not_422(api: Api) -> None:
    body = api.body("M1")
    body["project_snapshot"]["nominal_voltage_kv"] = "high"
    r = api.post("M1", body)
    assert r.status_code == 200
    resp = r.json()
    assert resp["result"]["status"] == "INPUT_INVALID"
    assert resp["result"]["status_code"] == "MALFORMED_REQUEST"
    assert_record(resp, engine_called=False)


def test_unknown_field_is_malformed(api: Api) -> None:
    r = api.post("M1", {**api.body("M1"), "analysis_type": "M2"})
    assert r.status_code == 200 and r.json()["result"]["status_code"] == "MALFORMED_REQUEST"


def test_depends_on_not_allowed_on_m1(api: Api) -> None:
    resp = api.run("M1", depends_on=api.m1_ref())
    codes = {i["code"] for i in resp["result"]["diagnostics"]["issues"]}
    assert "DEPENDS_ON_NOT_ALLOWED" in codes


def test_fr_43_timeout_returns_unavailable_with_runrecord(api_factory: Callable[..., Api]) -> None:
    api = api_factory(
        script={AnalysisType.M1: ScriptEntry(delay_s=0.5)}, limits=Limits(time_budget_s=0.05)
    )
    resp = api.run("M1")
    assert (resp["result"]["status"], resp["result"]["status_code"]) == ("UNAVAILABLE", "TIMEOUT")
    assert "ENGINE_KIND_FAKE" in [w["code"] for w in resp["result"]["warnings"]]
    assert_record(resp, engine_called=True)


def test_engine_exception_is_engine_error_never_solver_failed(
    api_factory: Callable[..., Api],
) -> None:
    api = api_factory(script={AnalysisType.M1: ScriptEntry(raise_error=True)})
    resp = api.run("M1")
    assert (resp["result"]["status"], resp["result"]["status_code"]) == (
        "UNAVAILABLE",
        "ENGINE_ERROR",
    )
    assert_record(resp, engine_called=True)


def test_disallowed_status_is_engine_error(api_factory: Callable[..., Api]) -> None:
    api = api_factory(script={AnalysisType.M1: ScriptEntry(Outcome.INFEASIBLE)})
    resp = api.run("M1")
    assert (resp["result"]["status"], resp["result"]["status_code"]) == (
        "UNAVAILABLE",
        "ENGINE_ERROR",
    )


def test_fr_42_no_job_or_polling_route(api: Api) -> None:
    paths = set(api.client.get("/api/openapi.json").json()["paths"])
    assert not any("job" in p or "status" in p for p in paths)


def test_result_hash_covers_status_and_payload_only(api: Api) -> None:
    from fixtures.reference_canonical import sha256

    resp = api.run("M1")
    r = resp["result"]
    assert resp["run_record"]["result_hash"] == sha256(
        {"status": r["status"], "payload": r["payload"]}
    )


def test_engine_identity_in_run_record(api: Api) -> None:
    ident = api.engine.identity()
    rec = api.run("M1")["run_record"]
    assert rec["engine_version"] == ident.engine_version
