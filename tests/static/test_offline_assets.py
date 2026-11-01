"""Seam 6: built UI loads nothing from outside the machine (NFR-03); one start command (NFR-02)."""

from __future__ import annotations

import re

import pytest
from _common import BACKEND, ROOT

STATIC = BACKEND / "src" / "mgapp" / "static"
EXTERNAL = re.compile(
    r"""(?:src|href)\s*=\s*["']https?://|@import\s+url\(\s*["']?https?://|url\(\s*["']?https?://"""
)


def test_nfr_03_no_external_assets_in_build() -> None:
    files = [*STATIC.rglob("*.html"), *STATIC.rglob("*.css")]
    if not files:
        pytest.skip("frontend not built (python tools/build_frontend.py)")
    offenders = [str(f) for f in files if EXTERNAL.search(f.read_text(encoding="utf-8"))]
    assert offenders == []


def test_external_asset_pattern_detects_cdn() -> None:
    assert EXTERNAL.search('<link href="https://cdn.example/x.css">')
    assert not EXTERNAL.search('<link href="/_next/static/x.css">')


def test_nfr_02_start_procedure_has_one_command() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    start = readme.split("## Start", 1)[1].split("##", 1)[0]
    commands = [ln for ln in start.splitlines() if ln.strip().startswith("uv run")]
    assert commands == ["uv run --project backend mgapp"]
