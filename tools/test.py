"""Run test seams (Doc 8 §4.1).

Usage: python tools/test.py [seam ...]
Seams: api contract reproducibility project_file static client e2e.
Without arguments runs every seam except e2e.
"""

from __future__ import annotations

import sys

from _common import BACKEND, FRONTEND, ROOT, node_env, npm, run, uv

PY_SEAMS = ["static", "contract", "api", "reproducibility", "project_file"]


def main(argv: list[str]) -> int:
    seams = argv or [*PY_SEAMS, "client"]
    rc = 0
    py = [s for s in seams if s in PY_SEAMS]
    if py:
        paths = [str(ROOT / "tests" / s) for s in py]
        rc |= run(
            [
                uv(),
                "run",
                "--project",
                str(BACKEND),
                "pytest",
                "-c",
                str(BACKEND / "pyproject.toml"),
                "--rootdir",
                str(ROOT),
                *paths,
            ],
            ROOT,
        )
    if "client" in seams:
        rc |= run([npm(), "test", "--", "--passWithNoTests"], FRONTEND, node_env())
    if "e2e" in seams:
        rc |= run([npm(), "run", "e2e"], FRONTEND, node_env())
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
