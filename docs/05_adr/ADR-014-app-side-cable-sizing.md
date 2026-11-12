# ADR-014 — App-side computation of the cable sizing analysis (CB)

- Status: **Accepted**, option A and the Q1–Q6 recommendations approved by the user 2026-11-09 ("Accept all"; Doc 9 D-102).
- Drivers:
  - `docs/CABLE_BREAKER_FEATURE_GUIDELINES.md` §0 ("Where it runs"), §5.2, §5.3
  - Doc 9 D-100 K257 (app-side service, no Engine Port call), K264 (contract additions), K268 (ADR-014 reserved)
  - Doc 12 X10, FR-105, FR-107, FR-111; §9 #32
  - Doc 4 §1 and §4 (all calculations only through the Engine Port; the execution guard is the only caller), ADR-008 (Engine Port + Fake Engine)
  - Doc 3 §5.2 (AnalysisResult), §5.4 (dependency check), §7 (RunRecord: engine fields null when the engine was not called)

## Context
- **What Doc 4 says today.** The summary states that every calculation is reached only through the Engine Port, and component 4 (pipeline) ends in a guarded engine call. ADR-008 makes the Engine Port the boundary for the M1–M4 model calculations.
- **What X10 needs.** CB is an overload rule-of-thumb table lookup over quantities the model already produced: the M2 line currents and the inverter ratings (Doc 12 §1, level L2). It is not part of the engine model, and the guideline and D-100 K257 forbid an Engine Port call for it. Yet guideline §5.2 wants it to behave like any other analysis: same route family, stage-1 validation, hashes, dependency check, RunRecord, verify and re-run.
- **Already in place.** Doc 3 §7 allows null engine fields (they are null on every INPUT_INVALID and DEPENDENCY_NOT_MET record today). `AnalysisResult.diagnostics` is a free object. The method and registry exist (`mgapp.services.cable_sizing`, ticket 03, D-101).
- **Feature flag.** `Settings.feature_cable_sizing`, off by default (FR-105).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Pipeline branch for CB.** Analysis type `CB` on `POST /api/analyses/CB`. The pipeline runs the same steps 1–4 (stage-1, limits, hashes, dependency on M2), then step 5 calls the cable sizing service instead of the execution guard. RunRecord with null engine fields and `diagnostics.computed_by = "app"`. | One route family, one RunRecord shape; verify and re-run work unchanged; matches guideline §5.2 word for word. | Doc 4 needs an amendment: "every *engine* calculation goes through the Engine Port", plus one documented app-side branch. No TIME_BUDGET on the branch. | **Proposed** |
| B. A second Engine Port adapter that computes CB | Doc 4 stays literally true. | Breaks D-100 K257 and the guideline ("never calls the Engine Port"); engine identity fields would claim an engine; FAKE/REAL selection would make no sense for CB. | Rejected |
| C. Separate endpoint outside the analysis pipeline (like `/api/catalogs/import`) | No pipeline change. | No RunRecord, no verify or re-run, no `table_set_hash` traceability; contradicts guideline §5.2 and §6 (report shows the record). | Rejected |

## Decision
1. **Option A.** `AnalysisType.CB` joins the enum and the committed OpenAPI whatever the flag says; the route always exists.
2. **Flag off:** the pipeline returns `UNAVAILABLE / NOT_APPLICABLE` with a RunRecord (every path ends in a RunRecord) before stage 1.
3. **Steps for CB:** stage-1 validation of the snapshot as for M2, plus settings and tables; size limits (none specific); canonicalise and hash the snapshot; dependency check on an **M2** RunRecordRef with status FEASIBLE or INFEASIBLE and the same three conditions as Doc 3 §5.4; then the cable sizing service. M2 already required a valid M1, so M1 is not checked again.
4. **Inputs to the method:** `I_B` per Line from the M2 ref `result_payload.sizing_check.per_line[].required_current_a`; per Inverter `I_B` from `rated_kva` and the snapshot nominal voltage (guideline D2); `r_line_ohm_per_km` from the snapshot.
5. **Result:** Status FEASIBLE when the request completed (per-element outcomes in the payload, guideline §5.2); payload per guideline §5.3 plus `caveat_text`; warning `FEATURE_EXPERIMENTAL` on every result; `LINE_R_MISMATCH` per flagged Line. `ALLOWED_STATUS[CB]` = {FEASIBLE, INPUT_INVALID, UNAVAILABLE}.
6. **RunRecord:** `engine_version`, `engine_git_commit`, `engine_kind` null; `diagnostics.computed_by = "app"`; `parameters` = {method_id, settings, tables, table_set_hash}.
7. **No TIME_BUDGET** on the app branch: a table lookup over at most a few hundred elements. How an exception in the service is reported is open point Q5.
8. **Doc 4** gets an amendment line in §4 (component 4 and a new row for the cable sizing service) and the summary sentence becomes "every engine calculation"; the import-linter rule gains "the cable sizing service never imports the Engine Port or `mgengine`".

## Points decided with the ADR (user 2026-11-09: every recommendation taken)
| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Stage-1 code for invalid settings (missing field, arrangement that does not fit the method, D_DUCT without soil resistivity, unknown `method_id`) and for a table file that fails its schema. D-100 K264 lists only `CABLE_TABLES_INCOMPLETE` and `CABLE_TABLES_UNCHECKED`. | (a) new IssueCode `CABLE_SETTINGS_INVALID` with the field path, like `PS_PARAMETER_INVALID`; schema failure of the table file → `CABLE_TABLES_INCOMPLETE` with the schema errors. (b) reuse `MALFORMED_REQUEST` for both. | (a): same pattern as the other analyses, field-level messages for S-19. Needs a Doc 9 entry. |
| Q2 | `table_set_hash` sent by the client | (a) server computes it and overwrites the parameter (as for `r_ohm`/`x_ohm`, Doc 14 A17). (b) refuse a mismatch. | (a). |
| Q3 | When is `DIRECT_BURIAL_NOT_SUPPORTED` emitted? The settings enum has no direct-burial method, so no request can ask for it. | (a) keep the code reserved, never emitted in v1. (b) add a settings value for direct burial that yields the warning and no sizing. | (a). |
| Q4 | Inverter `I_B` voltage | (a) Project `nominal_voltage_kv` (line-to-line, Doc 3). (b) a per-inverter voltage (none exists). | (a), the only one in the model. |
| Q5 | Exception inside the cable sizing service | (a) `UNAVAILABLE / ENGINE_ERROR` as for the engine (message says the app service failed). (b) a new StatusCode `APP_ERROR`. | (a): no new code; `computed_by = "app"` tells them apart. |
| Q6 | Committed OpenAPI and TS types | Include `CB` (route, enum, new codes) in the committed files, flag off at run time. | Include (guideline §0: the route answers NOT_APPLICABLE when off). |

## Consequences
- Contract additions recorded in D-100 K264 land now in Doc 3 / Doc 6 code (enum `CB`, two IssueCodes, three WarningCodes; plus Q1 if (a)). OpenAPI and `frontend/api-types` regenerate; the frontend needs only type updates (no screen until ticket 05).
- The Fake/Real engine selection does not apply to CB; a CB result is never an engine result and never a Fake Engine result.
- Re-run and verify of a CB RunRecord go through the same pipeline; REPRODUCED needs the same tables (their hash is in the parameters).

## Review triggers
- Supervisor rejects X10 (Doc 9 K-07): remove the branch and the enum value.
- A second app-side analysis is proposed: generalise the branch into a small app-analysis registry instead of a second special case.
