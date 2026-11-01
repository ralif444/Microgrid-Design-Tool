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
