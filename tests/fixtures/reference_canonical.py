"""Independent reference canonicaliser for tests (Doc 3 §7 rules), written separately from
`mgapp.services.canonical` so hash tests do not grade the implementation with itself.

Number rule: shortest round-trip digits found by increasing precision, laid out per
ECMAScript Number::toString.
"""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any


def _num(x: float | int) -> str:
    if isinstance(x, int):
        return str(x)
    assert math.isfinite(x)
    if x == 0:
        return "0"
    s = ""
    for p in range(17):  # p digits after the point: 1..17 significant digits
        s = f"{abs(x):.{p}e}"
        if float(s) == abs(x):
            break
    mant, exp = s.split("e")
    digits = mant.replace(".", "").rstrip("0") or "0"
    n = int(exp) + 1
    k = len(digits)
    if k <= n <= 21:
        out = digits + "0" * (n - k)
    elif 0 < n <= 21:
        out = digits[:n] + "." + digits[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * -n + digits
    else:
        e = n - 1
        out = (
            (digits[0] + ("." + digits[1:] if k > 1 else ""))
            + "e"
            + ("+" if e >= 0 else "-")
            + str(abs(e))
        )
    return ("-" if x < 0 else "") + out


def dumps(v: Any) -> str:
    if v is None or isinstance(v, bool):
        return json.dumps(v)
    if isinstance(v, int | float):
        return _num(v)
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        return "[" + ",".join(dumps(x) for x in v) + "]"
    if isinstance(v, dict):
        return (
            "{"
            + ",".join(json.dumps(k, ensure_ascii=False) + ":" + dumps(v[k]) for k in sorted(v))
            + "}"
        )
    raise TypeError(type(v))


def sha256(v: Any) -> str:
    return hashlib.sha256(dumps(v).encode("utf-8")).hexdigest()
