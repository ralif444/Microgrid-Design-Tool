"""WP 1.1.3: the Engine Port contract suite (NFR-07, NFR-08, FR-22, FR-35).

The suite passes on the Fake Engine (default and every scripted allowed outcome) and
fails on each defect of the defective Fake profile.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import pytest
from contract.suite import run_suite

from mgapp.adapters.fake_engine import FakeEngine, Outcome, ScriptEntry
from mgapp.adapters.fake_engine.defective import Defect, DefectiveFakeEngine
from mgapp.domain.enums import ALLOWED_STATUS, AnalysisType, Status
from mgapp.engine_port import EnginePort

# Adapters under test. The Real Engine adapter is added here at stage 1.4 (WP 1.4.2).
ADAPTERS: dict[str, Callable[[], EnginePort]] = {"FAKE": FakeEngine}

OUTCOME_STATUS = {
    Outcome.FEASIBLE: Status.FEASIBLE,
    Outcome.INFEASIBLE: Status.INFEASIBLE,
    Outcome.SOLVER_FAILED: Status.SOLVER_FAILED,
    Outcome.PHYSICALLY_INADMISSIBLE: Status.PHYSICALLY_INADMISSIBLE,
    Outcome.INPUT_INVALID: Status.INPUT_INVALID,
    Outcome.NOT_APPLICABLE: Status.UNAVAILABLE,
}


@pytest.mark.parametrize("name", list(ADAPTERS))
def test_nfr_08_adapter_passes_contract_suite(name: str, tmp_path: Path) -> None:
    assert run_suite(ADAPTERS[name](), tmp_path) == []


ALLOWED_SCRIPTS = [
    (t, o) for t in AnalysisType for o in Outcome if OUTCOME_STATUS[o] in ALLOWED_STATUS[t]
]


@pytest.mark.parametrize(("t", "outcome"), ALLOWED_SCRIPTS, ids=lambda x: str(x))
def test_nfr_07_fake_passes_suite_for_every_allowed_outcome(
    t: AnalysisType, outcome: Outcome, tmp_path: Path
) -> None:
    eng = FakeEngine(script={t: ScriptEntry(outcome)})
    assert run_suite(eng, tmp_path, types=[t]) == []


def test_fr_22_m1_infeasible_rejected_by_suite(tmp_path: Path) -> None:
    eng = FakeEngine(script={AnalysisType.M1: ScriptEntry(Outcome.INFEASIBLE)})
    found = run_suite(eng, tmp_path, types=[AnalysisType.M1])
    assert any(v.behaviour == "C2" for v in found)


@pytest.mark.parametrize("defect", list(Defect))
def test_suite_fails_on_defective_profile(defect: Defect, tmp_path: Path) -> None:
    """Negative test of the suite itself (manuscript 4.5.1)."""
    found = run_suite(DefectiveFakeEngine(defect), tmp_path)
    assert found, f"suite did not detect {defect}"
    assert defect.value in {v.behaviour for v in found}, found
