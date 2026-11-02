"""Seam 6: dependency rules are enforced, and the checkers really catch violations.

NFR-10, NFR-11 (manuscript 4.3.1: import-linter and dependency-cruiser fail the build).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest
from _common import BACKEND, ENGINE, FRONTEND, node_bin, node_env, uv

SRC = BACKEND / "src"
FIXTURES = Path(__file__).parent / "fixtures"


def _lint_imports(pythonpath: Path | None = None) -> subprocess.CompletedProcess[str]:
    # Windows: the child's stdout codepage depends on the console; pin UTF-8 on both sides.
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    if pythonpath is not None:
        env["PYTHONPATH"] = str(pythonpath)
    return subprocess.run(
        [
            uv(),
            "run",
            "--project",
            str(BACKEND),
            "lint-imports",
            "--config",
            str(BACKEND / "pyproject.toml"),
            "--no-cache",
        ],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        encoding="utf-8",
    )


def test_nfr_10_11_python_import_rules_pass() -> None:
    r = _lint_imports()
    assert r.returncode == 0, r.stdout + r.stderr


VIOLATIONS = [
    # (module path inside mgapp, import line, contract expected to break)
    ("domain/_violation.py", "import mgapp.services", "domain is the inner module"),
    ("services/_violation.py", "import mgapp.engine_port", "only the execution guard"),
    ("services/_violation2.py", "import mgapp.adapters.fake_engine", "services never import"),
    ("api/_violation.py", "import mgapp.engine_port", "api never imports"),
    ("adapters/fake_engine/_violation.py", "import mgapp.adapters.real_engine", "independent"),
]


@pytest.mark.parametrize(("rel", "line", "contract"), VIOLATIONS)
def test_nfr_10_11_import_linter_detects_violation(
    tmp_path: Path, rel: str, line: str, contract: str
) -> None:
    """Negative test: a deliberate violation in a copy of the package must break a contract."""
    shutil.copytree(SRC / "mgapp", tmp_path / "mgapp")
    (tmp_path / "mgapp" / rel).write_text(line + "\n")
    r = _lint_imports(pythonpath=tmp_path)
    out = r.stdout + r.stderr
    assert r.returncode != 0, out
    assert contract in out and "BROKEN" in out, out


def _depcruise(cwd: Path) -> subprocess.CompletedProcess[str]:
    dirs = [
        d for d in ("app", "components", "store", "api-client", "api-types") if (cwd / d).exists()
    ]
    return subprocess.run(
        [node_bin("depcruise"), "--config", str(FRONTEND / ".dependency-cruiser.cjs"), *dirs],
        cwd=cwd,
        env=node_env(),
        capture_output=True,
        text=True,
    )


def test_nfr_10_11_frontend_boundaries_pass() -> None:
    r = _depcruise(FRONTEND)
    assert r.returncode == 0, r.stdout + r.stderr


def test_nfr_10_11_dependency_cruiser_detects_violation(tmp_path: Path) -> None:
    """Negative test: fixture with store -> components and api-client -> store imports."""
    fixture = FIXTURES / "frontend_violation"
    shutil.copytree(fixture, tmp_path / "fe")
    shutil.copy(FRONTEND / "tsconfig.json", tmp_path / "fe" / "tsconfig.json")
    r = _depcruise(tmp_path / "fe")
    out = r.stdout + r.stderr
    assert r.returncode != 0, out
    assert "store-isolated" in out and "api-client-isolated" in out, out


_IMPORT = re.compile(r"^\s*(?:import|from)\s+(\w+)", re.MULTILINE)


def _imported_roots(root: Path) -> dict[Path, set[str]]:
    return {p: set(_IMPORT.findall(p.read_text(encoding="utf-8"))) for p in root.rglob("*.py")}


def test_d49_engine_reached_only_through_real_engine_adapter() -> None:
    """D-49 K26: only adapters/real_engine imports mgengine; the engine never imports mgapp."""
    adapter = SRC / "mgapp" / "adapters" / "real_engine"
    app = [p for p, mods in _imported_roots(SRC / "mgapp").items() if "mgengine" in mods]
    assert [p for p in app if adapter not in p.parents] == []
    eng = _imported_roots(ENGINE / "src")
    assert eng and [p for p, mods in eng.items() if "mgapp" in mods] == []
