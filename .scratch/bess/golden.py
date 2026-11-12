"""Golden comparison of API responses for Projects without banks (BESS guideline §4.3, FR-121).

    uv run --project backend python .scratch/bess/golden.py save     # writes golden-baseline.json
    uv run --project backend python .scratch/bess/golden.py compare  # diffs against it

Every analysis type on the test design and the example Projects, on FAKE and REAL, plus
validate, import, meta and OpenAPI. Volatile fields (ids, timestamps, engine commit) are masked.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "tests"))

from fastapi.testclient import TestClient  # noqa: E402
from fixtures.designs import PARAMETERS, scenarios, two_bus_snapshot  # noqa: E402

from mgapp.adapters.fake_engine import FakeEngine  # noqa: E402
from mgapp.adapters.real_engine import RealEngine  # noqa: E402
from mgapp.main import create_app  # noqa: E402

OUT = Path(__file__).parent / "golden-baseline.json"
EXAMPLES = ROOT / "frontend" / "public" / "examples"
SOLVER = {"mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT"}
VOLATILE = {"record_id", "created_at", "engine_git_commit", "replay_of_record_id"}
TYPES = ["M2", "M3a", "M3b", "M3c", "M3d", "M4a", "M4b", "CB"]


def mask(x: Any) -> Any:
    if isinstance(x, dict):
        return {k: "<masked>" if k in VOLATILE else mask(v) for k, v in x.items()}
    if isinstance(x, list):
        return [mask(v) for v in x]
    return x


def example_doc(name: str) -> dict[str, Any]:
    return json.loads((EXAMPLES / f"{name}.mgproj.json").read_text(encoding="utf-8"))


def snapshot_of(doc: dict[str, Any]) -> dict[str, Any]:
    snap = {k: doc[k] for k in ("buses", "lines", "loads", "inverters", "load_profile")}
    snap |= {k: doc["project"][k] for k in ("nominal_voltage_kv", "nominal_frequency_hz")}
    snap["design_constraints"] = doc.get("design_constraints") or {}
    return snap


def collect() -> dict[str, Any]:
    names = sorted(p.name.removesuffix(".mgproj.json") for p in EXAMPLES.glob("*.mgproj.json"))
    designs = {"two_bus": two_bus_snapshot()} | {n: snapshot_of(example_doc(n)) for n in names}
    out: dict[str, Any] = {}
    for kind, engine in (("FAKE", FakeEngine), ("REAL", RealEngine)):
        c = TestClient(create_app(engine=engine(), serve_static=False))

        def post(key: str, path: str, body: Any) -> dict[str, Any]:
            r = c.post(path, json=body)
            out[key] = {"status_code": r.status_code, "body": mask(r.json())}
            return r.json()

        out[f"{kind}/meta"] = mask(c.get("/api/meta").json())
        for d, snap in designs.items():
            def body(t: str, **over: Any) -> dict[str, Any]:
                b = {"project_snapshot": snap, "parameters": dict(PARAMETERS[t]),
                     "solver_config": SOLVER} | over
                if t == "M3c":
                    b["scenarios"] = scenarios()
                return b

            post(f"{kind}/{d}/validate", "/api/projects/validate", {"project_snapshot": snap})
            post(f"{kind}/{d}/PS", "/api/analyses/PS", body("PS"))
            m1 = post(f"{kind}/{d}/M1", "/api/analyses/M1", body("M1"))
            rec = m1["run_record"]
            ref = {"record_id": rec["record_id"], "analysis_type": "M1",
                   "snapshot_hash": rec["snapshot_hash"], "status": rec["result"]["status"],
                   "result_hash": rec["result_hash"], "result_payload": rec["result"]["payload"]}
            m2 = post(f"{kind}/{d}/M2", "/api/analyses/M2", body("M2", depends_on=ref))
            for t in TYPES[1:-1]:
                post(f"{kind}/{d}/{t}", f"/api/analyses/{t}", body(t, depends_on=ref))
            r2 = m2["run_record"]
            ref2 = {"record_id": r2["record_id"], "analysis_type": "M2",
                    "snapshot_hash": r2["snapshot_hash"], "status": r2["result"]["status"],
                    "result_hash": r2["result_hash"], "result_payload": r2["result"]["payload"]}
            post(f"{kind}/{d}/CB", "/api/analyses/CB", body("M2", depends_on=ref2))
            post(f"{kind}/{d}/verify", "/api/run-records/verify", rec)
        for n in names:
            post(f"{kind}/{n}/import", "/api/projects/import", example_doc(n))
        sys.path.insert(0, str(ROOT / "tests" / "project_file"))
        from test_catalog import breaker, catalog, conductor, inverter  # noqa: PLC0415

        post(f"{kind}/catalog", "/api/catalogs/import", catalog(
            breaker(), conductor(), inverter(grid_forming=True, grid_forming_reference="p. 4"),
            inverter(id="I2"), conductor(id="C2", sources={})))
    out["openapi"] = c.get("/api/openapi.json").json()
    return out


def main(mode: str) -> int:
    now = json.dumps(collect(), sort_keys=True, indent=1, ensure_ascii=False)
    if mode == "save":
        OUT.write_text(now, encoding="utf-8")
        print(f"saved {len(json.loads(now))} responses to {OUT}")
        return 0
    base = json.loads(OUT.read_text(encoding="utf-8"))
    cur = json.loads(now)
    diff = sorted(k for k in base.keys() | cur.keys() if base.get(k) != cur.get(k))
    print(f"{len(base)} baseline, {len(cur)} now, {len(diff)} differ")
    for k in diff:
        print("  DIFF", k)
    return 1 if diff else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "compare"))
