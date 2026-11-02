"""Base model settings shared by every domain schema (Doc 3 §1)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class Model(BaseModel):
    """Strict wire model: unknown fields refused, numbers finite only (Doc 3 §1)."""

    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, frozen=False)
