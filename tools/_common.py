"""Shared helpers for the task scripts (stdlib only, Windows and Linux)."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
ENGINE = ROOT / "engine"


def which(name: str) -> str:
    """Find an executable; MGAPP_NODE_DIR may point at a Node.js bin directory."""
    node_dir = os.environ.get("MGAPP_NODE_DIR")
    path = os.pathsep.join(filter(None, [node_dir, os.environ.get("PATH", "")]))
    found = shutil.which(name, path=path)
    if not found:
        sys.exit(f"error: '{name}' not found on PATH (set MGAPP_NODE_DIR for Node.js tools)")
    return found


def node_env() -> dict[str, str]:
    env = dict(os.environ)
    node_dir = env.get("MGAPP_NODE_DIR")
    if node_dir:
        env["PATH"] = node_dir + os.pathsep + env.get("PATH", "")
    return env


def run(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> int:
    print(f"$ ({cwd.relative_to(ROOT) if cwd != ROOT else '.'}) {' '.join(cmd)}", flush=True)
    return subprocess.call(cmd, cwd=cwd, env=env)


def uv() -> str:
    return which("uv")


def npm() -> str:
    return which("npm")


def node_bin(name: str) -> str:
    """A tool installed in frontend/node_modules/.bin (never npx: it may fetch unknown packages)."""
    suffix = ".cmd" if os.name == "nt" else ""
    path = FRONTEND / "node_modules" / ".bin" / (name + suffix)
    if not path.exists():
        sys.exit(f"error: {path} missing; run `npm ci` in frontend/")
    return str(path)
