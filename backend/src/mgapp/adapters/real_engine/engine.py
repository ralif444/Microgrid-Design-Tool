"""Real Engine adapter (WP 1.4.1, 1.5.4; Doc 9 D-51, D-54, D-55).

Calls `mgengine` in SI, converts to contract units, maps engine Status/Code 1:1 to the
contract (the names match, Doc 3 §5.4). Any exception becomes UNAVAILABLE / ENGINE_ERROR
(Engine Port rule 4). PS, M1, M2 here; M3a–M3d, M4a, M4b in `studies.py`.
"""

from __future__ import annotations

import logging
import math
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import mgengine
from mgengine import m1 as e_m1
from mgengine import m2 as e_m2
from mgengine import ps as e_ps
from mgengine.results import m1_details
from mgengine.types import Status as EStatus

from mgapp.adapters.real_engine import convert as cv
from mgapp.adapters.real_engine import studies
from mgapp.adapters.real_engine.studies import constraint
from mgapp.adapters.real_engine.studies import result as _result
from mgapp.domain.contract import (
    MSG_ENGINE_ERROR,
    AnalysisRequest,
    AnalysisResult,
    EngineIdentity,
    Warning,
)
from mgapp.domain.enums import (
    AnalysisType,
    ConstraintKind,
    EngineKind,
    Status,
    StatusCode,
    WarningCode,
)
from mgapp.domain.payloads import (
    BusResult,
    InverterPlan,
    InverterResult,
    InverterSizing,
    LineResult,
    LineSizing,
    Loadability,
    M1Payload,
    M2Payload,
    NotEvaluated,
    PsPayload,
    RequiredInverter,
    SharingResult,
    SizingCheck,
    SizingStorage,
    StorageEnergy,
    StorageStage,
    Verdict,
)

log = logging.getLogger("mgapp.real_engine")

SWEEP_CAP = 1000  # λ-trace point cap = MetaInfo sweep cap (D-51 K44)

_M1_MESSAGES = {
    EStatus.SOLVER_FAILED: "The power flow did not converge ({code}). This is a calculation "
    "problem, not a limit violation. Check inverter droop and line data, then run again.",
    EStatus.PHYSICALLY_INADMISSIBLE: "The power flow converged to a point that is not physical "
    "(a bus voltage ≤ 0). Review loads, ratings and impedances.",
    EStatus.INPUT_INVALID: "The engine rejected the input ({code}). Correct the input.",
}


def engine_commit() -> str:
    """Last commit touching the engine package (D-54 K75); "unknown" outside a git checkout."""
    root = Path(mgengine.__file__).resolve().parents[2]
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%H", "--", "."],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return "unknown"
    return out or "unknown"


def _storage_assumptions(st: e_ps.StorageEnergy) -> list[str]:
    if st.stage is e_ps.StorageStage.AC:
        return ["η_dc absent: E_dc and E_nom not computed."]
    if st.stage is e_ps.StorageStage.DC:
        return ["DoD absent: E_nom not computed."]
    return []


def _kwh(x: float | None) -> float | None:
    return None if x is None else x / 1e3


@dataclass
class RealEngine:
    max_points: int = SWEEP_CAP
    _identity: EngineIdentity = field(init=False)

    def __post_init__(self) -> None:
        self._identity = EngineIdentity(
            engine_kind=EngineKind.REAL,
            engine_version=mgengine.__version__,
            engine_git_commit=engine_commit(),
        )

    def identity(self) -> EngineIdentity:
        return self._identity

    def run(self, request: AnalysisRequest) -> AnalysisResult:
        t = request.analysis_type
        try:
            if t is AnalysisType.PS:
                return self._ps(request)
            if t is AnalysisType.M1:
                return self._m1(request)
            if t is AnalysisType.M2:
                return self._m2(request)
            if t is AnalysisType.M3A:
                return studies.m3a(request)
            if t is AnalysisType.M3B:
                return studies.m3b(request, self.max_points)
            if t is AnalysisType.M3C:
                return studies.m3c(request)
            if t is AnalysisType.M3D:
                return studies.m3d(request, self.max_points)
            if t is AnalysisType.M4A:
                return studies.m4a(request)
            return studies.m4b(request)
        except Exception:  # noqa: BLE001 - rule 4: never raise; e.g. m2.ImplementationError (K45)
            log.exception("Real Engine failed on %s", t)
            return _result(Status.UNAVAILABLE, StatusCode.ENGINE_ERROR, MSG_ENGINE_ERROR)

    # ------------------------------------------------------------------ PS (Doc 3 §6.1)
    def _ps(self, req: AnalysisRequest) -> AnalysisResult:
        s, p = req.project_snapshot, req.parameters
        net = cv.network(s)
        prof = s.load_profile
        profile_w = (
            tuple(cv.num(v.p_kw) * 1e3 for v in sorted(prof.values, key=lambda v: cv.num(v.hour)))
            if prof is not None and prof.values
            else None
        )
        r = e_ps.ps(
            net.loads,
            float(p["inverter_margin_ratio"]),
            int(p["unit_count"]),
            int(p["redundancy"]),
            profile_w,
            p.get("autonomy_h"),
            p.get("dc_efficiency_ratio"),
            p.get("depth_of_discharge_ratio"),
        )
        storage = None
        no_storage = []
        if r.storage is not None:
            storage = StorageEnergy(
                e_ac_kwh=r.storage.e_ac_wh / 1e3,
                e_dc_kwh=_kwh(r.storage.e_dc_wh),
                e_nom_kwh=_kwh(r.storage.e_nom_wh),
                stage=StorageStage(r.storage.stage.value),
                basis="Worst circular window of autonomy_h hours of the LoadProfile (Eq. 4.4), "
                "then Eq. 4.13 as far as η_dc and DoD are given.",
                assumptions=_storage_assumptions(r.storage),
            )
        else:
            no_storage = ["No storage energy: LoadProfile or autonomy_h not given."]
        payload = PsPayload(
            load_apparent_kva=r.load_apparent_va / 1e3,
            required_inverter_kva=RequiredInverter(
                value_kva=r.required_inverter_va / 1e3,
                basis="S_inv = S_L(1 + m_inv) with S_L the vector sum of the Load table (Eq. 4.2).",
                assumptions=["Line losses are not included; m_inv must absorb them.", *no_storage],
            ),
            inverter_plan=InverterPlan(
                unit_count=r.unit_count,
                redundancy=r.redundancy,
                unit_rating_kva=r.unit_rating_va / 1e3,
                installed_kva=r.installed_va / 1e3,
                basis="S_unit = 0.1⌈S_inv / (0.1(n − r))⌉ kVA, S_inst = n · S_unit (Eq. 4.3).",
                assumptions=["Equal unit ratings; no rounding to catalogue ratings."],
            ),
            storage_energy=storage,
            profile_peak_kw=_kwh(r.profile_peak_w),  # W → kW, same factor
        ).model_dump(mode="json")
        warnings = []
        if r.profile_peak_above_loads:
            warnings.append(
                Warning(
                    code=WarningCode.PROFILE_PEAK_ABOVE_LOADS,
                    message="The LoadProfile peak is above the sum of the Load table; "
                    "the advice uses the Load table.",
                    path="payload.profile_peak_kw",
                )
            )
        return _result(
            Status.FEASIBLE,
            StatusCode.OK,
            "Sizing advice produced from the load data (Eq. 4.2–4.4).",
            payload,
            warnings=warnings,
        )

    # ------------------------------------------------------------------ M1 (Doc 3 §6.2)
    def _m1(self, req: AnalysisRequest) -> AnalysisResult:
        s = req.project_snapshot
        net = cv.network(s)
        res = e_m1.solve_m1(net, cv.solver(req.solver_config))
        diag = {"iterations": res.iterations, "max_mismatch": res.max_mismatch}
        if res.status is not EStatus.FEASIBLE:
            msg = _M1_MESSAGES[res.status].format(code=res.code.value)
            return _result(
                Status(res.status.value), StatusCode(res.code.value), msg, diagnostics=diag
            )
        assert res.v_v is not None and res.theta_rad is not None and res.omega_rad_s is not None
        d = m1_details(net, res, cv.omega_nom(s))
        vb = cv.v_phase(s.nominal_voltage_kv)
        payload = M1Payload(
            system_frequency_hz=res.omega_rad_s / cv.TWO_PI,
            bus_results=[
                BusResult(
                    bus_id=b,
                    voltage_kv=v * cv.SQRT3 / 1e3,
                    voltage_pu=v / vb,
                    angle_deg=math.degrees(th),
                )
                for b, v, th in zip(net.buses, res.v_v, res.theta_rad, strict=True)
            ],
            inverter_results=[
                InverterResult(
                    inverter_id=o.inverter_id,
                    p_kw=o.p_w / 1e3,
                    q_kvar=o.q_var / 1e3,
                    s_kva=o.s_va / 1e3,
                    loading_ratio=o.loading_ratio,
                )
                for o in d.inverters
            ],
            line_results=[
                LineResult(
                    line_id=lf.line_id,
                    p_from_kw=lf.p_from_w / 1e3,
                    q_from_kvar=lf.q_from_var / 1e3,
                    p_to_kw=lf.p_to_w / 1e3,
                    q_to_kvar=lf.q_to_var / 1e3,
                    current_a=lf.current_a,
                    losses_kw=lf.losses_w / 1e3,
                )
                for lf in d.lines
            ],
            total_load_kw=d.total_load_w / 1e3,
            total_load_kvar=d.total_load_var / 1e3,
            total_losses_kw=d.total_losses_w / 1e3,
            iterations=res.iterations,
            epsilon_x_ratio=d.epsilon_x_ratio,
            sharing=[
                SharingResult(
                    inverter_id=sh.inverter_id,
                    p_deviation_kw=sh.dp_w / 1e3,
                    q_deviation_kvar=sh.dq_var / 1e3,
                    p_error_pu=sh.e_p_ratio,
                    q_error_pu=sh.e_q_ratio,
                    q_droop_not_rating_proportional=sh.q_droop_not_rating_proportional,
                )
                for sh in d.sharing
            ],
        ).model_dump(mode="json")
        return _result(
            Status.FEASIBLE,
            StatusCode.OK,
            "Power flow completed: an operating point was found.",
            payload,
            diagnostics=diag,
        )

    # ------------------------------------------------------------------ M2 (Doc 3 §6.3)
    def _m2(self, req: AnalysisRequest) -> AnalysisResult:
        s, p = req.project_snapshot, req.parameters
        r = e_m2.solve_m2(
            cv.network(s),
            cv.limits(s),
            cv.omega_nom(s),
            float(p["inverter_margin_ratio"]),
            float(p["line_margin_ratio"]),
            self.max_points,
            p.get("autonomy_h"),
            p.get("dc_efficiency_ratio"),
            p.get("depth_of_discharge_ratio"),
            cv.solver(req.solver_config),
        )

        margins = [constraint(c, s) for c in r.constraints]
        violated = [m for m, c in zip(margins, r.constraints, strict=True) if c.violated]
        storage = None
        assumptions = ["Rating headroom is advisory; a short rating is a warning, not a breach."]
        if r.storage is not None:
            storage = SizingStorage(
                e_ac_kwh=r.storage.e_ac_wh / 1e3,
                e_dc_kwh=_kwh(r.storage.e_dc_wh),
                e_nom_kwh=_kwh(r.storage.e_nom_wh),
                stage=StorageStage(r.storage.stage.value),
                basis="E_ac = P_demand · t_aut with P_demand the M1 total load, then Eq. 4.13.",
            )
            assumptions += _storage_assumptions(r.storage)
        else:
            assumptions.append("autonomy_h not given: no storage check.")
        lo = r.loadability
        payload = M2Payload(
            verdict=Verdict(r.verdict.value),
            constraint_margins=margins,
            not_evaluated=[
                NotEvaluated(kind=ConstraintKind(k.value), element_id=e) for k, e in r.not_evaluated
            ],
            sizing_check=SizingCheck(
                per_inverter=[
                    InverterSizing(
                        inverter_id=i.inverter_id,
                        s_kva=i.s_va / 1e3,
                        required_rating_kva=i.required_rating_va / 1e3,
                        headroom_kva=i.headroom_va / 1e3,
                        rating_margin_short=i.rating_margin_short,
                    )
                    for i in r.per_inverter
                ],
                per_line=[
                    LineSizing(
                        line_id=ln.line_id,
                        current_a=ln.current_a,
                        required_current_a=ln.required_current_a,
                    )
                    for ln in r.per_line
                ],
                storage=storage,
                basis="S_req = S(1 + m_inv), h = S_rated − S_req, I_req = I(1 + m_line) at the M1 "
                "operating point (Eq. 4.12).",
                assumptions=assumptions,
            ),
            loadability=Loadability(
                lambda_c=lo.lambda_c,
                lambda_s=lo.lambda_s,
                lambda_ub=lo.lambda_ub,
                resolution=lo.resolution,
                grid_step=lo.grid_step,
                stop_reason=lo.stop_reason,
            ),
        ).model_dump(mode="json")
        warnings = []
        short = [i.inverter_id for i in r.per_inverter if i.rating_margin_short]
        if short:
            warnings.append(
                Warning(
                    code=WarningCode.RATING_MARGIN_SHORT,
                    message=f"Rating below the required rating with margin: {', '.join(short)}.",
                    path="payload.sizing_check.per_inverter",
                )
            )
        if r.not_evaluated:
            warnings.append(
                Warning(
                    code=WarningCode.CONSTRAINT_NOT_EVALUATED,
                    message=f"{len(r.not_evaluated)} check(s) not evaluated: their limit is "
                    "empty. They are not counted as satisfied.",
                    path="payload.not_evaluated",
                )
            )
        diag = {"loadability_points": lo.points}
        if violated:
            return _result(
                Status.INFEASIBLE,
                StatusCode.CONSTRAINT_VIOLATED,
                f"The design violates {len(violated)} constraint(s). Change the element named "
                "first, then run M1 and M2 again.",
                payload,
                violated,
                warnings,
                diag,
            )
        return _result(
            Status.FEASIBLE,
            StatusCode.OK,
            "The design meets all evaluated constraints.",
            payload,
            warnings=warnings,
            diagnostics=diag,
        )
