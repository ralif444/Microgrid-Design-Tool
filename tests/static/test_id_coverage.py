"""Seam 6: every FR and NFR id (Doc 2, Doc 12) is named by at least one test (Doc 8 §8 DoD 3).

An id counts as named when a test file mentions it (FR-12, fr_12, or a range such as
FR-64 – FR-72). Won't rows are skipped; the exceptions below are recorded in Doc 9.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).parents[2]
DOCS = [ROOT / "docs" / "02_prd.md", ROOT / "docs" / "12_extensions.md"]
EXCEPTIONS = {
    "FR-56": "no older Project schema version exists (D-66 K135)",
    **{f"FR-{n}": "B1, B2, P11 postponed until D2 data exist (D-62)" for n in range(73, 80)},
    **{f"FR-{n}": "example mode X9, tested from EX-5 (D-92 K235)" for n in range(102, 105)},
    "NFR-09": "process requirement; evidence is the seam marking in Doc 8 §6",
    "NFR-18": "process requirement; evidence is the gate log",
}


def _ids() -> dict[str, str]:
    out: dict[str, str] = {}
    for doc in DOCS:
        for line in doc.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^\| ((?:FR|NFR)-\d+) \|", line)
            if m and "| Won't |" not in line:
                out.setdefault(m.group(1), doc.name)
    return out


def _test_text() -> str:
    files = [*(ROOT / "tests").rglob("*.py"), *(ROOT / "engine" / "tests").rglob("*.py")]
    files += [p for p in (ROOT / "frontend").rglob("*.test.ts") if "node_modules" not in p.parts]
    return "\n".join(p.read_text(encoding="utf-8") for p in files if p.name != Path(__file__).name)


def _named(rid: str, text: str) -> bool:
    kind, num = rid.split("-")
    n = int(num)
    if re.search(rf"(?<![A-Za-z]){kind}-0*{n}(?!\d)", text):
        return True
    if re.search(rf"(?<![a-z]){kind.lower()}_0*{n}(?!\d)", text):
        return True
    ranges = re.findall(rf"{kind}-(\d+)\s*(?:–|-| to |…)\s*{kind}-(\d+)", text)
    ranges += re.findall(rf"{kind.lower()}_(\d+)_to_{kind.lower()}_(\d+)", text)
    return any(int(a) <= n <= int(b) for a, b in ranges)


def test_every_requirement_id_is_named_by_a_test() -> None:
    text = _test_text()
    ids = _ids()
    assert len(ids) > 90, "requirement tables not found"
    missing = sorted(i for i in ids if i not in EXCEPTIONS and not _named(i, text))
    assert not missing, f"no test names these ids: {missing}"


def test_exceptions_are_still_needed() -> None:
    text = _test_text()
    stale = sorted(i for i in EXCEPTIONS if _named(i, text))
    assert not stale, f"now tested, remove from EXCEPTIONS: {stale}"
