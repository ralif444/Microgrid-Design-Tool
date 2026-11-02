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

## WP 1.2.2 — network, constraints, M1 and M2 (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Constraint change changes the snapshot hash; inverted band → INPUT_INVALID / BAND_INVERTED (FR-15) | PASS | tests/api/test_constraints_and_m2.py |
| 2 | M2 FEASIBLE with verdict, loadability, separate SizingCheck; empty limits listed in `not_evaluated` with warning CONSTRAINT_NOT_EVALUATED, none when every limit is set; missing margins → SIZING_MARGIN_INVALID (FR-16, FR-24, FR-27) | PASS | same file |
| 3 | M2 INFEASIBLE lists two typed limiting constraints (FR-25) | PASS | same file |
| 4 | Store: add/edit/delete Bus, Line, Inverter with generated ids; constraints stored, empty = null; M1 reference from the latest FEASIBLE M1 (FR-10, FR-12, FR-13, FR-15) | PASS | frontend/store/reducer.test.ts |
| 5 | S-05 → S-06 → S-07 → S-08 flow: units on every numeric input, derived Line totals, isolated-Bus issue, inverted band message, M2 blocked without M1, M2 FEASIBLE with not-evaluated list, warning, SizingCheck, λ_s wording; edit → stale and M2 disabled; revert → current (FR-05, FR-10, FR-15, FR-16, FR-19, FR-24, FR-27, FR-40) | PASS | tests/e2e/test_network_m1_m2.py |
| 6 | M2 INFEASIBLE on profile `m2-infeasible` shows the limiting-constraint table (FR-25) | PASS | same file |
| 7 | Stage-1.1 E2E flows now enter the design through the screens (D-46 K7) | PASS | tests/e2e/test_m1_slice.py, tests/e2e/flows.py |

Totals: Python seams 277 passed; client 9 passed; e2e 7 passed on Chromium 153.0.8010.12 and Chrome 156.0.8078.48. Fake Engine change (D-44 rule): default M2 behaviour adds warning CONSTRAINT_NOT_EVALUATED when `not_evaluated` is non-empty (Doc 6 §3.3); no new profile; Fake version fake-2. Decisions: Doc 9 D-46 (K7–K13).

## WP 1.2.3 — Project file, Run history, report (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | RunRecord verify: intact accepted with engine comparison; tampered snapshot and result → HASH_MISMATCH on both paths with zero engine calls; unknown version / not a record refused (FR-49, FR-50, FR-57) | PASS | tests/reproducibility/test_verify_rerun.py |
| 2 | Re-run: M1, PS, empty-snapshot M1 and dependent M2 REPRODUCED with `replay_of_record_id`, imported record unchanged; scripted SOLVER_FAILED → DIFFERS with STATUS and STATUS_CODE; other engine version → ENGINE_VERSION_MISMATCH warning, still runs (NFR-01, FR-51, FR-52, FR-53) | PASS | same file |
| 3 | Project import: current file returned unchanged with validation; versions 2 / null / "1" → UNKNOWN_SCHEMA_VERSION, 0 → UNMIGRATABLE, nothing loaded; not a Project → MALFORMED_FILE; stage-1 issues reported not fixed; bad embedded RunRecord listed and skipped (FR-54, FR-55, FR-57, NFR-12, NFR-16, D-47 K15, K16) | PASS | tests/project_file/test_import.py |
| 4 | Store: saved file carries `schema_version` and nominal values in `project`; load then save gives the same document; Save clears unsaved (FR-54, FR-55) | PASS | frontend/store/projectFile.test.ts |
| 5 | S-16 Report on profile `m2-infeasible`: verdict, limiting constraints, SVG bus-voltage chart, tables, 64-hex hash in traceability, A1–A6, Fake note (FR-58, FR-59) | PASS | tests/e2e/test_report_runs.py |
| 6 | S-15: one-file export, tampered import refused and not added, Re-run adds a record and shows Reproduced; header Save → create other Project (confirm) → Open restores name and runs (FR-49, FR-50, FR-53, FR-55, K17) | PASS | same file |

Totals: Python seams 307 passed; client 12 passed; e2e 9 passed on Chromium 153.0.8010.12 and Chrome 156.0.8078.48. No Fake profile added. Decisions: Doc 9 D-47 (K14–K19). A2 in the report is quoted from Tabel 1.1 as extracted; the manuscript sentence appears to miss a word (user to confirm). Print layout (FR-60) has CSS only, not checked in a browser print.

## WP 1.2.4 — key-flow tests, FAKE marking (2026-11-01)
| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | F1 on profile `m2-infeasible`: engine badge "Engine: FAKE" on every screen; PS Accept → M1 (System, Bus, Inverter, Line tables with ε_X, FR-23) → M2 INFEASIBLE → limiting-element link opens S-05 Inverters with the row marked (D-48 K22) → edit → M1 stale, report "outdated" → M1 and M2 again → report current | PASS | tests/e2e/test_key_flows.py |
| 2 | F1 on profile `m1-inadmissible`: PHYSICALLY_INADMISSIBLE banner; M2 blocked | PASS | same file |
| 3 | Every Status banner shows the ENGINE_KIND_FAKE message (D-48 K20) | PASS | same file (PS, M1, M2 banners) |
| 4 | F2: newer file refused, open Project unchanged (NFR-16); unreadable RunRecord listed (`run_records[0]`) and skipped; stage-1 issue shown on S-02, not fixed | PASS | same file |
| 5 | F3 / FR-49: one exported file holds the 17-field RunRecord; imported into another Project, verified, engine comparison shown; Re-run Reproduced, original record unchanged | PASS | same file |

Totals: Python seams 307 passed; client 12 passed; e2e 13 passed on Chromium 153.0.8010.12 and Chrome 156.0.8078.48. No Fake profile added (D-48 K21). Decisions: Doc 9 D-48 (K20–K24).

## Exit gate 1.2 — Fitur utama aplikasi (2026-11-01)
Tabel 4.15: "semua Must lulus; REPRODUCED pada Fake; laporan lengkap". Criteria per Doc 10 §3.1.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Every Must FR (38 in Doc 2) passes at its seam | PASS | list below |
| 2 | Export → import → re-run gives REPRODUCED on the Fake (NFR-01) | PASS | WP 1.2.3 rows 1–2, 6; WP 1.2.4 row 5 |
| 3 | Report shows verdict, limiting constraints, margins, assumptions, RunRecord hash, a table and a chart (FR-58, FR-59) | PASS | WP 1.2.3 row 5; WP 1.2.4 row 1 |
| 4 | Offline key flow | PASS with note | every e2e flow runs with all non-loopback requests aborted and asserted absent (NFR-03 guard in tests/e2e/conftest.py); a run with the network adapter switched off was not done |
| 5 | Chrome version logged (condition carried from exit 1.1) | PASS | Chrome 156.0.8078.48 on Windows 11, WP 1.2.1–1.2.4 rows |

Must FR → test files (paths under `tests/`, store tests under `frontend/`):
FR-01 e2e/test_loads_ps, store/reducer.test · FR-03 api/test_validate_and_ps, e2e/test_loads_ps · FR-05 e2e/test_loads_ps, e2e/test_network_m1_m2, static/test_openapi · FR-06, FR-07 api/test_validate_and_ps, e2e/test_loads_ps · FR-08 e2e/test_loads_ps, store/reducer.test · FR-10, FR-12, FR-13 e2e/test_network_m1_m2, store/reducer.test · FR-15 api/test_constraints_and_m2, e2e/test_network_m1_m2 · FR-17 api/test_validate_and_ps, e2e/test_m1_slice · FR-18 api/test_validate_and_ps, e2e/test_loads_ps · FR-19 e2e/test_network_m1_m2 · FR-21 api/test_status_and_runrecord · FR-22 contract/test_contract_suite · FR-23 e2e/test_key_flows · FR-24, FR-25, FR-27 api/test_constraints_and_m2, e2e/test_network_m1_m2 · FR-35 api/test_status_and_runrecord, contract/test_contract_suite, e2e/test_m1_slice · FR-36, FR-42, FR-43, FR-46, FR-47 api/test_status_and_runrecord · FR-37, FR-38 api/test_dependency · FR-40 api/test_dependency, e2e/test_network_m1_m2 · FR-48 api/test_status_and_runrecord, reproducibility/test_canonical_hash · FR-49, FR-50, FR-52, FR-53 reproducibility/test_verify_rerun, e2e/test_report_runs, e2e/test_key_flows · FR-54, FR-55 project_file/test_import, store/projectFile.test, e2e/test_report_runs · FR-57 project_file/test_import · FR-58, FR-59 e2e/test_report_runs.

Open notes (not exit criteria): Doc 8 §8 DoD item 7 (keyboard reachability) still has no E2E check; print layout (FR-60, Should) not checked in a browser print; report A2 wording to be confirmed against the manuscript.

**Decision: exit gate 1.2 PASS (conditional)**, confirmed by the user 2026-11-01. Conditions carried into stage 1.3/1.4: (a) E2E check of keyboard reachability (Doc 8 §8 item 7); (b) one key flow with the network adapter switched off; (c) print layout checked in Chrome (FR-60, Should); (d) user confirms the A2 wording of Tabel 1.1 used in the report.

## Exit 1.2 carried conditions (2026-11-01)
| # | Condition | Result | Evidence |
|---|---|---|---|
| a | Keyboard reachability (Doc 8 §8 item 7): Start → Network (buses, line with both bus selects, inverter) → Loads → M1 → Report → Run history, every control reached by Tab and operated by Enter, typing or arrow keys | PASS | tests/e2e/test_keyboard_print.py |
| b | Key flows with the network adapter switched off | PASS | run by the user 2026-11-01 with Wi-Fi off: `MGAPP_E2E_CHANNEL=chrome`, `tools\test.py e2e` → 15 passed in 56.87 s on Chrome 156.0.8078.48 |
| c | Print layout (FR-60): in print media the header and Print button are hidden and the report fits the A4 printable width (718 px); Chromium A4 PDF checked by eye: 3 pages, no clipped table or chart | PASS | same file; fixed by breaking long hashes (`overflow-wrap`), allowing sections to split across pages, keeping headings with their content, assumption text left-aligned |
| d | A2 wording of Tabel 1.1 used in the report | OPEN | user to confirm against the manuscript |

Windows fix (stage 1.2 instruction: Windows differences are fixed at the cause and logged): the e2e server fixture stopped only `uv.exe` with `terminate()`; on Windows the `mgapp` child kept running, and 135 leftover server processes had piled up from earlier runs. `tests/e2e/conftest.py` now ends the process tree with `taskkill /F /T` on Windows; after a full run no `mgapp` process is left.

Totals: Python seams 307 passed; client 12 passed; e2e 15 passed on Chromium 153.0.8010.12 and Chrome 156.0.8078.48.

Note: Playwright's bundled Chromium installed from the agent shell was not visible in the user's own terminal ("Executable doesn't exist"), so the offline run used installed Chrome. In a user terminal, run `cd backend; uv run playwright install chromium` once before using the bundled Chromium.

## Entry gate 1.3 — Mesin perhitungan (2026-11-02)
Tabel 4.15 sets no entry criterion for stage 1.3 ("Tidak ditetapkan"). Recorded basis: exit gate 1.2 PASS (conditional, one open condition: A2 wording). **Decision (user 2026-11-02, Doc 9 D-49 K25): enter stage 1.3** on branch `tahap-1.3`. The app keeps the Fake Engine until stage 1.4.

| WP | Date | Result | Evidence |
|---|---|---|---|
| 1.3.1 M1 Newton–Raphson + unit audit | 2026-11-02 | PASS: `mgengine` 0.1.0 (numpy) solves (4.5)–(4.9) with analytic Jacobian and the 4.2.3 status rules; level-1 tests: Tabel 4.8 oracle f = 49.75 Hz, Δω = 1.5708 rad/s (symmetric and lossless one-sided load), Jacobian = finite differences, losses ≥ 0 and ω matches (4.9) with losses, MAX_ITERATIONS_REACHED, NON_FINITE, ILL_CONDITIONED_JACOBIAN, V ≤ 0 → PHYSICALLY_INADMISSIBLE, determinism. Engine wired into `tools/check.py` (ruff, mypy) and `tools/test.py` (seam `engine`); static test: only `adapters/real_engine` may import `mgengine`, the engine never imports `mgapp`. Open for WP 1.4.1: unit of `voltage_droop_kv_per_kvar` (line-to-line or phase), see engine/docs/m1.md | check passed; engine 9 passed; Python seams 308 passed; client 12 passed; e2e not rerun (no app change) |

Windows note: `uv sync` run while `engine/src/mgengine` was still empty left an editable install without its `.pth` path entry (`ModuleNotFoundError: mgengine`); fixed with `uv sync --reinstall-package mgengine`. Not a Windows-only cause, logged for repeatability.
| 1.3.2 Detailed technical results | 2026-11-02 | PASS: `mgengine.results.m1_details` gives line flows at both ends, phase current, line losses, inverter P/Q/S and loading ratio (new `Inverter.rated_va`), total load and losses, ε_X (4.1) against nominal ω (Doc 9 D-50 K33–K39). Level-1: Tabel 4.8 ε_X = 0.5 %, zero flow under symmetric load, loading 0.5; lossless one-sided load: 5 kW across the line, zero active loss, ΣQ_inv = Σ3\|I\|²X. Sanity (4.5.2): P and Q balance, losses > 0 and = 3\|I\|²R, S² = P² + Q²; no operating point → refused. Audit table extended in engine/docs/m1.md | check passed; engine 13 passed; Python seams 308 passed; client 12 passed; e2e not rerun (no app change) |
| 1.3.3 Constraints and sizing (PS, M2; package 0.2.0) | 2026-11-02 | PASS: `mgengine.ps` ((4.2)–(4.4), (4.13)) and `mgengine.m2` (five checks (4.10) with tolerance (4.11), normalised margins (4.18), sizing (4.12)–(4.13), λ trace (4.14)–(4.15) per Gambar C.2b, oracle λ_ub (4.16)); `solve_m1` takes a warm-start `x0`; Doc 9 D-51 (K40–K49). Level-1: Tabel 4.8 λ_ub = 2.0 and λ_ub − 0.005 ≤ λ_c ≤ λ_ub; PS ↔ M2 cross-check λ_ub ≥ 1 + m_inv (r = 0, μ = 1); PS hand calculations (vector sum, 0.1 kVA ceiling incl. exact multiple, wrapped window, 1 h = peak, 24 h = daily energy, storage stages, profile peak warning); (4.11) at the limit; λ_s brackets the first M1 failure within 0.005; INFEASIBLE at λ = 1 gives λ_c = None; sorted margins, not-evaluated list, determinism; sizing and rating-margin warning. Audit in engine/docs/m2.md. Not tested: the `ImplementationError` path (no legitimate input reaches it) | check passed; engine 27 passed; Python seams 308 passed; client 12 passed; e2e not rerun (no app change) |
| 1.3.4 Sensitivity and scenarios (M3a–M3d) | 2026-11-02 | PASS: `mgengine.m3` — point evaluation M1 → M2 checks with limiting constraint (4.18), M3a central/one-sided differences (4.17) with S_norm, status_change and ranking, M3b first infeasible value, M3c absolute and relative deltas, M3d feasible fraction; new engine code CONSTRAINT_VIOLATED; Doc 9 D-52 (K50–K58). Level-1 on Tabel 4.8: dω/dλ = −1.5708 rad/s, dω/dm = −P_L/2, loading S_norm = 1, M3c frequency delta = 0.2·dω/dλ; weak feeder: BACKWARD scheme with status change next to λ_s, first infeasible grid value after λ_s; M3d 4/6 by hand; not-reported cases (base inadmissible, h = 0, y0 = 0 not ranked); λ_c point metric = 2.0. Audit in engine/docs/m3.md. Open contract gaps for Doc 9 before WP 1.4.x: `normalised_value` may be undefined (K53), relative deltas not in Doc 3 §6.6 (K55) | check passed; engine 35 passed; Python seams 308 passed; client 12 passed; e2e not rerun (no app change) |
| 1.3.5a Stability M4a (+ M3 point metrics) | 2026-11-02 | PASS: `mgengine.m4` — M4 model (δ, P_f, Q_f; algebraic V, θ on buses without inverter), initialisation from M1 with equilibrium check, cond(g_y) ≤ 10¹², A = f_x − f_y g_y⁻¹ g_x (4.20) by central differences, modes, ζ_min, stability class (t_λ), dominant mode, participation (4.21) with cond(Φ) guard, indicators (4.23) and ε_X, outside-definition label, damping_pass; M3 points gain ZETA_MIN, RE_LAMBDA_DOM, r_τ, κ and eigenvalues; scipy added; Doc 9 D-53 (K59–K72). Level-1: oracle (4.22) on Tabel 4.8 s = −10 ± j140.86 (\|Δs\| < 10⁻³), f_osc = 22.42 Hz, ζ = 0.0708, K_s = 1.587×10⁶ W/rad, state size (N − 1) + 2N; one inverter: λ = −1/τ_P, −1/τ_Q; participation rows sum to 1; indicators by hand (R = 0 → not evaluated); load-bus reduction; two inverters on one bus → INPUT_INVALID | check passed; engine 43 passed; Python seams 308 passed; client 12 passed |
| 1.3.5b Stability M4b | 2026-11-02 | PASS: `mgengine.m4b` — LSODA (rtol 10⁻⁸) on the M4 model with absolute angles in the ω_nom frame, Newton network solve per right-hand-side call, horizon split at the disturbance and its end, up to eight retries with step limit ÷ 4, four disturbance kinds, RoCoF, classes per Gambar C.4b with K67 settling/envelope; audit engine/docs/m4.md. Level-1 on Tabel 4.8: final ω after a 1 kW step = M1 at 11 kW (10⁻⁶ rad/s), RoCoF = m ΔP/τ, oscillation of P₁ − P₂ at f_osc = 22.42 Hz (1 %), reference-inverter outage → ω* − m P_L, ω* step → Δω*/2, reverting step returns to the start; weak feeder scaled ×2 → UNSTABLE (network lost), ×1.02 → RECOVERED_STABLE; envelope → CRITERIA_VIOLATED; short window → not settled; invalid configurations → INPUT_INVALID; deterministic | check passed; engine 51 passed (4.1 s); Python seams 308 passed; client 12 passed |

## Exit gate 1.3 — Mesin perhitungan (2026-11-02)
Criterion (Tabel 4.15): "Paket PS, M1, M2 berversi untuk masuk 1.4".

| Item | Evidence |
|---|---|
| Versioned package | `engine/` = `mgengine` with its own pyproject, uv.lock and version (0.2.0 since WP 1.3.3, PS + M1 + M2 complete; 0.3.0 proposed on confirmation, K72); git commit on branch `tahap-1.3` |
| PS | `mgengine.ps`, (4.2)–(4.4), (4.13); engine/docs/m2.md |
| M1 | `mgengine.m1`, `mgengine.results`, (4.5)–(4.9), (4.1); engine/docs/m1.md |
| M2 | `mgengine.m2`, (4.10)–(4.16), Gambar C.2a–b; engine/docs/m2.md |
| Beyond the criterion | M3a–M3d (`mgengine.m3`), M4a and M4b (`mgengine.m4`, `mgengine.m4b`); engine/docs/m3.md, m4.md |
| Level-1 verification (Tabel 3.4) | Tabel 4.8 oracles: f = 49.75 Hz, Δω = 1.5708 rad/s, ε_X = 0.5 %, λ_ub = 2.0, K_s = 1.587×10⁶ W/rad, s = −10 ± j140.86, f_osc = 22.42 Hz, ζ = 0.0708; sanity checks of 4.5.2 (balance, losses ≥ 0, S² = P² + Q²); 51 engine tests |
| Isolation | Static test: only `adapters/real_engine` may import `mgengine`, the engine never imports `mgapp`; the app still runs the Fake Engine |
| Unit audit | engine/docs/m1.md–m4.md, conversion table app → engine for WP 1.4.1 |

Carried into stage 1.4 (not exit criteria):
- Contract gaps to settle by Doc 9 entries (G6) before the adapter maps them: unit of `voltage_droop_kv_per_kvar` (line-to-line or phase, D-49 m1.md); `PsPayload.epsilon_x_ratio` not in Doc 3 §6.1 (D-51); undefined `normalised_value` (D-52 K53); relative deltas in M3c (D-52 K55); `damping_pass` output (D-53 K65); M4b settling parameters (D-53 K67); engine codes EQUILIBRIUM_INVALID, MULTIPLE_INVERTERS_ON_BUS and INPUT_INVALID from M4 (D-53).
- Untested path: `ImplementationError` (λ_c > λ_ub), no legitimate input reaches it.
- Level 2 (literature cases [20], [22], [45]) not yet run; stage 1.6 validates against PSIM.
- Exit 1.2 condition (d), A2 wording, still open.

**Decision: exit gate 1.3 PASS**, confirmed by the user 2026-11-02 (Doc 9 D-53 K72). Package version raised to 0.3.0; PR `tahap-1.3` → `tahap-1.2`.

## Entry gate 1.4 — Adaptor mesin nyata (2026-11-02)
Entry criterion (roadmap): exit 1.2 + versioned engine package + advisor review. Exit 1.2 PASS (conditional, A2 wording open); `mgengine` 0.3.0 (exit 1.3 PASS). **Advisor review (tinjauan pembimbing) not yet recorded: open entry condition** (Doc 9 D-54 K73). Decision (user 2026-11-02, D-54): start stage 1.4 on branch `tahap-1.4` (from `tahap-1.3`); exit 1.4 is not PASS before the review is recorded.

| WP | Date | Result | Evidence |
|---|---|---|---|
| 1.4.1 Real Engine adapter PS, M1, M2 | 2026-11-02 | PASS: `adapters/real_engine` (`convert.py` units, `engine.py` mapping) — kV LL → V phase, Hz/kW and kV/kvar droop per D-54 K74, pf → Q (K83), per-line current limit (D-51 K43); results back in contract units; engine Status/Code 1:1 (K79), exceptions → UNAVAILABLE/ENGINE_ERROR, M3/M4 → UNAVAILABLE/NOT_APPLICABLE (K81); identity `0.3.0` + engine commit (K75); `MGAPP_ENGINE=REAL` builds it at startup, no router or service change; `mgengine` editable path dependency (K76) | `tools/check.py` all checks passed |
| 1.4.2 Tests on two adapters | 2026-11-02 | PASS: contract suite C1–C9 on FAKE and REAL; seam 1 (`api` fixture) and seam 3 (verify/rerun, canonical hash) parametrized FAKE/REAL; a test wrapper gives REAL the Fake `call_log` for zero-call checks; Fake-scripted outcome tests stay on the Fake (G5). New `tests/api/test_real_engine.py`: REAL at startup, M1 49.75 Hz / 0.4 kV / 5 kW per inverter, PS 12 kVA / 6 kVA units, M2 INFEASIBLE FREQUENCY_MIN in Hz with (4.18) margin — values derived by hand from the fixture. Fixture of the "every limit set" test gains `balance_tolerance_kw` (K84) | engine 51 passed; Python seams 395 passed; client 12 passed; E2E 15 passed |
| 1.4.3 Measuring the time budget | 2026-11-02 | MEASURED: worst PS 0.012 s, M1 0.014 s, M2 0.39 s on D1, D2, D2S, D2H (Doc 13 §4), 10 repeats, full HTTP pipeline (`tools/measure_time.py`). User decision 2026-11-02: TIME_BUDGET stays 30 s, revisit when M3/M4 join the Real adapter (D-54 K80, A-01 CLOSED) | `uv run --python 3.13 python tools\measure_time.py` |

**Exit 1.4: not PASS.** Contract suite and seams 1, 3 pass on REAL; TIME_BUDGET measured and kept at 30 s (A-01 CLOSED); K83–K85 confirmed by the user. Open: advisor review (K73), M5 steady archive (K82, stage 1.6). Decision (user 2026-11-02, D-55): proceed to stage 1.5 with these open.

## Stage 1.5 — Fitur lanjutan (2026-11-02)
Entry: exit 1.4 not PASS (advisor review, M5 archive open); user decision D-55 to proceed. Branch `tahap-1.5`.

| WP | Date | Result | Evidence |
|---|---|---|---|
| 1.5.4 Real Engine adapter M3a–M3d, M4a–M4b | 2026-11-02 | PASS: `adapters/real_engine/studies.py` applies paths, axes (PARAMETER, SCALE_FACTOR, LOAD_SCALE) and scenarios in contract units and converts back (D-55 K92–K93); M4a/M4b map engine Status/Code incl. INPUT_INVALID with issues; contract gaps of exit 1.3 closed by D-55 K87–K91 (Doc 3 updated, OpenAPI and TS types regenerated). REAL tests derived by hand: M3a df/dP = −0.025 Hz/kW, M3b f(λ) = 50 − 0.25λ, M3c Δf = −0.05 Hz, M4a state count (N − 1) + 2N, M4b final f = M1 after the step. The two-inverter fixture is small-signal unstable (λ = 6.1 ± j117 s⁻¹); M4b tests use one inverter | contract suite and seams 1, 3 on FAKE and REAL |
| 1.5.2 Sensitivity, sweep and scenarios (M3a–M3c) | 2026-11-02 | PASS: screens S-09 `/sensitivity/`, S-10 `/sweep/`, S-11 `/scenarios/` (D-56 K95–K99): Run gated on a current M1 with the FR-41 note after an INFEASIBLE M2; sweep size indicator against `sweep_cap` and F4 refusal (INPUT_INVALID / SWEEP_CAP_EXCEEDED, no engine call); Scenarios in the Project store and file; no new Fake profile needed. Tests: client (Scenario store and file round trip; overrides and parameter paths in `components/Further.test.ts`), E2E `test_further_m3.py` (FR-28, FR-29, FR-30, FR-31, FR-39, FR-44, FR-05) | client 15 passed; E2E 16 passed |

Windows: `tools/gen.py --check` failed when `PYTHONIOENCODING=utf-8` was set — the child wrote UTF-8 while the parent decoded stdout with the ANSI codepage (`§` became `Â§`). Fixed at the cause: the child gets `PYTHONIOENCODING=utf-8` and the parent decodes UTF-8 explicitly; `--check` now passes with and without the variable.
