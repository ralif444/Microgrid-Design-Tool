"""Seam 6: dependency rules are enforced, and the checkers really catch violations.

NFR-10, NFR-11 (manuscript 4.3.1: import-linter and dependency-cruiser fail the build).
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest
from _common import BACKEND, FRONTEND, node_bin, node_env, uv

SRC = BACKEND / "src"
FIXTURES = Path(__file__).parent / "fixtures"


def _lint_imports(pythonpath: Path | None = None) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
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
        text=True,
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
