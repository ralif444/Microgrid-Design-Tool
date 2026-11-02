"""Seam 5 fixtures: the real start command in a subprocess, one server per Fake profile, and a
browser page that refuses external requests (NFR-03). MGAPP_E2E_CHANNEL=chrome runs the flows on
installed stable Chrome (NFR-13); unset uses the bundled Playwright Chromium."""

from __future__ import annotations

import os
import socket
import subprocess
import time
import urllib.request
from collections.abc import Callable, Iterator
from urllib.parse import urlparse

import pytest
from _common import BACKEND, uv
from playwright.sync_api import Browser, Page, sync_playwright

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


@pytest.fixture(scope="module")
def browser() -> Iterator[Browser]:
    with sync_playwright() as p:
        b = p.chromium.launch(channel=os.environ.get("MGAPP_E2E_CHANNEL"))
        yield b
        b.close()


@pytest.fixture
def page(browser: Browser) -> Iterator[Page]:
    ctx = browser.new_context()
    external: list[str] = []

    def guard(route, request) -> None:  # type: ignore[no-untyped-def]
        host = urlparse(request.url).hostname
        if host not in ("127.0.0.1", "localhost"):
            external.append(request.url)
            route.abort()
        else:
            route.continue_()

    ctx.route("**/*", guard)
    pg = ctx.new_page()
    yield pg
    ctx.close()
    assert external == [], f"external requests attempted: {external}"  # NFR-03
