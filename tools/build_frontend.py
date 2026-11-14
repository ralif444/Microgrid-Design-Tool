"""Build the static frontend and copy it into the backend package (Doc 4 §8).

Usage: python tools/build_frontend.py
Then start the app with the single command: uv run --project backend mgapp
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from _common import BACKEND, FRONTEND, node_env, npm, run

STATIC = BACKEND / "src" / "mgapp" / "static"


def flatten_segments(out: Path) -> int:
    """Copy each nested RSC segment file to the flat name the client prefetches.

    Next 16's static export writes `about/__next.about/__PAGE__.txt`, but its router asks for
    `about/__next.about.__PAGE__.txt` (a 404 on every link prefetch). Returns the number of copies.
    """
    n = 0
    for f in out.rglob("*.txt"):
        rel = f.relative_to(out).parts
        k = next((i for i, p in enumerate(rel) if p.startswith("__next.")), None)
        if k is None or k == len(rel) - 1:
            continue
        flat = out.joinpath(*rel[:k], ".".join(rel[k:]))
        shutil.copyfile(f, flat)
        n += 1
    return n


def main() -> int:
    env = node_env()
    if not (FRONTEND / "node_modules").exists() and run([npm(), "ci"], FRONTEND, env) != 0:
        return 1
    if run([npm(), "run", "build"], FRONTEND, env) != 0:
        return 1
    out = FRONTEND / "out"
    print(f"flattened {flatten_segments(out)} RSC segment files")
    for child in STATIC.iterdir():
        if child.name == ".gitkeep":
            continue
        shutil.rmtree(child) if child.is_dir() else child.unlink()
    shutil.copytree(out, STATIC, dirs_exist_ok=True)
    print(f"copied {out} -> {STATIC}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
