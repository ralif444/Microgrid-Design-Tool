"""Run test seams (Doc 8 §4.1).

Usage: python tools/test.py [seam ...]
Seams: engine api contract reproducibility project_file static client e2e.
Without arguments runs every seam except e2e (needs `python tools/build_frontend.py`).
"""

from __future__ import annotations

import sys

from _common import BACKEND, ENGINE, FRONTEND, ROOT, node_env, npm, run, uv

PY_SEAMS = ["static", "contract", "api", "reproducibility", "project_file", "e2e"]


def main(argv: list[str]) -> int:
    seams = argv or ["engine", *(s for s in PY_SEAMS if s != "e2e"), "client"]
    rc = 0
    if "engine" in seams:
        rc |= run([uv(), "run", "pytest"], ENGINE)
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
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
