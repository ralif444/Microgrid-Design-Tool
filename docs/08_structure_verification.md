# 08 — Development Structure and Verification

> Doc 8 of the doc set. **Aligned with the final seminar-proposal manuscript (`Seminar.pdf`, subbab 3.8, 4.3.2, 4.3.5, 4.3.8, 4.5.1–4.5.3, Tabel 3.4, 4.12) on 2026-11-01** (Doc 14 items D5, B7); the manuscript wins on any conflict. IDs (FR/NFR/DR, S-xx, endpoints) are used exactly as in Docs 2, 6, 7. Equations are allowed in design docs (user decision 2026-11-01, KONFLIK with manuscript Tabel A.3 #8, see Doc 14 A20). Phases P0–P4 of the earlier draft are replaced by stages 1.1–1.7 (Doc 10): P0 → 1.1, P1 → 1.2, P2 → 1.4, P3 → 1.5, P4 → 1.7. Prototype `App/` is reference only.

## Ringkasan
Dokumen ini menetapkan susunan folder proyek, tanggung jawab setiap modul, dan aturan penamaan yang dipakai saat aplikasi dibangun. Dokumen ini juga menjelaskan cara aplikasi diuji pada tujuh titik uji: uji API HTTP dengan Fake Engine sebagai titik uji utama, uji kontrak Engine Port, uji reproduksibilitas, uji berkas Project, uji *end-to-end* di peramban untuk empat alur utama, pemeriksaan statis, dan uji penyimpanan klien. Rangkaian uji kontrak memeriksa sembilan perilaku pada setiap adaptor dan juga dijalankan terhadap profil Fake Engine yang sengaja dibuat cacat, yang harus membuat rangkaian itu gagal. Setiap kebutuhan *Must* dan seluruh kebutuhan nonfungsional dipetakan ke satu atau lebih uji beserta tahap pertama lulusnya. Kebenaran perhitungan mesin tidak diuji oleh aplikasi web; mesin diverifikasi dan divalidasi melalui hierarki empat tingkat, dan prosedur M5 terhadap PSIM kini berada di Dokumen 13. Aturan arah ketergantungan antarmodul diperiksa otomatis saat *build* dengan import-linter dan dependency-cruiser. Dokumen ditutup dengan sepuluh syarat *Definition of Done* yang dipakai sebagai gerbang tahap di Dokumen 10.

## 1. Repository layout
```text
/
├── CLAUDE.md                      agent entry: points to docs/agents/*, glossary = Doc 3
├── README.md                      start procedure (one command), dev tasks
├── docs/                          01_brief … 14_alignment, gate_log.md
│   ├── 05_adr/                    ADR-001..010 + README index
│   └── agents/                    domain.md, issue-tracker.md, triage-labels.md
├── .scratch/                      local issue tracker (docs/agents/issue-tracker.md)
├── tools/                         stdlib Python task scripts (check, test, gen, build) — no shell-specific syntax (Windows target)
├── backend/                       Python package `mgapp`
│   ├── pyproject.toml, uv.lock    deps pinned (manuscript 4.3.9), ruff/mypy/pytest/import-linter config
│   ├── openapi/openapi.json       generated description, committed (drift test, NFR-15)
│   └── src/mgapp/
│       ├── main.py, config.py     composition root: reads startup config, picks FAKE|REAL, wires services, mounts static
│       ├── domain/                entities, enums, validation codes, AnalysisRequest/Result, RunRecord, Project file schema
│       ├── engine_port/           Engine Port interface only (run, identity)
│       ├── adapters/
│       │   ├── fake_engine/       canned results, scripts, fixture profiles, call log, defective profile
│       │   └── real_engine/       [stage 1.4] only module allowed to import the engine package
│       ├── services/              validation, limits, canonical, dependency, guard, run_record, rerun, project_file, pipeline
│       ├── api/                   routers/ (health_meta, analyses; projects, run_records from 1.2), error_mapper
│       └── static/                frontend build output copied here at build time; git-ignored (except .gitkeep)
├── frontend/                      Next.js static export (ADR-002)
│   ├── app/                       routes → screens per Doc 7 (no `api/` folder, no server actions)
│   ├── components/                unit fields, status banner, tables, charts, report sections
│   ├── store/                     single Project store (Context + reducer, ADR-005)
│   ├── api-client/                thin HTTP wrapper using generated types; only place with `fetch`
│   └── api-types/                 GENERATED from openapi.json; never hand-edited
├── tests/
│   ├── api/                       seam 1: HTTP API + Fake Engine (primary)
│   ├── contract/                  seam 2: Engine Port contract suite (adapter-parametrised)
│   ├── reproducibility/           seam 3: export → verify → rerun → REPRODUCED
│   ├── project_file/              seam 4: round-trip, migration, rejection
│   ├── e2e/                       seam 5: browser flows F1–F4 only
│   ├── static/                    seam 6: import rules, OpenAPI drift, export mode, offline, ID coverage
│   ├── client/                    seam 7: Project store and file serialiser (frontend, no browser)
│   └── fixtures/                  Fake profiles, old-version Project files, RunRecord files, tampered files
└── validation/                    offline M5 procedure (Doc 13); outside the app; must not import mgapp
```
- Only `backend/src/mgapp/static/` is a build product; `api-types/` and `openapi/openapi.json` are generated artefacts checked by seam 6.
- `validation/` has no route, no screen and no import from `mgapp` (manuscript 4.3.8); it reads RunRecord files by their Doc 3 §7 schema.
- `tests/client/` is placed under `frontend/` if the test runner requires it; the seam name stays.

## 2. Module responsibilities
Rule set = Doc 4 §6: UI → API → services → Engine Port ← adapters; domain is the shared inner module; the app never imports engine internals (NFR-10, NFR-11).

| Module | Responsibility | Allowed imports | Forbidden imports |
|---|---|---|---|
| `domain` | Entities, enums, codes, request/result/RunRecord/Project-file schemas; source of OpenAPI | stdlib, pydantic | every other app module, engine package |
| `engine_port` | Interface: run, identity | `domain` | `services`, `api`, adapters, engine package |
| `adapters/fake_engine` | Canned deterministic results, scripts, profiles, call log; no RunRecord, no file writes | `engine_port`, `domain` | `services`, `api`, `adapters/real_engine`, engine package |
| `adapters/real_engine` [1.4] | Engine package behind the port; unit conversion; identity | `engine_port`, `domain`, engine package | `services`, `api`, `adapters/fake_engine` |
| `services/guard` | Execution guard: the one Engine Port call, TIME_BUDGET, allowed-Status check | `domain`, `engine_port` | `api`, other `services` modules, concrete adapters, engine package |
| `services` (all other modules) | Validation, limits, canonicalise + hash, dependency, RunRecord, re-run orchestrator, Project file, pipeline | `domain`, `services/*` (no cycles), `services/guard` | `engine_port`, `api`, concrete adapters, engine package |
| `api` | Transport; outcomes → HTTP 200 bodies; 404/4xx/5xx | `services`, `domain` | `engine_port`, adapters, engine package |
| `main`/`config` (composition root) | Startup config, choose adapter once, wire, mount static | everything (wiring only) | request-time logic |
| `frontend/app`, `components` | Screens and widgets | `store`, `api-client`, `api-types` (type-only) | `backend/**`, `fetch` outside `api-client` |
| `frontend/store` | Project, RunRecords, freshness flags | `api-types` (type-only) | `components`, `app`, `api-client` |
| `frontend/api-client` | HTTP calls | `api-types` | `store`, `components`, `app` |
| `frontend/api-types` | Generated types | nothing | hand edits |
| `tests/api`, `tests/project_file`, `tests/reproducibility` | External behaviour through HTTP | HTTP client, composition-root factory (inject a Fake instance), fixtures | service internals (highest seam) |
| `tests/contract` | Same suite against each adapter | `engine_port`, `domain`, adapters | `services`, `api` |
| `validation/` | Offline M5 procedure | RunRecord file schema, engine package | anything in `mgapp` |

How checked (decided, manuscript 4.3.1; any violation fails the build):

| Check | Mechanism |
|---|---|
| Python layering and forbidden imports (table above; engine package only from `real_engine`; `engine_port` only from `services/guard` among services) | import-linter contracts (layers + forbidden + independence) |
| Frontend boundaries (nothing imports `backend`; `fetch` only in `api-client`; no `app/api`) | dependency-cruiser rules + a static scan for `fetch(` |
| The checks themselves work | negative test: a fixture module with a deliberate violation must make each checker fail |
| Static-export mode, no API routes or server actions | seam 6 check on `next.config` and build output |
| Generated artefacts current | seam 6: regenerate OpenAPI and TS types, fail on diff |

## 3. Naming and coding conventions
| Topic | Convention |
|---|---|
| Wire format | `snake_case` JSON fields, `UPPER_SNAKE_CASE` enums, UTC ISO 8601 `Z` timestamps (Doc 3 §1, Doc 6 §1). |
| Units in names | Unit suffix on every dimensioned field (`_kw`, `_kvar`, `_kva`, `_kv`, `_hz`, `_ohm_per_km`, `_km`, `_a`, `_s`, `_kwh`, `_pu`; `_ratio` for unitless ratios). No new unit spelling without a Doc 3 change. |
| Entities | Fixed vocabulary of Doc 3 (Project, Bus, Line, Load, LoadProfile, Inverter, DesignConstraints, SizingAdvice, SizingCheck, Scenario, AnalysisRequest, AnalysisResult, RunRecord, Status, Engine Port, Fake Engine, Real Engine adapter). No synonyms (DR-09). |
| Files and identifiers | Python `snake_case` modules/functions, PascalCase classes. TypeScript components PascalCase, other files kebab-case. Route folders equal Doc 7 paths. |
| Test names | Include requirement IDs: `test_fr_38_m2_unavailable_when_m1_stale`. A test covering several IDs lists all. The seam-6 coverage script reports FR/NFR IDs with no test (NFR-09). |
| Generated code | `frontend/api-types/` and `openapi/openapi.json` carry a "generated, do not edit" header. |
| Python tooling | uv + `uv.lock`; ruff (format + lint), mypy (strict on `src`), pytest, import-linter (user decision 2026-11-01). |
| TypeScript tooling | npm + `package-lock.json`; ESLint, `tsc --strict`, Vitest, Playwright, dependency-cruiser. |
| Task runner | `tools/*.py` stdlib scripts: `check`, `test`, `gen`, `build_frontend`; app start `uv run mgapp` (NFR-02). |
| Comments and docs | Public functions state units in docstrings. |
| Git (solo) | Branch per stage (`tahap-1.1`); one commit per work package or coherent change, imperative subject, WP/FR IDs in body; PR to `main` at the stage exit gate. |
| Issues | Local Markdown in `.scratch/<feature-slug>/issues/NN-<slug>.md`; labels from `docs/agents/triage-labels.md`. |

## 4. Verification strategy

### 4.1 Application: seven test seams (manuscript Tabel 4.12)
**Principle:** test external behaviour at the highest seam. Passing on the Fake Engine proves conformance to the contract, not correctness of calculations (manuscript 3.8).

| # | Seam (manuscript name) | What it proves | Engine | Tooling |
|---|---|---|---|---|
| 1 | HTTP API test (primary) | Status, payload, RunRecord, validation, limits, time budget, dependency check, HTTP mapping (200 for all analysis outcomes, no 422) | Fake; Real from 1.4 for PS/M1/M2 | pytest + FastAPI TestClient |
| 2 | Engine Port contract test | Every adapter obeys one suite of nine behaviours (§4.2); the suite fails on the defective Fake profile | Fake; Real from 1.4 | pytest, adapter as parameter |
| 3 | Reproducibility test | RunRecord export → verify → rerun ends REPRODUCED, DIFFERS or refused; version mismatch warns and runs; imported record untouched | Fake; Real from 1.4 | pytest over HTTP + fixtures |
| 4 | Project file test | Save/open round trip, migration, refusal of unknown/newer/malformed; failed open changes nothing | none | pytest + fixture files |
| 5 | Browser E2E | Four flows F1–F4; Status banners, units, in-progress state, report, print layout | Fake with a test profile | Playwright, Chromium (Chrome at gate) |
| 6 | Static checks | Import rules, OpenAPI ↔ generated types current, export-mode build, no external URLs, loopback default, requirement-ID coverage | none | import-linter, dependency-cruiser, scripts |
| 7 | Client store test | Browser-only behaviour (stateless server): edit read-back, Bus delete guard, advice accept/skip, Scenario snapshots, stale-M1 flag, serialisation | none | Vitest |

Proposal text labels these seams UJ1–UJ7 to avoid clashing with skripsi objectives (UP-13, 2026-10-18).

### 4.2 Contract suite: nine behaviours
Run on each adapter (manuscript 4.3.2, 4.5.1); the same file runs on the Real Engine adapter from stage 1.4 without change.

| # | Behaviour | Example assertion |
|---|---|---|
| C1 | Exactly one Status per request with non-empty `status_code` and `message`; unsupported type → `UNAVAILABLE`/`NOT_APPLICABLE` | every scripted outcome |
| C2 | Status within the allowed set of Doc 4 §5.2; M1 never `INFEASIBLE` | per analysis_type |
| C3 | `INFEASIBLE` has non-empty `limiting_constraints` with valid kind, element, unit, negative margin | M2 canned |
| C4 | Payload presence follows the Status table (null for INPUT_INVALID, SOLVER_FAILED, UNAVAILABLE) | per Status |
| C5 | Payload fields match Doc 3 §6 for the type | schema validation |
| C6 | Deterministic and stateless: repeated and re-ordered calls give equal results | 2 × call, shuffled order |
| C7 | Request not mutated; no RunRecord or file produced | deep copy compare; temp-dir check |
| C8 | Identity (kind, version, commit) non-empty and stable | 2 × identity |
| C9 | Failures surface as Statuses, never as exceptions | all failure outcomes |

**Defective Fake profile** (negative test of the suite itself): returns M1 `INFEASIBLE` (and other deliberate breaches, one per behaviour where practical). The test asserts that the suite **fails** on that profile. The raise mode (ENGINE_ERROR test of the guard) is excluded from the suite because a conforming engine never throws.

### 4.3 Engine: four-level V&V (manuscript Tabel 3.4)
Each lower level must pass before differences at a higher level are analysed.

| Level | Form | Comparator | Isolates | Stage |
|---|---|---|---|---|
| 1 | Verification | Analytic oracles and hand calculation (Eq. 4.16 λ_ub, Eq. 4.22, Tabel 4.8) | Implementation and solver errors | 1.3 |
| 2 | Verification | Literature cases with full data [20], [22], [45] (order of magnitude) | Formulation | 1.3 |
| 3 | Validation layer 1 | PSIM averaged model equivalent to engine assumptions | Numerical error and network assumptions (A1, A4) | 1.6 |
| 4 | Validation layer 2 | PSIM detailed switching model | Ideal-inverter assumption (A2) and measurement chain | 1.6 |

Sanity checks at every level: power balance, non-negative losses, S² = P² + Q², monotonicity of voltage and loading versus load, complex-conjugate eigenvalue pairs; reported without adjustment. Engine tests live with the engine package, not in the app repo seams.

## 5. Fake Engine test fixtures
**Selection mechanism (decided, manuscript 4.3.2):** never a request field, never an HTTP route.
- *In-process tests (seams 1–4):* the test builds the app through the composition-root factory and passes a Fake Engine instance with a **script** (analysis_type → named outcome, optional delay, optional raise). The instance exposes a **call log** (count, analysis_type) for "zero engine calls" assertions.
- *E2E (seam 5):* the process starts with startup configuration naming a **fixture profile** (FAKE, profile name, optional shortened TIME_BUDGET). One server start per profile.
- Default profile = demo behaviour: all analyses FEASIBLE; every result carries `engine_kind` FAKE and warning `ENGINE_KIND_FAKE`.
- Payloads are placeholders derived from the snapshot (nominal voltage and frequency, zero losses, element ids from the request); no invented physics (user decision 2026-11-01).
- Named outcomes are deterministic (NFR-14).

**Coverage matrix** (A = application layer, no engine call; F = canned by the Fake; — = not allowed, Doc 4 §5.2):

| analysis_type | FEASIBLE | INFEASIBLE | SOLVER_FAILED | PHYSICALLY_INADMISSIBLE | INPUT_INVALID | UNAVAILABLE |
|---|---|---|---|---|---|---|
| PS | F | — | — | — | A | A (TIMEOUT), F (NOT_APPLICABLE) |
| M1 | F | **rejected by contract** | F | F | A | A (TIMEOUT), F (NOT_APPLICABLE) |
| M2 | F | F (≥ 2 limiting constraints) | — | — | A | A (DEPENDENCY_NOT_MET, TIMEOUT), F (NOT_APPLICABLE) |
| M3a–M3d | F (per-point Status in payload, incl. INFEASIBLE) | — at top level | — | — | A (incl. SWEEP_CAP_EXCEEDED) | as M2 |
| M4a, M4b | F (class in payload) | — | F | — | A | as M2 |

| Case | How produced | Asserted |
|---|---|---|
| Each allowed Status on demand (NFR-07) | script per Status | Status, non-empty code and message; RunRecord exists |
| `INPUT_INVALID` | invalid request or request-model failure (`MALFORMED_REQUEST`) | zero engine calls; HTTP 200; RunRecord with null engine fields (FR-17, FR-46) |
| `DEPENDENCY_NOT_MET` variants | `depends_on` missing; M1 not FEASIBLE; snapshot hash differs (stale); `result_hash` altered | zero engine calls; message names M1; stale worded as stale (FR-38, FR-40) |
| `TIMEOUT` | Fake delay above a shortened test TIME_BUDGET | RunRecord created; engine fields filled (engine was called) (FR-43) |
| `ENGINE_ERROR` | Fake raise mode; Fake returning a disallowed Status | `UNAVAILABLE`, never `SOLVER_FAILED`; RunRecord; logged |
| `NOT_APPLICABLE` | profile without support for a type | route exists, HTTP 200, RunRecord |
| Over-cap sweep | request above SWEEP_CAP | `INPUT_INVALID`/`SWEEP_CAP_EXCEEDED`; zero engine calls (FR-44) |
| Defective profile | M1 `INFEASIBLE` etc. | **contract suite fails** |
| Version mismatch | Fake identity differs from stored RunRecord | warning plus run (FR-51) |
| Slow within budget | delay below budget | E2E in-progress indicator (FR-45) |

**Canonicalisation tests (WP 1.1.4, manuscript 4.3.5):** one test per rule — key order variants hash equal; entity arrays in different order hash equal; `1.0` and `1` hash equal, `-0` equals `0`, NaN/Infinity refused; escaping of non-ASCII and control characters; known-answer vectors for SHA-256 lowercase hex; one changed value changes the hash; server overwrites client `r_ohm`, `x_ohm` and hashes.

## 6. Requirement ↔ test mapping
Stage = first stage in which the test must pass. From stage 1.4 the contract suite runs on both adapters, and the seam-1 and seam-3 tests for PS, M1 and M2 run unchanged with the Real Engine adapter selected at startup.

### 6.1 Must functional requirements
| Requirement IDs | Test (short name) | Seam | Stage |
|---|---|---|---|
| FR-01, FR-10, FR-12, FR-13 | new_project_empty; add/edit/delete Bus, Line, Inverter read-back | 7 | 1.2 |
| FR-03, FR-18 | load_rows_valid_and_rejected → INPUT_INVALID naming field | 1 | 1.2 (M1 route: 1.1) |
| FR-05 | openapi_every_numeric_field_declares_unit; ui_every_numeric_input_has_unit_label | 6, 5 | 1.1 (OpenAPI), 1.2 (UI) |
| FR-06, FR-07 | ps_returns_advice_with_basis_and_assumptions; storage stage named; RunRecord | 1 | 1.2 |
| FR-08 | advice_not_design_until_accept | 7, 5 | 1.2 |
| FR-15 | constraints_in_snapshot (hash changes when a constraint changes) | 1, 7 | 1.2 |
| FR-17, FR-19 | invalid_request_zero_engine_calls; isolated Bus / no Inverter / duplicate Line | 1 | 1.1 (core), 1.2 (full) |
| FR-21 | schema_valid_not_rejected_on_physics (canned PHYSICALLY_INADMISSIBLE reaches user) | 1 | 1.1 |
| FR-22, FR-23 | m1_allowed_statuses; m1_payload_groups_with_units; m1_infeasible_rejected_by_suite | 1, 2 | 1.1 (Real: 1.4) |
| FR-24, FR-25, FR-27 | m2_feasible_and_infeasible; limiting_constraints_typed; sizingcheck_separate | 1 | 1.2 (Real: 1.4) |
| FR-35, FR-36 | six_statuses_have_code_and_message; three_failure_messages_distinct | 1, 2 | 1.1 |
| FR-37 | unavailable_names_m1 | 1 | 1.1 |
| FR-38, FR-40 | m2_unavailable_when_m1_missing / failed / stale / result_hash_altered | 1 | 1.1 |
| FR-42, FR-43 | no_job_route; timeout_returns_unavailable_with_runrecord | 1, 6 | 1.1 |
| FR-46, FR-47, FR-48 | runrecord_for_every_status; seventeen_fields; engine_fields_null_when_not_called; canonical hash tests (§5) | 1 | 1.1 |
| FR-49 | runrecord_download_is_one_file; accepted by verify | 5, 3 | 1.2 |
| FR-50, FR-52, FR-53 | import_unchanged_accepted; tampered_refused; rerun_reproduced; rerun_differs_listed; imported_unchanged | 3 | 1.2 |
| FR-54, FR-55, FR-57 | save_contains_schema_version; load_save_equal; newer_version_rejected_project_unchanged | 4, 7 | 1.2 |
| FR-58, FR-59 | report_has_table_and_chart; infeasible_report_in_plain_words | 5 | 1.2 |

### 6.2 Should and Could functional requirements
| Requirement IDs | Test (short name) | Seam | Stage |
|---|---|---|---|
| FR-02, FR-09, FR-16, FR-30 | name persists; advice prefills Inverter; no numeric defaults, empty limit "not evaluated"; scenario snapshot independent | 7, 1 | 1.5 (FR-16 not-evaluated payload: 1.2) |
| FR-04 | profile_24_points_ok, other_length_input_invalid | 1, 7 | 1.5 |
| FR-11 | bus_delete_refused_naming_dependents | 7, 1 | 1.5 |
| FR-14, FR-45, FR-60 | diagram; in_progress_indicator; print_layout_not_clipped | 5 | 1.5 |
| FR-20 | two_violations_both_listed | 1 | 1.1 (all issues collected) |
| FR-26 | margins_per_constraint; near_limit_row_highlighted | 1, 5 | 1.5 |
| FR-28, FR-29, FR-31–FR-34 | M3a–M3d, M4a, M4b payload groups; parameter/scenario/disturbance validation | 1 | 1.5 |
| FR-39, FR-41 | dependent_types_unavailable_without_valid_m1; allowed_on_infeasible_design | 1 | 1.1 (dependency rule), 1.5 |
| FR-44 | sweep_one_above_cap_input_invalid_zero_calls; at cap accepted; F4 E2E | 1, 5 | 1.1 (API), 1.5 (E2E) |
| FR-51 | version_mismatch_warning_and_runs | 3, 5 | 1.5 |
| FR-56 | older_fixture_migrated_with_notice | 4 | 1.5 |

### 6.3 Non-functional and documentation requirements
| Requirement IDs | Test (short name) | Seam | Stage |
|---|---|---|---|
| NFR-01 | export_import_rerun_same_status_and_hash | 3 | 1.2 |
| NFR-02 | one_command_serves_ui_and_api_same_process | 6 (smoke) | 1.1 |
| NFR-03 | key_flow_offline; no external URL, CDN or font in build output | 5, 6 | 1.1 (static), 1.2 (E2E) |
| NFR-04 | timeout mechanism (1.1); TIME_BUDGET measured (WP 1.4.3) | 1 | 1.1 (value: 1.4) |
| NFR-05 | see FR-05 | 6, 5 | 1.1 |
| NFR-06 | message_non_empty_for_six_statuses; message review (WP 1.7.2) | 2, review | 1.1 |
| NFR-07, NFR-14 | fake_returns_every_status; repeated_calls_equal | 2 | 1.1 |
| NFR-08 | same_suite_file_runs_on_both_adapters | 2 | 1.1 (Real: 1.4) |
| NFR-09 | every_fr_id_has_a_named_test (report per stage) | 6 | 1.1 (report), 1.2 (no Must gap) |
| NFR-10, NFR-11 | import_rules_pass; negative tests fail as expected | 6 | 1.1 |
| NFR-12, NFR-16 | fixture opens elsewhere; failed import leaves state equal | 4, 3, 7 | 1.2 |
| NFR-13 | key flows pass on latest stable Chrome (version in test log) | 5 | 1.2 |
| NFR-15 | openapi_matches_schemas; TS types regenerate without diff | 6 | 1.1 |
| NFR-17 | default bind is 127.0.0.1 | 6 | 1.1 |
| NFR-18 | stage gates evidenced in `docs/gate_log.md` | review | every stage |
| DR-01..DR-09 | Ringkasan present; IDs and Given/When/Then; register complete; DR-08 cancelled (Doc 14 A20) | review | 1.7 |

## 7. Engine validation against PSIM (M5)
The procedure (reference designs D1, D2, D2S, D2H; 11 cases in four families; two PSIM layers; tolerance policy v1 frozen before simulation; nine steps of Gambar C.7a–C.7b) is in **Doc 13**. The app's only obligations: RunRecords carry snapshot, hashes, solver config and engine identity; FAKE records are refused by the M5 script; `validation/` does not import `mgapp`.

## 8. Definition of Done (ten conditions, manuscript 4.5.1)
Used by the stage gates in Doc 10.
1. Every requirement ID in the increment has at least one named test (§6) and it passes.
2. Seams 1 and 2 green on the Fake Engine; from stage 1.4 also seam 2, and seams 1 and 3 for PS/M1/M2, green on the Real Engine adapter.
3. Seam 6 green: import rules (incl. negative tests), OpenAPI and generated types current, export-mode build, no external assets, ID coverage shows no gap for the stage.
4. No engine maths in app code; `INFEASIBLE` is never returned by M1 in any non-defective fixture.
5. Every new numeric field has a unit in its name, in OpenAPI and in the UI label.
6. Every new Status path has a plain-language message and a RunRecord (FR-35, FR-46).
7. Affected E2E flows (F1–F4) pass on the Fake Engine; in-scope screens reachable by keyboard.
8. Docs touched by the change are updated; new [ASSUMPTION] / [PERLU VERIFIKASI] tags added to Doc 9.
9. Open issues in `.scratch/` for the increment resolved or re-triaged.
10. Start procedure still needs exactly one command and works offline (NFR-02, NFR-03).

[ASSUMPTION: the manuscript states "ten conditions, including named passing tests per requirement and passing on both adapters from stage 1.4" but does not list them; this list is the Doc 8 (2026-10-21) list with stage names, which also has ten items.]

## 9. Open points
| # | Item | Tag | → doc |
|---|---|---|---|
| 1 | Client-behaviour FRs (FR-01, FR-08–FR-13, FR-30, FR-49, FR-54, FR-55) tested in seam 7 and seam 4 under the Doc 2 §1 convention. | RESOLVED (C5.13) | 2 |
| 2 | Disallowed Status at runtime → `UNAVAILABLE`/`ENGINE_ERROR`, logged. | DECIDED (manuscript 4.3.2) | 3 |
| 3 | Fake control: in-process script + call log; E2E via startup profile; no test route. | DECIDED (manuscript 4.3.2) | 6 |
| 4 | Browser: latest stable Google Chrome at gates; Playwright Chromium in CI-like runs; version logged. | DECIDED (manuscript 4.3.9) | 2 |
| 5 | Tool choices (§3). | DECIDED (user 2026-11-01) | 9 |
| 6 | Package name `mgapp` (manuscript 4.3.8); file extensions `.mgproj.json` / `.mgrun.json`. | `mgapp` DECIDED; extensions [ASSUMPTION] | 6, 9 |
| 7 | Test TIME_BUDGET and caps shortened in test config; production initial values from `/api/meta`. | DECIDED | 6 |
| 8 | Tolerance policy and M5 cases. | → Doc 13 | 13 |
| 9 | DoD list reconstructed (see §8 note). | [ASSUMPTION] | — |

## Log
| Date | Change |
|---|---|
| 2026-10-17 – 10-21 | Drafted; C5.2–C5.4, C5.8, C5.12, C5.13, UP-06, UP-13. |
| 2026-11-01 | Aligned with the manuscript (Doc 14 D5, B7): seven seams with manuscript names; nine contract behaviours listed; defective Fake profile as negative test; canonicalisation tests in WP 1.1.4; four-level engine V&V (Tabel 3.4); M5 procedure moved to Doc 13; DoD ten conditions; stages 1.1–1.7 replace P0–P4; tools decided (uv, npm, ruff, mypy, pytest, import-linter, Vitest, Playwright, dependency-cruiser); `tools/` task scripts; no-equations guardrail removed. |
