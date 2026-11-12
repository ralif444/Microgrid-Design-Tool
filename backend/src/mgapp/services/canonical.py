"""Canonicaliser and hasher (component 7; Doc 3 §7, manuscript 4.3.5). Single source of hash truth.

Six rules:
1. UTF-8 JSON without insignificant whitespace;
2. object keys sorted by Unicode code point;
3. entity arrays (buses, lines, loads, inverters) sorted by `id`; other arrays keep order;
4. numbers as the shortest round-trip decimal text in ECMAScript Number-to-String form
   (as RFC 8785 [PERLU VERIFIKASI]); NaN and Infinity refused; -0 written as 0;
   integral values written without a fraction, so 1 and 1.0 are equal;
5. standard JSON string escaping (quote, backslash, control characters; no escaping of
   non-ASCII);
6. SHA-256 in lowercase hex.

Snapshot normalisation (Doc 3 §7 content): fields with value null are omitted
[ASSUMPTION Doc 9 A-56]; bus names and diagram positions are dropped; the server derives
`r_ohm` and `x_ohm` and overwrites client values.
"""

from __future__ import annotations

import hashlib
import json
import math
from decimal import Decimal
from typing import Any

from mgapp.domain.entities import ProjectSnapshot

ENTITY_ARRAYS = frozenset({"buses", "lines", "loads", "inverters"})
_BUS_EXCLUDED = frozenset({"name", "diagram_x", "diagram_y"})


class CanonicalError(ValueError):
    """Value cannot be canonicalised (NaN, Infinity, unsupported type)."""


def format_number(x: float | int) -> str:
    """ECMAScript Number::toString for finite doubles; Python ints as exact integers."""
    if isinstance(x, bool):
        raise CanonicalError("bool is not a number")
    if isinstance(x, int):
        return str(x)
    if not math.isfinite(x):
        raise CanonicalError("NaN and Infinity are not allowed")
    if x == 0:
        return "0"
    sign = "-" if x < 0 else ""
    d = Decimal(repr(abs(x)))  # repr gives the shortest round-trip digits
    digits_t, exp = d.as_tuple().digits, int(d.as_tuple().exponent)
    digits = "".join(map(str, digits_t)).rstrip("0")
    exp += len("".join(map(str, digits_t))) - len(digits)
    k = len(digits)
    n = k + exp  # value = 0.digits × 10^n
    if k <= n <= 21:
        body = digits + "0" * (n - k)
    elif 0 < n <= 21:
        body = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        body = "0." + "0" * (-n) + digits
    else:
        e = n - 1
        es = ("+" if e >= 0 else "-") + str(abs(e))
        body = (digits if k == 1 else digits[0] + "." + digits[1:]) + "e" + es
    return sign + body


def _encode(v: Any) -> str:
    if v is None:
        return "null"
    if v is True:
        return "true"
    if v is False:
        return "false"
    if isinstance(v, int | float):
        return format_number(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, dict):
        if not all(isinstance(k, str) for k in v):
            raise CanonicalError("object keys must be strings")
        items = sorted(v.items(), key=lambda kv: kv[0])
        return (
            "{"
            + ",".join(json.dumps(k, ensure_ascii=False) + ":" + _encode(x) for k, x in items)
            + "}"
        )
    if isinstance(v, list | tuple):
        return "[" + ",".join(_encode(x) for x in v) + "]"
    raise CanonicalError(f"unsupported type {type(v).__name__}")


def canonical_json(value: Any) -> str:
    """Rules 1-5 applied to any JSON-compatible value (rule 3 is applied by `normalise`)."""
    return _encode(value)


def sha256_hex(value: Any) -> str:
    """Rule 6: SHA-256 over the UTF-8 canonical JSON, lowercase hex."""
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def safe_sha256_hex(value: Any) -> str:
    """`sha256_hex`, or the hash of null for a value that cannot be canonicalised."""
    try:
        return sha256_hex(value)
    except ValueError:
        return sha256_hex(None)


def snapshot_hash(snapshot: Any, scenarios: list[Any] | None) -> str:
    """RunRecord.snapshot_hash (Doc 3 §7): the snapshot alone, or with its scenarios (M3c)."""
    return sha256_hex({"snapshot": snapshot, "scenarios": scenarios} if scenarios else snapshot)


def _drop_none(v: Any) -> Any:
    if isinstance(v, dict):
        return {k: _drop_none(x) for k, x in v.items() if x is not None}
    if isinstance(v, list):
        return [_drop_none(x) for x in v]
    return v


def _sort_entities(doc: dict[str, Any]) -> dict[str, Any]:
    out = dict(doc)
    for key in ENTITY_ARRAYS & out.keys():
        if isinstance(out[key], list):
            out[key] = sorted(
                out[key], key=lambda e: str(e.get("id", "")) if isinstance(e, dict) else ""
            )
    return out


def normalise_snapshot(snapshot: ProjectSnapshot) -> dict[str, Any]:
    """Canonical snapshot content (Doc 3 §7) from a parsed snapshot."""
    s = snapshot.model_copy(deep=True)
    for ln in s.lines:
        ln.r_ohm = (
            ln.r_ohm_per_km * ln.length_km
            if ln.r_ohm_per_km is not None and ln.length_km is not None
            else None
        )
        ln.x_ohm = (
            ln.x_ohm_per_km * ln.length_km
            if ln.x_ohm_per_km is not None and ln.length_km is not None
            else None
        )
    doc = s.model_dump(mode="json")
    doc["buses"] = [{k: v for k, v in b.items() if k not in _BUS_EXCLUDED} for b in doc["buses"]]
    return _sort_entities(_drop_none(doc))


def normalise_raw(raw: Any) -> Any:
    """Best-effort canonical form of a snapshot that failed to parse (MALFORMED_REQUEST)."""
    if isinstance(raw, dict):
        return _sort_entities(_drop_none(raw))
    return raw
