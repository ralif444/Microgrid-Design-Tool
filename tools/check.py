"""Static checks: lint, types, import rules (Doc 8 §2, seam 6). Exit non-zero on any failure.

Usage: python tools/check.py
"""

from __future__ import annotations

import sys

from _common import BACKEND, ENGINE, FRONTEND, ROOT, node_bin, node_env, run, uv


def main() -> int:
    steps = [
        ([uv(), "run", "ruff", "format", "--check", ".", "../tests", "../tools"], BACKEND, None),
        ([uv(), "run", "ruff", "check", "."], BACKEND, None),
        (
            [uv(), "run", "ruff", "check", "--config", "pyproject.toml", "../tests", "../tools"],
            BACKEND,
            None,
        ),
        ([uv(), "run", "mypy"], BACKEND, None),
        ([uv(), "run", "lint-imports"], BACKEND, None),
        ([uv(), "run", "ruff", "format", "--check", "."], ENGINE, None),
        ([uv(), "run", "ruff", "check", "."], ENGINE, None),
        ([uv(), "run", "mypy"], ENGINE, None),
        ([sys.executable, str(ROOT / "tools" / "gen.py"), "--check"], ROOT, None),
        ([node_bin("tsc"), "--noEmit"], FRONTEND, node_env()),
        (
            [
                node_bin("depcruise"),
                "--config",
                ".dependency-cruiser.cjs",
                "app",
                "components",
                "store",
                "api-client",
                "api-types",
            ],
            FRONTEND,
            node_env(),
        ),
    ]
    failed = [" ".join(c) for c, cwd, env in steps if run(c, cwd, env) != 0]
    if failed:
        print("\nFAILED:\n  " + "\n  ".join(failed))
        return 1
    print("\nall checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
