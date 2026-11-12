"""Cable sizing slice 1: cable_tables.json loader, validator and table_set_hash (guideline §4).

Uses only the FICTITIOUS fixture `FAKE_cable_tables_TEST_ONLY.json` (round numbers, not PUIL).
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from mgapp.services.cable_sizing.tables import (
    TableIssueCode,
    load_tables,
    table_set_hash,
    validate_tables,
)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "FAKE_cable_tables_TEST_ONLY.json"


@pytest.fixture
def raw() -> dict[str, Any]:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def codes(raw: dict[str, Any], method: str = "B1") -> list[TableIssueCode]:
    return [i.code for i in validate_tables(load_tables(raw), method)]


def test_fake_fixture_is_complete(raw: dict[str, Any]) -> None:
    assert codes(raw) == []


def test_unchecked_tables_give_cable_tables_unchecked(raw: dict[str, Any]) -> None:
    raw["source"]["double_entry_checked"] = False
    assert codes(raw) == [TableIssueCode.CABLE_TABLES_UNCHECKED]


def test_empty_in_series_gives_cable_tables_incomplete(raw: dict[str, Any]) -> None:
    raw["device_classes"][1]["in_series_a"] = []
    issues = validate_tables(load_tables(raw), "B1")
    assert [i.code for i in issues] == [TableIssueCode.CABLE_TABLES_INCOMPLETE]
    assert "MCCB" in issues[0].message


def test_missing_method_table_gives_cable_tables_incomplete(raw: dict[str, Any]) -> None:
    issues = validate_tables(load_tables(raw), "C")
    assert [i.code for i in issues] == [TableIssueCode.CABLE_TABLES_INCOMPLETE]
    assert "C" in issues[0].message


def test_both_codes_reported_together(raw: dict[str, Any]) -> None:
    raw["source"]["double_entry_checked"] = False
    raw["device_classes"][0]["in_series_a"] = []
    assert set(codes(raw)) == {
        TableIssueCode.CABLE_TABLES_INCOMPLETE,
        TableIssueCode.CABLE_TABLES_UNCHECKED,
    }


def test_unknown_field_refused(raw: dict[str, Any]) -> None:
    raw["extra"] = 1
    with pytest.raises(ValidationError):
        load_tables(raw)


def test_table_hash_is_lowercase_sha256(raw: dict[str, Any]) -> None:
    assert re.fullmatch(r"[0-9a-f]{64}", table_set_hash(raw))


def test_table_hash_ignores_key_order_and_whitespace(raw: dict[str, Any]) -> None:
    reordered = json.loads(json.dumps(raw, indent=4, sort_keys=True))
    assert table_set_hash(reordered) == table_set_hash(raw)


def test_table_hash_changes_on_edit(raw: dict[str, Any]) -> None:
    edited = copy.deepcopy(raw)
    edited["ampacity"][0]["values_a"]["10"] = 101
    assert table_set_hash(edited) != table_set_hash(raw)
