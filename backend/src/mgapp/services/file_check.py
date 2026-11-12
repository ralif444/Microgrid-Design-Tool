"""File checks for imported Project files and RunRecords (Doc 6 §3.5-3.7, Doc 3 §7-§8).

A FileCheckResult is not a Status. Nothing here modifies the checked content.
Version codes (Doc 9 D-47 K15): newer, missing or non-integer -> UNKNOWN_SCHEMA_VERSION;
older without a migration chain -> UNMIGRATABLE; not the expected shape -> MALFORMED_FILE.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import ValidationError

from mgapp.domain.base import Model
from mgapp.domain.contract import EngineIdentity
from mgapp.domain.enums import EngineKind
from mgapp.domain.run_record import RECORD_SCHEMA_VERSION, RunRecord
from mgapp.services.canonical import snapshot_hash
from mgapp.services.dependency import result_hash


class FileCheckCode(StrEnum):
    OK = "OK"
    MIGRATED = "MIGRATED"
    UNKNOWN_SCHEMA_VERSION = "UNKNOWN_SCHEMA_VERSION"
    UNMIGRATABLE = "UNMIGRATABLE"
    HASH_MISMATCH = "HASH_MISMATCH"
    MALFORMED_FILE = "MALFORMED_FILE"


class FileCheckDetail(Model):
    path: str
    code: FileCheckCode
    message: str


class FileCheckResult(Model):
    accepted: bool
    code: FileCheckCode
    message: str
    details: list[FileCheckDetail] = []


class EngineSide(Model):
    engine_kind: EngineKind | None
    engine_version: str | None
    engine_git_commit: str | None


class EngineComparison(Model):
    stored: EngineSide
    current: EngineSide
    differs: bool | None  # null when a stored value is null (engine not called)


class VerifyResponse(Model):
    file_check: FileCheckResult
    engine_comparison: EngineComparison | None


def refused(
    code: FileCheckCode, message: str, details: list[FileCheckDetail] | None = None
) -> FileCheckResult:
    return FileCheckResult(accepted=False, code=code, message=message, details=details or [])


def schema_errors(exc: ValidationError) -> list[FileCheckDetail]:
    return [
        FileCheckDetail(
            path=".".join(str(x) for x in e["loc"]) or "(root)",
            code=FileCheckCode.MALFORMED_FILE,
            message=e["msg"],
        )
        for e in exc.errors()
    ]


def check_version(raw: dict[str, Any], current: int, kind: str) -> FileCheckResult | None:
    """Version is checked first (Doc 3 §8); None means the version is the current one."""
    v = raw.get("schema_version")
    if not isinstance(v, int) or isinstance(v, bool) or v > current:
        return refused(
            FileCheckCode.UNKNOWN_SCHEMA_VERSION,
            f"This {kind} has an unknown schema version ({v!r}); this app reads version "
            f"{current}. Nothing was loaded.",
        )
    if v < current:  # no migration chain exists yet (FR-56 is Should)
        return refused(
            FileCheckCode.UNMIGRATABLE,
            f"This {kind} uses schema version {v}, which cannot be migrated to version "
            f"{current}. Nothing was loaded.",
        )
    return None


def check_record(raw: Any) -> tuple[FileCheckResult, RunRecord | None]:
    """Schema and both hashes of one RunRecord (FR-50); the record itself is never modified."""
    if not isinstance(raw, dict):
        return refused(FileCheckCode.MALFORMED_FILE, "This file is not a RunRecord."), None
    bad = check_version(raw, RECORD_SCHEMA_VERSION, "RunRecord")
    if bad:
        return bad, None
    try:
        rec = RunRecord.model_validate(raw)
    except ValidationError as exc:
        return refused(
            FileCheckCode.MALFORMED_FILE,
            "This file is not a complete RunRecord.",
            schema_errors(exc),
        ), None
    details = []
    try:
        snap = snapshot_hash(rec.snapshot, rec.scenarios)
    except ValueError:
        snap = ""
    if snap != rec.snapshot_hash:
        details.append(
            FileCheckDetail(
                path="snapshot_hash",
                code=FileCheckCode.HASH_MISMATCH,
                message="The stored input does not match its snapshot hash.",
            )
        )
    if result_hash(rec.result.status, rec.result.payload) != rec.result_hash:
        details.append(
            FileCheckDetail(
                path="result_hash",
                code=FileCheckCode.HASH_MISMATCH,
                message="The stored result does not match its result hash.",
            )
        )
    if details:
        return refused(
            FileCheckCode.HASH_MISMATCH,
            "This RunRecord was changed after it was created, so it cannot be used.",
            details,
        ), None
    return FileCheckResult(
        accepted=True, code=FileCheckCode.OK, message="The RunRecord is intact."
    ), rec


def compare_engine(rec: RunRecord, current: EngineIdentity) -> EngineComparison:
    stored = EngineSide(
        engine_kind=rec.engine_kind,
        engine_version=rec.engine_version,
        engine_git_commit=rec.engine_git_commit,
    )
    cur = EngineSide(**current.model_dump())
    known = None not in (stored.engine_kind, stored.engine_version, stored.engine_git_commit)
    return EngineComparison(stored=stored, current=cur, differs=(stored != cur) if known else None)


def verify(raw: Any, current: EngineIdentity) -> VerifyResponse:
    fc, rec = check_record(raw)
    return VerifyResponse(
        file_check=fc, engine_comparison=compare_engine(rec, current) if rec else None
    )
