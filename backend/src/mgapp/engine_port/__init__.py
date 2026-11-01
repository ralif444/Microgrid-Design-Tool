"""Engine Port (Doc 4 §5, manuscript 4.3.2, Tabel D.1): the single boundary to every calculation.

Two operations. Every adapter obeys the seven rules:
1. stateless between calls (M1 travels in the request);
2. deterministic;
3. never creates a RunRecord;
4. failures as status, code and message, never exceptions;
5. reports engine kind, version and commit;
6. does not handle the time budget (the execution guard does);
7. contract units (the Real Engine adapter converts).
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from mgapp.domain.contract import AnalysisRequest, AnalysisResult, EngineIdentity


@runtime_checkable
class EnginePort(Protocol):
    def run(self, request: AnalysisRequest) -> AnalysisResult:
        """Run one analysis; a Status for every outcome (rule 4).

        A type the adapter does not support returns UNAVAILABLE / NOT_APPLICABLE.
        """
        ...

    def identity(self) -> EngineIdentity:
        """Report engine kind, version and git commit (rule 5)."""
        ...


__all__ = ["EnginePort"]
