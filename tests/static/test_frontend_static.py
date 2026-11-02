"""Seam 6: frontend is a static export with no server features; fetch only in api-client.

ADR-002 follow-up; Doc 8 §2; NFR-03 (no external assets) is checked on build output in 1.1.6.
"""

from __future__ import annotations

import re
from pathlib import Path

from _common import FRONTEND, ROOT

SOURCE_DIRS = ["app", "components", "store", "api-client", "api-types"]
FETCH = re.compile(r"\bfetch\s*\(")


def fetch_offenders(root: Path) -> list[Path]:
    """Files outside api-client/ that call fetch()."""
    out = []
    for d in SOURCE_DIRS:
        if d == "api-client" or not (root / d).exists():
            continue
        for f in (root / d).rglob("*.ts*"):
            if FETCH.search(f.read_text(encoding="utf-8")):
                out.append(f)
    return out


def test_adr_002_next_config_is_static_export() -> None:
    cfg = (FRONTEND / "next.config.mjs").read_text(encoding="utf-8")
    assert re.search(r"output:\s*[\"']export[\"']", cfg)


def test_adr_002_no_api_routes_or_server_actions() -> None:
    assert not (FRONTEND / "app" / "api").exists()
    for f in (FRONTEND / "app").rglob("*.ts*"):
        text = f.read_text(encoding="utf-8")
        assert '"use server"' not in text and "'use server'" not in text, f
        assert f.name not in {"route.ts", "route.tsx", "middleware.ts"}, f


def test_fetch_only_in_api_client() -> None:
    assert fetch_offenders(FRONTEND) == []


def test_fetch_scan_detects_violation(tmp_path: Path) -> None:
    (tmp_path / "components").mkdir()
    (tmp_path / "components" / "x.tsx").write_text("export const f = () => fetch('/api/health');")
    assert len(fetch_offenders(tmp_path)) == 1


def test_validation_does_not_import_mgapp() -> None:
    """Manuscript 4.3.8: the offline M5 procedure does not import the app package."""
    pattern = re.compile(r"^\s*(from|import)\s+mgapp\b", re.MULTILINE)
    for f in (ROOT / "validation").rglob("*.py"):
        assert not pattern.search(f.read_text(encoding="utf-8")), f
