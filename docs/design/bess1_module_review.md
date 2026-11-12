# BESS-1 review (B1: Catalogue kind BATTERY_MODULE and S-04 module hint, 2026-11-12)

Decisions: Doc 9 D-107 K311 – K314 (user 2026-11-12, all three recommendations).

What changed
- Server: `BatteryModuleValues` and kind `BATTERY_MODULE` in `domain/catalog.py`; guard fields in `services/catalog.py`. OpenAPI and TS types regenerated.
- Client: `components/battery.ts` (Eq. 12.3 – 12.5, the FR-73 warning); S-18 add button, fields with source inputs and the "used only by the battery advice (A2)" label, warning in the editor and the entries table; S-04 "Battery module hint" section.
- Tests: `tests/project_file/test_catalog.py` (roundtrip, warning case usable, guard reasons, out-of-range refused); `frontend/components/battery.test.ts` (hand cases V1 and V2 of the verification framework, boundaries, warning rule); `tests/e2e/test_battery.py`.

Checks
- Expected values in the client test come from `docs/BESS_VERIFICATION_FRAMEWORK.md` §3.1 – §3.2, not from the code.
- Golden comparison (`.scratch/bess/golden.py`, baseline saved before the first code change): 159 responses, only `openapi` differs; every analysis, validate, import, verify and catalogue-import response is byte-identical (FR-121).
- No engine file touched; no M1–M4 payload changed.

Limits
- On the Fake Engine PS returns no storage energy, so the E2E covers only "not evaluated"; the fit, no-fit and unknown paths are covered by the client test. A REAL run of S-04 with a profile is left to BESS-5.
- Pre-existing, outside this round: on the Real Engine, M3c with scenarios whose snapshots belong to another design (the golden run uses the two-bus scenarios on D2) ends in `UNAVAILABLE / ENGINE_ERROR` from a `zip(strict=True)` in `mgengine.m2.check`, where `INPUT_INVALID` would be expected. Not fixed in this round; fixed in stage 1 by D-112 (2026-11-12), engine unchanged.
