"""Build the static frontend and copy it into the backend package (Doc 4 §8).

Usage: python tools/build_frontend.py
Then start the app with the single command: uv run --project backend mgapp
"""

from __future__ import annotations

import shutil
import sys

from _common import BACKEND, FRONTEND, node_env, npm, run

STATIC = BACKEND / "src" / "mgapp" / "static"


def main() -> int:
    env = node_env()
    if not (FRONTEND / "node_modules").exists() and run([npm(), "ci"], FRONTEND, env) != 0:
        return 1
    if run([npm(), "run", "build"], FRONTEND, env) != 0:
        return 1
    out = FRONTEND / "out"
    for child in STATIC.iterdir():
        if child.name == ".gitkeep":
            continue
        shutil.rmtree(child) if child.is_dir() else child.unlink()
    shutil.copytree(out, STATIC, dirs_exist_ok=True)
    print(f"copied {out} -> {STATIC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
