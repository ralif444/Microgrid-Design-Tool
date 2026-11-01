"""Seam 5 fixtures: the real start command in a subprocess, one server per Fake profile."""

from __future__ import annotations

import os
import socket
import subprocess
import time
import urllib.request
from collections.abc import Callable, Iterator

import pytest
from _common import BACKEND, uv

STATIC_INDEX = BACKEND / "src" / "mgapp" / "static" / "index.html"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return int(s.getsockname()[1])


@pytest.fixture(scope="session")
def server() -> Iterator[Callable[[str], str]]:
    if not STATIC_INDEX.exists():
        pytest.fail("frontend build missing: run python tools/build_frontend.py")
    procs: dict[str, tuple[subprocess.Popen[bytes], str]] = {}

    def start(profile: str = "default") -> str:
        if profile in procs:
            return procs[profile][1]
        port = _free_port()
        env = {**os.environ, "MGAPP_PORT": str(port), "MGAPP_FAKE_PROFILE": profile}
        proc = subprocess.Popen([uv(), "run", "mgapp"], cwd=BACKEND, env=env)
        url = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(f"{url}/api/health", timeout=1)
                break
            except OSError:
                time.sleep(0.1)
        else:
            proc.kill()
            pytest.fail("server did not start")
        procs[profile] = (proc, url)
        return url

    yield start
    for proc, _ in procs.values():
        proc.terminate()
        proc.wait(timeout=10)
