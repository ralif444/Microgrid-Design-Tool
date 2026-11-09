"""Method registry (guideline §5.1, D13): method_id → implementation; v1 has one method."""

from __future__ import annotations

from typing import Protocol

from mgapp.services.cable_sizing.method import (
    CableSizingSettings,
    ElementSizing,
    Iec60364OverloadPuil2011,
    SizingElement,
)
from mgapp.services.cable_sizing.tables import CableTables, TableIssue


class SizingMethod(Protocol):
    method_id: str

    def validate(self, settings: CableSizingSettings, tables: CableTables) -> list[TableIssue]: ...

    def size(
        self, elements: list[SizingElement], settings: CableSizingSettings, tables: CableTables
    ) -> list[ElementSizing]: ...


_METHODS: dict[str, SizingMethod] = {m.method_id: m for m in [Iec60364OverloadPuil2011()]}


def method_ids() -> list[str]:
    return list(_METHODS)


def get_method(method_id: str) -> SizingMethod:
    """Raises KeyError for an unknown method_id."""
    return _METHODS[method_id]
