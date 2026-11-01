"""Shared canonicalisation vectors (Doc 9 D-45 K4): the server canonicaliser and the browser
port (frontend/store/canonical.test.ts) must give the same text and SHA-256."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mgapp.services.canonical import canonical_json, normalise_raw, sha256_hex

VECTORS = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "canonical_vectors.json").read_text("utf-8")
)


@pytest.mark.parametrize("vec", VECTORS)
def test_server_canonicaliser_matches_shared_vectors(vec: dict) -> None:
    value = normalise_raw(vec["value"])
    assert canonical_json(value) == vec["canonical"]
    assert sha256_hex(value) == vec["sha256"]
