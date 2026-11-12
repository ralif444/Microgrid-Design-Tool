"""Base model settings shared by every domain schema (Doc 3 §1)."""

from __future__ import annotations

import math
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict


class Model(BaseModel):
    """Strict wire model: unknown fields refused, numbers finite only (Doc 3 §1)."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, frozen=False)


_MAX_INT_BITS = 1024  # a larger integer has no double value, so it is not a finite JSON number


def all_finite(value: Any) -> bool:
    """No NaN, Infinity or out-of-range integer anywhere in a decoded JSON value (Doc 3 §1)."""
    stack = [value]
    while stack:  # iterative: the depth of a request body is not bounded by this app
        v = stack.pop()
        if isinstance(v, float):
            if not math.isfinite(v):
                return False
        elif isinstance(v, int):
            if v.bit_length() > _MAX_INT_BITS:
                return False
        elif isinstance(v, dict):
            stack.extend(v.values())
        elif isinstance(v, list):
            stack.extend(v)
    return True


def _finite(value: dict[str, Any]) -> dict[str, Any]:
    if not all_finite(value):
        raise ValueError("numbers must be finite")
    return value


FiniteJson = Annotated[dict[str, Any], AfterValidator(_finite)]
"""A free-form JSON object held to the finite-number rule that `Model` applies to typed fields."""
