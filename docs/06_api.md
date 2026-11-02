# 06 — API Contract

> Doc 6 of the doc set. **Aligned with the final seminar-proposal manuscript (`Seminar.pdf`, subbab 4.3.2–4.3.6) on 2026-11-01** (Doc 14 items B1–B6); the manuscript wins on any conflict. Entity fields, units, enums and payloads are owned by Doc 3 and only referenced here. Equations allowed (user decision 2026-11-01). Post-proposal extension endpoint 16 (`/api/catalogs/import`, Doc 12) is not part of v1 baseline until stage 1.5.

## Ringkasan
Dokumen ini menetapkan kontrak API antara antarmuka peramban dan server lokal. Ada lima belas titik akhir: dua untuk kesehatan dan versi, dua untuk berkas Project, sembilan untuk analisis (satu per jenis analisis), dan dua untuk RunRecord. Setiap hasil analisis, apa pun statusnya, dikembalikan dengan kode HTTP 200 beserta RunRecord, sedangkan kode 4xx hanya untuk masalah transport, dengan batas awal badan permintaan 10 MiB. Server tidak menyimpan apa pun, sehingga setiap permintaan memuat semua data yang dibutuhkan, termasuk rujukan ke hasil M1 untuk analisis lanjutan. Nilai awal kendali eksekusi adalah anggaran waktu 30 s, batas sapuan 1.000 titik, dan ambang peringatan margin 0,05, yang akan diganti dengan hasil pengukuran. Setiap hasil Fake Engine membawa peringatan ENGINE_KIND_FAKE. Dokumen ini juga memuat bentuk pesan, himpunan status per analisis, tabel galat, format berkas, dan contoh pertukaran.

---

## 1. Conventions
| Topic | Convention |
|---|---|
| Base path | `/api`, same origin as the bundled static UI served by the same process. |
| Format | JSON, UTF-8, `Content-Type: application/json`. |
| Binding / auth | Loopback only; no authentication (NFR-17). |
| Contract source | OpenAPI generated from Pydantic schemas [83]; TypeScript types generated from it [84]; consistency checked by regeneration (manuscript 4.3.4, 4.3.8). |
| Field naming | Doc 3 §1. |
| Versions | `GET /api/meta`: `app_version`, `schema_version` (Project file), `record_schema_version` (RunRecord), `api_description_version`, engine identity. |
| Idempotency | No server-side side effects; same request → same domain result; `record_id`, `created_at` differ per call. |
| Statelessness | Every request is self-contained (snapshot, parameters, solver_config, `depends_on` for dependent analyses, `scenarios` for M3c). |
| `analysis_type` | From the route only. |
| HTTP mapping | Every analysis outcome, including INPUT_INVALID, TIMEOUT and ENGINE_ERROR, is HTTP 200 with AnalysisResult and RunRecord. Request-model failures are converted to INPUT_INVALID; no `/api` route returns 422. 4xx = transport only (400, 404, 405, 413, 415); 5xx = app defect (manuscript 4.3.6). |
| Sync execution | One request, one response. Revisit if engine time often exceeds the budget. |
| Persistence | Project and RunRecord export is a client-side download; import posts the file content. Report is client-side (print to PDF). |
| Engine choice | Fixed at startup (FAKE or REAL); `/api/meta` reports it. |

---

## 2. Endpoint list
15 endpoints (manuscript 4.3.6).

| # | Method | Path | Purpose | Request body | Response (HTTP 200) | FR IDs |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/health` | Liveness. | — | `{status: "OK"}` | NFR-02 |
| 2 | GET | `/api/meta` | Versions, engine identity, limits. | — | MetaInfo | FR-05, FR-43, FR-44, FR-51, NFR-15 |
| 3 | POST | `/api/projects/validate` | Stage-1 validation for live feedback and the stale-M1 check; no RunRecord, no engine call. | ValidateRequest | ValidationReport | FR-03, FR-04, FR-15, FR-17–FR-21, NFR-06 |
| 4 | POST | `/api/projects/import` | Project file check: version, forward migration, refusal, stage-1 validation after migration. | Project file JSON | ImportResponse | FR-54–FR-57, NFR-16 |
| 5 | POST | `/api/analyses/PS` | Saran kapasitas awal. | AnalysisRequestBody | AnalysisResponse | FR-06–FR-08, FR-17, FR-35, FR-42, FR-46 |
| 6 | POST | `/api/analyses/M1` | Droop power flow. | AnalysisRequestBody | AnalysisResponse | FR-22, FR-23, FR-35, FR-36, FR-42, FR-43, FR-46–FR-48 |
| 7 | POST | `/api/analyses/M2` | Constraint check, SizingCheck, λ_c/λ_s. | + `depends_on` | AnalysisResponse | FR-24–FR-27, FR-37, FR-38, FR-40, FR-46 |
| 8 | POST | `/api/analyses/M3a` | Local sensitivity. | + `depends_on` | AnalysisResponse | FR-28, FR-39, FR-41, FR-46 |
| 9 | POST | `/api/analyses/M3b` | 1-D sweep. | + `depends_on` | AnalysisResponse | FR-29, FR-39, FR-41, FR-44, FR-46 |
| 10 | POST | `/api/analyses/M3c` | Scenario comparison. | + `depends_on`, `scenarios` | AnalysisResponse | FR-30, FR-31, FR-39, FR-41, FR-46 |
| 11 | POST | `/api/analyses/M3d` | 2-D envelope. | + `depends_on` | AnalysisResponse | FR-32, FR-39, FR-41, FR-44, FR-46 |
| 12 | POST | `/api/analyses/M4a` | Small-signal stability. | + `depends_on` | AnalysisResponse | FR-33, FR-39, FR-41, FR-46 |
| 13 | POST | `/api/analyses/M4b` | Transient stability. | + `depends_on` | AnalysisResponse | FR-34, FR-39, FR-41, FR-46 |
| 14 | POST | `/api/run-records/verify` | Check an imported RunRecord: schema, both hashes, engine identity. Modifies nothing. | `{run_record}` | VerifyResponse | FR-47, FR-50, FR-51, NFR-16 |
| 15 | POST | `/api/run-records/rerun` | Verify, then re-execute the stored input through the same pipeline; new RunRecord with `replay_of_record_id`; ReproductionReport. | `{run_record}` | RerunResponse | FR-50–FR-53, NFR-01 |

Notes: export has no endpoint (client download). Unknown `analysis_type` (e.g. `/api/analyses/M9`) → 404 `UNKNOWN_ANALYSIS_TYPE`, no RunRecord. A routed type that the active adapter does not yet support → HTTP 200, `UNAVAILABLE / NOT_APPLICABLE` with a RunRecord (manuscript 4.5.1); all nine routes are registered from stage 1.1.

---

## 3. Shapes
Entities, AnalysisRequest, AnalysisResult, LimitingConstraint, RunRecord, RunRecordRef and payloads: Doc 3.

### 3.1 AnalysisRequestBody
| Field | Type | Required | Note |
|---|---|---|---|
| project_snapshot | object | Y | Entered values; the server derives `r_ohm`, `x_ohm`, canonicalises and hashes, overwriting client values. |
| parameters | object | Y | Per type (§4); `{}` when none. |
| solver_config | {mismatch_tolerance_w, max_iterations, initial_guess} | Y | Defaults $10^{-3}$, 50, DEFAULT (Doc 3 §5.1). Ignored by PS. |
| depends_on | RunRecordRef | M2, M3a–d, M4a–b | Absent for PS/M1 (else DEPENDS_ON_NOT_ALLOWED). |
| scenarios | array of {scenario_id, label, project_snapshot} | M3c only | |

### 3.2 AnalysisResponse
| Field | Type | Required | Note |
|---|---|---|---|
| result | AnalysisResult | Y | One of six Statuses; `result.warnings` carries non-blocking notices (Doc 3 §5.2). |
| run_record | RunRecord | Y | Created for every request; `run_record.result` equals `result`; engine fields null when the engine was not called. |

### 3.3 Warning (inside AnalysisResult)
`{code, message, path}`. Codes in v1: `ENGINE_KIND_FAKE` (every Fake result; decided, manuscript 4.3.2), `ENGINE_VERSION_MISMATCH` (re-run), `PROFILE_PEAK_ABOVE_LOADS` (PS), `RATING_MARGIN_SHORT` (M2), `VALIDITY_NOT_CALIBRATED` (M4 until stage 1.6), `CONSTRAINT_NOT_EVALUATED` (M2 with empty limits). Warnings are outside `result_hash` (which covers status and payload only).

### 3.4 ValidateRequest / ValidationReport / ValidationIssue
| ValidateRequest | Type | Required | Note |
|---|---|---|---|
| project_snapshot | object | Y | |
| target_analysis_type | enum or null | N | Selects rules (PS needs Loads only; M1 onward adds NO_INVERTER, DISCONNECTED_NETWORK; M4 adds TAU_MISSING_FOR_M4). Null = M1 rules. |
| parameters | object or null | N | For request-level checks before sending. |

| ValidationReport | Type | Note |
|---|---|---|
| valid | boolean | True iff no issues. |
| issues | array of ValidationIssue | All violations (FR-20). |
| snapshot_hash | 64 hex | Hash of the snapshot as submitted, for the stale-M1 flag. |

ValidationIssue: `{code, level (field, entity, topology, request), entity, id, field, message}`.

### 3.5 FileCheckResult (not a Status)
`{accepted, code (OK, MIGRATED, UNKNOWN_SCHEMA_VERSION, UNMIGRATABLE, HASH_MISMATCH, MALFORMED_FILE), message, details[{path, code, message}]}`.

### 3.6 ImportResponse
`{file_check, project (migrated document or null), migrated_from_version (int or null), validation (ValidationReport or null)}`.

### 3.7 VerifyResponse
`{file_check, engine_comparison}`; EngineComparison = `{stored{engine_kind, engine_version, engine_git_commit}, current{…}, differs (bool or null)}`; `differs` null when a stored value is null.

### 3.8 RerunResponse and ReproductionReport
RerunResponse = `{file_check, analysis (AnalysisResponse or null), reproduction (ReproductionReport or null)}`; nothing runs when the file check fails.

ReproductionReport = `{outcome (REPRODUCED, DIFFERS), differences[{path, kind (STATUS, STATUS_CODE, VALUE, MISSING_FIELD, EXTRA_FIELD), stored, current}], version_mismatch (EngineComparison or null), solver_tolerance (informational or null)}`. REPRODUCED iff status and result_hash are equal (manuscript 4.3.5).

### 3.9 MetaInfo
| Field | Type | Note |
|---|---|---|
| app_version, schema_version, record_schema_version, api_description_version | string / integer | |
| engine | {engine_kind, engine_version, engine_git_commit} | From Engine Port `identity()`. |
| limits | {time_budget_s: 30, sweep_cap: 1000, margin_warn: 0.05, body_limit_mib: 10, scenario_cap: null, m3a_parameter_cap: null, m4b_duration_cap_s: null} | Initial values from manuscript 4.1.3 and 4.3.6; replaced by measurements at WP 1.4.3 (time budget) and 1.7.1 (sweep cap, margin warn, body limit); null = not yet fixed. |
| indicator_threshold_version | string or null | Null until thresholds are calibrated at stage 1.6. |

### 3.10 TransportError
`{code, message}` — no stack trace.

---

## 4. Per-analysis request specifics
Parameters: Doc 3 §6. INPUT_INVALID and UNAVAILABLE are possible for every type.

| analysis_type | depends_on | parameters | Checked before engine call | Additional allowed Status (manuscript 4.3.2) |
|---|---|---|---|---|
| PS | absent | `inverter_margin_ratio`, `unit_count`, `redundancy` (required); `autonomy_h`, `dc_efficiency_ratio`, `depth_of_discharge_ratio` (optional) | PS_PARAMETER_INVALID | FEASIBLE |
| M1 | absent | `{}` | topology, NO_INVERTER, NO_LOAD | FEASIBLE ("operating point found"), SOLVER_FAILED, PHYSICALLY_INADMISSIBLE; never INFEASIBLE |
| M2 | required | `inverter_margin_ratio`, `line_margin_ratio` (required); `autonomy_h`, `dc_efficiency_ratio`, `depth_of_discharge_ratio` (optional) | SIZING_MARGIN_INVALID | FEASIBLE, INFEASIBLE |
| M3a | required | `parameter_paths[]`, `output_metrics[]`, exactly one of `step_relative` / `step_absolute` | parameter cap; SENSITIVITY_STEP_INVALID | FEASIBLE (request completed) |
| M3b | required | `axis`, optional `point_metrics[]`, `include_eigenvalues` | step_count ≤ SWEEP_CAP; TAU_MISSING_FOR_M4 when M4 metrics requested | FEASIBLE; per-point Status in payload |
| M3c | required (hash vs base snapshot) | `reference_scenario_id` (optional) + `scenarios[]` | 2 ≤ count ≤ SCENARIO_CAP | FEASIBLE; per-scenario Status in payload |
| M3d | required | `axis_x`, `axis_y`, optional `point_metrics[]`, `include_eigenvalues` | product of step counts ≤ SWEEP_CAP | FEASIBLE; per-point Status in payload |
| M4a | required | optional `tau_in_s`, `damping_threshold_ratio` | TAU_MISSING_FOR_M4 | FEASIBLE (stability class in payload), SOLVER_FAILED |
| M4b | required | `disturbance{kind, element_id, reference, magnitude, magnitude_kvar, start_time_s, duration_s}`, `simulation_end_s` | DISTURBANCE_INVALID, duration cap, TAU_MISSING_FOR_M4 | FEASIBLE (transient class in payload), SOLVER_FAILED |

A Status outside the allowed set → UNAVAILABLE / ENGINE_ERROR.

**Pipeline order (manuscript 4.3.3, Gbr C.5a–C.5b):** stage-1 validation collects all issues → size limits (SWEEP_CAP_EXCEEDED etc.) → canonicalise and hash (SHA-256) → dependency check (three parts) → execution guard with time budget around the Engine Port call → RunRecord creation. Only the execution guard imports the Engine Port.

**Dependency check:** `depends_on.status` = FEASIBLE; `depends_on.snapshot_hash` = request snapshot hash (M3c: base); hash of `{status, result_payload}` = `depends_on.result_hash`. Failure or absence → UNAVAILABLE / DEPENDENCY_NOT_MET, no engine call; message names M1 and says "stale" when only the snapshot hash differs.

---

## 5. Status and error model

### 5.1 Analysis outcomes (HTTP 200 with AnalysisResponse)
| Outcome | status / status_code | RunRecord | Engine called |
|---|---|---|---|
| Success | FEASIBLE / OK | Yes | Yes |
| Constraint violation (M2) | INFEASIBLE / CONSTRAINT_VIOLATED | Yes | Yes |
| No convergence / numerical failure | SOLVER_FAILED / NO_CONVERGENCE, MAX_ITERATIONS_REACHED, ILL_CONDITIONED_JACOBIAN, NON_FINITE, EIGEN_SOLVER_FAILED, SIMULATION_FAILED | Yes | Yes |
| Non-physical solution (M1) | PHYSICALLY_INADMISSIBLE / OPERATING_POINT_NOT_PHYSICAL | Yes | Yes |
| Stage-1 rule broken or size limit exceeded | INPUT_INVALID / Doc 3 §4 code or MULTIPLE_ISSUES | Yes | No |
| Request-model failure | INPUT_INVALID / MALFORMED_REQUEST | Yes | No |
| Missing or stale M1 reference | UNAVAILABLE / DEPENDENCY_NOT_MET | Yes | No |
| Time budget exceeded | UNAVAILABLE / TIMEOUT | Yes | Yes (interrupted) |
| Not applicable / not supported by adapter | UNAVAILABLE / NOT_APPLICABLE | Yes | Engine or app |
| Engine exception or disallowed Status | UNAVAILABLE / ENGINE_ERROR (never SOLVER_FAILED) | Yes | Yes; logged locally |

### 5.2 Transport and defect errors (no RunRecord)
| HTTP | code | When |
|---|---|---|
| 400 | MALFORMED_JSON | Body not parseable (valid JSON that is not a Project/RunRecord → 200 MALFORMED_FILE). |
| 404 | NOT_FOUND / UNKNOWN_ANALYSIS_TYPE | Unknown route or analysis type. |
| 405 | METHOD_NOT_ALLOWED | |
| 413 | PAYLOAD_TOO_LARGE | Body > 10 MiB (initial; reviewed at WP 1.7.1 from the largest test Project request). |
| 415 | UNSUPPORTED_MEDIA_TYPE | Not `application/json`. |
| 500 | INTERNAL_ERROR | App defect outside the engine call. |

### 5.3 Non-analysis endpoints
validate, import and verify: HTTP 200 with their result object; no RunRecord; no Status. rerun creates a RunRecord only when the file check is accepted.

---

## 6. File formats
| Aspect | Project file | RunRecord file |
|---|---|---|
| Content | Doc 3 §8 | Doc 3 §7 |
| Extension | `.mgproj.json` [ASSUMPTION] | `.mgrun.json` [ASSUMPTION] |
| Version | top-level `schema_version` | `schema_version` in the record |
| Written by | Browser download | Browser download |
| Read by | `POST /api/projects/import` | `POST /api/run-records/verify` then `/rerun` |

Import: the server sees content only; checks version first; migrates forward or refuses; Project files get stage-1 validation after migration; RunRecords get both hashes recomputed (HASH_MISMATCH refuses, `details` names the hash); nothing is modified; a failed import changes nothing in the Project store.

---

## 7. Example exchanges (placeholders)

**7.1 PS request**
```json
{ "project_snapshot": { "...": "..." },
  "parameters": { "inverter_margin_ratio": "<m_inv>", "unit_count": "<n>", "redundancy": "<0|1>",
                  "autonomy_h": "<h>", "dc_efficiency_ratio": "<eta>", "depth_of_discharge_ratio": "<dod>" },
  "solver_config": { "mismatch_tolerance_w": 0.001, "max_iterations": 50, "initial_guess": "DEFAULT" } }
```

**7.2 M2 FEASIBLE response skeleton**
```json
{ "result": { "status": "FEASIBLE", "status_code": "OK", "message": "<design meets all evaluated constraints>",
    "payload": { "verdict": "FEASIBLE",
      "constraint_margins": [ { "kind": "BUS_VOLTAGE_MIN", "element_id": "<bus>", "value": "<pu>", "limit": "<pu>",
                                "unit": "pu", "margin": "<pu>", "normalised_margin": "<ratio>" } ],
      "not_evaluated": [ { "kind": "LINE_CURRENT", "element_id": "<line>" } ],
      "sizing_check": { "...": "..." },
      "loadability": { "lambda_c": "<x>", "lambda_s": "<x>", "lambda_ub": "<x>", "resolution": 0.005, "grid_step": 0.05, "stop_reason": "<text>" } },
    "limiting_constraints": [],
    "warnings": [ { "code": "ENGINE_KIND_FAKE", "message": "<result from the Fake Engine>", "path": null },
                  { "code": "CONSTRAINT_NOT_EVALUATED", "message": "<line current limit empty>", "path": "design_constraints.line_current_limit_a" } ],
    "diagnostics": { "elapsed_s": "<s>" } },
  "run_record": { "record_id": "<id>", "analysis_type": "M2", "snapshot_hash": "<64 hex>", "depends_on": { "...": "..." },
                  "engine_kind": "FAKE", "result_hash": "<64 hex>", "...": "..." } }
```

**7.3 INPUT_INVALID** (`POST /api/analyses/M1`, Load with both Q and power factor → HTTP 200)
```json
{ "result": { "status": "INPUT_INVALID", "status_code": "LOAD_Q_AMBIGUOUS", "message": "<text>", "payload": null,
    "limiting_constraints": [], "warnings": [],
    "diagnostics": { "issues": [ { "code": "LOAD_Q_AMBIGUOUS", "level": "entity", "entity": "Load", "id": "<id>", "field": null, "message": "<text>" } ] } },
  "run_record": { "record_id": "<id>", "engine_kind": null, "engine_version": null, "engine_git_commit": null, "...": "..." } }
```

**7.4 Rerun with version mismatch** → `file_check.accepted = true`, `analysis.run_record.replay_of_record_id = <imported id>`, `analysis.result.warnings` contains `ENGINE_VERSION_MISMATCH`, `reproduction.outcome = DIFFERS` with differences listed.

---

## 8. Open points
| # | Item | Tag |
|---|---|---|
| 1 | Measured replacements for time budget (WP 1.4.3), sweep cap, margin warn and body limit (WP 1.7.1). | [ASSUMPTION] until measured |
| 2 | SCENARIO_CAP, M3A_PARAMETER_CAP, M4B_DURATION_CAP_S values. | [ASSUMPTION] |
| 3 | Fake Engine scenario selection and call recording: in-process test control, not a request field or route (manuscript 4.3.2). Mechanism in Doc 8. | DECIDED (mechanism → Doc 8) |
| 4 | File extensions. | [ASSUMPTION] |
| 5 | Endpoint 16 `/api/catalogs/import` (Doc 12): body `Catalog`, HTTP 200 `CatalogImportResponse` {file_check, catalog or null, entry_checks [{entry_id, usable, reasons}]}; version rules as the Project file; duplicate entry ids refused (MALFORMED_FILE). | APPLIED (Doc 9 D-61) |

## Log
| Date | Change |
|---|---|
| 2026-10-17 – 10-21 | Drafted; open points 1–6 closed; change proposals C5.1, C5.9–C5.11, C5.16. |
| 2026-11-01 | Aligned with the manuscript (Doc 14 B1–B6): 413 = 10 MiB; MetaInfo limit values and indicator threshold version; PS, M2, M3, M4 parameters and allowed Status sets; warnings moved into AnalysisResult; ENGINE_KIND_FAKE decided; NOT_APPLICABLE for unsupported routed types; pipeline order; equations allowed. |
