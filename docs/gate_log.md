# Gate log (WP 1.8.3)

## Ringkasan
Berkas ini mencatat hasil setiap gerbang tahap dan setiap paket kerja sesuai Tabel 4.15 naskah dan aturan gerbang di Doc 10. Setiap baris memuat tanggal, gerbang atau paket, kriteria, hasil lulus atau gagal, serta bukti berupa perintah uji dan commit. Gerbang dinilai sendiri oleh pengembang tunggal, sehingga penilaian ini tidak independen (naskah 4.6.2). Tinjauan pembimbing direncanakan pada gerbang masuk Tahap 1.4 dan gerbang keluar Tahap 1.7. Hasil Fake Engine yang tercatat di sini tidak pernah merupakan hasil mesin perhitungan. Baris ditambahkan secara berurutan dan tidak pernah dihapus.

| Date | Gate / WP | Criterion | Result | Evidence |
|---|---|---|---|---|
| 2026-11-01 | EG-1.1 | Proposal accepted | PASS | Seminar proposal held (KONTEKS_TERKINI, 01-11-2026) |
| 2026-11-01 | EG-1.1 | Design approved | PASS | Manuscript `Seminar.pdf` 28-10-2026; user approval of the stage 1.1 plan in the implementation chat, 01-11-2026 |

## Paket 0 — documents in the repository (2026-11-01)
Not a manuscript gate; a review checklist before WP 1.1.1.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Doc set copied verbatim (01–03, 05_adr, 06, 07, 09, 11–14, agents, CLAUDE.md) | PASS | commit a6bced9 |
| 2 | Doc 04 aligned (D2): 16 components, guard-only Engine Port import, allowed Status sets, Tabel 4.11 | PASS | docs/04_architecture.md |
| 3 | Doc 08 aligned (D5, B7): 7 seams, 9 behaviours, defective profile, 4-level V&V, DoD 10 | PASS | docs/08_structure_verification.md |
| 4 | Doc 10 aligned (D7): stages 1.1–1.8, Tabel 4.15, 39 WPs, gate rules | PASS with open item | G3–G6 [PERLU VERIFIKASI] (Doc 9 A-52) |
| 5 | ADR "Revisit when" carry Tabel 4.11 triggers (D3) | PASS | docs/05_adr/ |
| 6 | Doc 09 alignment appended (D6); Doc 14 statuses updated | PASS | Doc 09 §10, Doc 14 |
| 7 | No invented values: every number traces to the manuscript or a user decision | PASS (self-review) | Doc 09 §10.1 basis column |

## WP 1.1.1 — repository structure and import-rule checks (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Folder tree per Doc 8 §1 (backend/src/mgapp, frontend, tests seams, validation, tools) | PASS | tree in commit |
| 2 | Lock files committed: `backend/uv.lock` (Python 3.13.18), `frontend/package-lock.json` (Node 26.7.0, npm 10.9.9) | PASS | lock files |
| 3 | import-linter: 7 contracts kept | PASS | `python tools/check.py` |
| 4 | import-linter catches deliberate violations (5 negative cases) | PASS | tests/static/test_import_rules.py |
| 5 | dependency-cruiser passes on frontend and catches a fixture violation | PASS | same file |
| 6 | Static export config; no API routes/server actions; `fetch` only in api-client (with negative test); validation/ does not import mgapp; loopback bind | PASS | tests/static/ (17 passed) |
| 7 | ruff format/lint, mypy strict, tsc strict | PASS | `python tools/check.py` |

## WP 1.1.2 — Engine Port and Fake Engine (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Engine Port has exactly two operations (`run`, `identity`) and the seven rules in its docstring | PASS | backend/src/mgapp/engine_port |
| 2 | Domain schemas for Doc 3 §5 (request, result, limiting constraint, warning, issue) and §6 payloads of all nine types | PASS | backend/src/mgapp/domain |
| 3 | Fake returns every Status on demand; default profile FEASIBLE with a schema-valid payload for all nine types (NFR-07) | PASS | tests/contract/test_fake_engine_controls.py |
| 4 | Every Fake result carries ENGINE_KIND_FAKE; call log, delay and raise controls work in-process | PASS | same |
| 5 | Placeholders contain no invented physics; the only synthetic numbers (M2 INFEASIBLE) are marked SYNTHETIC | PASS (review) | adapters/fake_engine/payloads.py |
| 6 | Defective profile implemented (one defect per contract behaviour C1–C9) | PASS (used in WP 1.1.3) | adapters/fake_engine/defective.py |

## WP 1.1.3 — contract test suite (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One suite, nine behaviours C1–C9, adapter-parametrised (`ADAPTERS`; REAL added at WP 1.4.2) | PASS | tests/contract/suite.py |
| 2 | Fake Engine passes: default profile and all 32 allowed (type, outcome) scripts | PASS | tests/contract/test_contract_suite.py |
| 3 | M1 INFEASIBLE rejected by the suite (C2) | PASS | same |
| 4 | Suite fails on each of the nine defects, naming the broken behaviour | PASS | same |

## WP 1.1.4 — application service spine (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Pipeline order: request model → stage 1 (all issues) → size limits → canonical hash → dependency (3 parts) → guarded call → RunRecord | PASS | services/pipeline.py |
| 2 | Every Status and reason (FEASIBLE, INFEASIBLE, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INPUT_INVALID incl. MALFORMED_REQUEST, UNAVAILABLE: TIMEOUT, DEPENDENCY_NOT_MET, NOT_APPLICABLE, ENGINE_ERROR) → HTTP 200 + 17-field RunRecord; engine fields null iff engine not called | PASS | tests/api/test_status_and_runrecord.py |
| 3 | Zero engine calls on INPUT_INVALID, size-limit and dependency failures; stale worded as stale | PASS | tests/api/test_dependency.py, test_limits_and_transport.py |
| 4 | Time budget enforced by the guard (thread + abandon); exception and disallowed Status → ENGINE_ERROR, never SOLVER_FAILED | PASS | same |
| 5 | Six canonicalisation rules tested through HTTP against an independent reference and hand-written known answers | PASS | tests/reproducibility/test_canonical_hash.py |
| 6 | Transport errors 400/404/405/413/415 as TransportError; no 422 | PASS | tests/api/test_limits_and_transport.py |
| 7 | Only the execution guard imports the Engine Port (import-linter, ignore rule now matched) | PASS | `python tools/check.py` |

## WP 1.1.5 — API description and generated types (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | OpenAPI generated from the Pydantic schemas, committed at `backend/openapi/openapi.json`; payload schemas (Doc 3 §6) and ValidationIssue published as components | PASS | tools/gen.py |
| 2 | TypeScript types generated by openapi-typescript 7.13.0 into `frontend/api-types/schema.d.ts` with a "do not edit" header; `tsc --strict` passes | PASS | `python tools/check.py` |
| 3 | Drift: `gen.py --check` in the static checks; a changed description is detected | PASS | tests/static/test_openapi.py |
| 4 | Stage 1.1 exposes exactly 11 endpoints (health, meta, nine analyses); no 422 documented | PASS | same |
| 5 | Every numeric field in every schema has a Doc 3 unit suffix or is a documented unitless field (FR-05) | PASS | same |
| 6 | `npm audit`: 3 moderate advisories in openapi-typescript's dependency (minimatch ReDoS); build-time dev tool only, not shipped | NOTED | — |

## WP 1.1.6 — thin M1 slice and start procedure (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | One start command `uv run --project backend mgapp` serves UI and API from one process on 127.0.0.1 | PASS | tests/e2e (real subprocess), tests/static/test_offline_assets.py |
| 2 | Minimal M1 screen: JSON design input, Status banner (Doc 7 §5 texts), issue list, bus/inverter tables with units, RunRecord id and hash, engine badge FAKE | PASS | tests/e2e/test_m1_slice.py (4 passed) |
| 3 | Fake profiles selectable at startup only (`MGAPP_FAKE_PROFILE`) | PASS | E2E SOLVER_FAILED profile |
| 4 | No external request during the E2E flows; no external asset in the build (NFR-03) | PASS | route guard in tests/e2e/conftest; static scan |
| 5 | Browser: Playwright Chromium 153.0.8010.12 (sandbox). Google Chrome stable on the Windows target not yet run | PARTIAL | re-run on the target laptop before exit 1.2 |

## Exit gate 1.1 — Rangka aplikasi dan mesin tiruan (2026-11-01)
Tabel 4.15: "Satu perintah mulai; kontrak enam status; RunRecord tiap status". Criteria per Doc 10 §3.1.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | One start command serves UI and API from one process, loopback only (NFR-02, NFR-17) | PASS | WP 1.1.6 rows 1, 4 |
| 2 | Contract suite (nine behaviours) passes on the Fake Engine and fails on every defect of the defective profile; every allowed Status on demand (NFR-07, NFR-08, FR-22) | PASS | WP 1.1.3 |
| 3 | Every Status and reason returns HTTP 200 with a 17-field RunRecord (FR-35, FR-43, FR-46–FR-48) | PASS | WP 1.1.4 row 2 |
| 4 | Import rules pass and catch violations; OpenAPI and TS types current; lock files committed | PASS | WP 1.1.1, 1.1.5 |
| 5 | Canonicalisation rule tests pass | PASS | WP 1.1.4 row 5 |
| 6 | Definition of Done (Doc 8 §8) for the 1.1 scope | PASS with notes | items 7 (E2E keyboard reachability not yet tested) and 10 (offline on target laptop) to confirm on the Windows target |

Test totals in the sandbox: static + contract + api + reproducibility 255 passed; client 1 passed; e2e 4 passed. Versions: Python 3.13.18, FastAPI 0.162.0, Pydantic 2.14.2, uvicorn 0.54.0, Node 26.7.0, Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3.

**Decision: exit gate 1.1 PASS (conditional).** Conditions carried into entry 1.2: (a) run the four E2E flows on the Windows 11 laptop with Google Chrome stable and log its version; (b) confirm or replace gate rules G3–G6 (Doc 9 A-52); (c) decide Doc 9 Q-23 before WP 1.3.1. Open entry-1.2 items from Tabel 4.15: "kontrak entitas beku; skenario Fake ditetapkan".

## Entry gate 1.2 — Fitur utama aplikasi (2026-11-01)
| # | Criterion (Tabel 4.15) | Result | Evidence |
|---|---|---|---|
| 1 | Exit 1.1 | PASS (conditional; Chrome-on-target run carried as a condition of exit 1.2) | Exit gate 1.1 above |
| 2 | Entity contract frozen | PASS | user decision 2026-11-01 (Doc 9 D-43) |
| 3 | Fake scenarios fixed | PASS | user decision 2026-11-01 (Doc 9 D-44) |

Carried conditions resolved: gate rules G3–G6 confirmed (A-52); Q-23 decided (oracle with R = 0 at engine level only). **Decision: enter stage 1.2** on branch `tahap-1.2`.

## Stage 1.2 — Windows 11 target laptop (2026-11-01)
First run on Windows 11 Home 10.0.26200. Python 3.13.15 (uv; `python` on PATH is ETAP's 3.8.4, not used), Node 26.7.0, FastAPI 0.162.0, Pydantic 2.14.2, uvicorn 0.54.0, Playwright 1.63.0.

| # | Step | Result | Note |
|---|---|---|---|
| 1 | `tools/check.py` | PASS | no Windows changes needed (`.cmd` shims resolved) |
| 2 | `tools/test.py` | PASS | 254 passed, 1 skipped (offline-assets test waits for the frontend build); client 1 passed |
| 3 | `tools/build_frontend.py` | PASS | |
| 4 | `tools/test.py e2e`, Playwright Chromium 153.0.8010.12 | PASS | 4 passed; first attempt failed only because `playwright install chromium` had not been run (documented one-time step) |
| 5 | E2E on Google Chrome stable 156.0.8078.48 (`MGAPP_E2E_CHANNEL=chrome`) | PASS | 4 passed. Exit-1.1 condition (a) met; rerun at exit 1.2. The e2e fixture now reads the Playwright channel from `MGAPP_E2E_CHANNEL` (unset = bundled Chromium) |

## WP 1.2.1 — load data entry and PS (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | `POST /api/projects/validate` (Doc 6 §3.4): all stage-1 issues, rules per target (null = M1), request checks only with parameters, `snapshot_hash` equal to the M1 RunRecord hash, off-schema body reported (no 422), zero engine calls | PASS | tests/api/test_validate_and_ps.py |
| 2 | Load rows with Q or PF accepted; negative P, empty P, PF > 1, Q and PF both missing, PF without direction each name the field (FR-03, FR-17, FR-18) | PASS | same file |
| 3 | PS advice with basis, assumptions and RunRecord; `r = 1, n = 1` → PS_PARAMETER_INVALID with zero calls (FR-06, FR-07; storage staging on the engine, D-45 K6) | PASS | same file |
| 4 | Store: new Project empty; Load add/edit/delete with generated ids; Accept/Skip leave the design unchanged; Load or PS-setting change makes the advice stale (FR-01, FR-03, FR-08) | PASS | frontend/store/reducer.test.ts |
| 5 | Browser canonicaliser for SizingAdvice `input_hash` equals the server canonicaliser on shared vectors (D-45 K4) | PASS | tests/fixtures/canonical_vectors.json; Python and Vitest tests |
| 6 | S-01 → S-02 → S-03 → S-04 flow: gating message, inline row error, unit on every numeric input, PS run, Accept, no Inverter added, stale notice (FR-01, FR-05 UI, FR-06, FR-08) | PASS | tests/e2e/test_loads_ps.py; Chromium 153.0.8010.12 and Chrome 156.0.8078.48 |

Totals: Python seams 271 passed; client 6 passed; e2e 5 passed. No Fake profile added. Decisions: Doc 9 D-45 (K1–K6). Gating shows the "Create or open a Project first" message with a link to Start rather than an automatic redirect. Shared E2E browser fixtures moved to tests/e2e/conftest.py.
