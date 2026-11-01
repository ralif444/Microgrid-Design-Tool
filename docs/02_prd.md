# 02 — Product Requirements Document (PRD)

> Doc 2 of the doc set. **Aligned with the final seminar-proposal manuscript (`Seminar.pdf`, Lampiran A Tabel A.1–A.3, subbab 4.1) on 2026-11-01** (Doc 14 items C1–C8); the manuscript wins on any conflict. Counts unchanged: 60 FR (38 Must, 21 Should, 1 Could), 18 NFR, 9 DR. The manuscript tables print no IDs; FR/NFR/DR IDs here map to them by content and order. Equations allowed (user decision 2026-11-01, DR-08 cancelled). Entity fields and units: Doc 3. Post-proposal extensions FR-61 onward: Doc 12.

## Ringkasan

Dokumen ini memuat daftar kebutuhan aplikasi web: apa yang harus dapat dilakukan aplikasi (kebutuhan fungsional, FR), mutu yang harus dipenuhi (kebutuhan nonfungsional, NFR), dan dokumentasi yang wajib tersedia (DR). Setiap kebutuhan memiliki nomor tetap, tingkat prioritas (Must, Should, Could, Won't), dan kriteria penerimaan berbentuk diberikan–ketika–maka yang dapat diuji melalui API HTTP dengan Fake Engine atau melalui peramban. Kebutuhan disusun mengikuti urutan alur kerja pengguna, mulai dari proyek dan data beban hingga laporan, sesuai Tabel A.1 naskah final. Batasan desain tidak memiliki nilai bawaan, dan batasan kosong dilaporkan sebagai tidak dievaluasi. Nilai awal kendali eksekusi adalah anggaran waktu 30 s, batas sapuan 1.000 titik, dan ambang peringatan margin 0,05, yang akan diganti dengan hasil pengukuran pada paket kerja 1.4.3 dan 1.7.1. Peramban yang didukung adalah Google Chrome stabil terbaru. Larangan persamaan pada dokumen rancangan dibatalkan oleh keputusan pengguna setelah seminar dan dicatat sebagai konflik dengan naskah.

---

## 1. Conventions

| Item | Rule |
|---|---|
| ID format | `FR-xx`, `NFR-xx`, `DR-xx`; stable, never reused. |
| Priority | **Must** (v1 fails without it) / **Should** (planned for v1, may slip) / **Could** / **Won't** (§6). |
| Acceptance criteria | Given/When/Then; API seam with the Fake Engine unless marked **E2E** (browser) or client store (ADR-010). |
| Vocabulary | Doc 3 §2. |
| Status values | INPUT_INVALID, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INFEASIBLE, FEASIBLE, UNAVAILABLE. |
| analysis_type | PS, M1, M2, M3a, M3b, M3c, M3d, M4a, M4b. |
| Execution-control values (initial, manuscript 4.1.3) | `TIME_BUDGET` = 30 s (replaced at WP 1.4.3); `SWEEP_CAP` = 1 000 points (fits the largest 2-D sweep, 891 points; replaced at WP 1.7.1); `MARGIN_WARN` = normalised margin 0.05 (Eq. 4.18; replaced at WP 1.7.1). |
| "Valid M1 operating point" | M1 Status FEASIBLE; snapshot hash equal to the current design; SHA-256 of canonical {status, result_payload} equal to `result_hash`. M1 never returns INFEASIBLE; the design verdict comes only from M2. |
| Engine boundary | Every analysis goes through the Engine Port as one AnalysisRequest → AnalysisResult; criteria never depend on engine maths. |
| Client-held state | The open Project lives in the browser (ADR-010); FR-01, FR-08–FR-13, FR-30, FR-49, FR-54, FR-55 are verified at the client-store / E2E seam. |
| Tags | [ASSUMPTION] not settled; [NEEDS SOURCE] unverified external claim. |

---

## 2. Functional requirements

### 2.1 Project and input data

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-01 | Create a new empty Project. | Must | Given no Project, when created, then it has no Bus, Line, Load, Inverter or RunRecord. | A.1 #1 |
| FR-02 | Set and edit Project name and description. | Should | Given a Project, when set, saved and reopened, then both are unchanged. | A.1 #2 |
| FR-03 | Accept Loads as a table: Bus, active power, and reactive power or power factor. | Must | Rows with Q or with PF are stored; a row with neither is rejected (FR-18). | A.1 #3 |
| FR-04 | Accept an optional 24-point LoadProfile (active power only). | Should | 24 points stored; any other length → INPUT_INVALID. | A.1 #4 |
| FR-05 | Declare the unit of every numeric field in the API description and the UI. | Must | Every numeric schema field declares a unit; **E2E:** every numeric input shows its unit. | A.1 #5 |

### 2.2 PS — saran kapasitas awal

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-06 | Request SizingAdvice (PS) through the Engine Port with the six PS parameters (m_inv, n, r required; t_aut, η_dc, DoD optional; Doc 3 §6.1). | Must | Given ≥ 1 valid Load and valid parameters, then a SizingAdvice with a Status and a RunRecord is returned; a parameter rule broken (e.g. r = 1 with n = 1) → INPUT_INVALID (PS_PARAMETER_INVALID). | A.1 #6; manuscript 4.2.2 |
| FR-07 | Present each SizingAdvice item with basis and assumptions; storage energy only when a LoadProfile and t_aut exist, staged to the furthest stage whose parameters exist. | Must | Each item carries basis and assumptions; without LoadProfile or t_aut, storage is null with the reason; with t_aut but no η, stage = AC; a profile peak above ΣP gives warning PROFILE_PEAK_ABOVE_LOADS and unchanged numbers. | A.1 #7; 4.2.2 |
| FR-08 | Store SizingAdvice as advisory data; it becomes design data only on explicit accept; a change of Loads, LoadProfile or PS parameters marks it stale (input hash). | Must | Skip → no new Inverter; Accept → state ACCEPTED; before accept no design entity changes; editing a Load marks the advice stale. | A.1 #8; 4.2.2 |
| FR-09 | Pre-fill Inverter definitions from accepted SizingAdvice. | Should | After accept, Inverter drafts with the suggested unit rating exist and stay editable. | A.1 #9 |

### 2.3 Network design and design constraints

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-10 | Add, edit and delete Buses. | Must | Each change is reflected in the Project read-back. | A.1 #10 |
| FR-11 | Refuse deletion of a Bus still referenced, naming the dependents. | Should | The Bus remains; the response names the referencing Line. | A.1 #11 |
| FR-12 | Add, edit and delete Lines with resistance and reactance (per km, with length). | Must | Stored when complete; missing R or X → rejected (FR-17). | A.1 #12 |
| FR-13 | Add, edit and delete grid-forming Inverters with rating and droop settings (and optional τ_P, τ_Q, P*, Q*). | Must | Stored at the Bus; missing rating or droop → rejected. | A.1 #13 |
| FR-14 | Display the network as a diagram. | Should | **E2E:** each Bus and Line drawn; an isolated Bus visibly unconnected. | A.1 #14 |
| FR-15 | Set DesignConstraints: voltage band, frequency band, Inverter loading limit, Line current limit. | Must | Given values, they are stored and included in the next snapshot; a given min ≥ max → INPUT_INVALID. | A.1 #15 |
| FR-16 | Provide DesignConstraints fields **without numeric defaults**; an empty limit is reported "not evaluated". | Should | A new Project has all limits empty; M2 with an empty limit lists that check under `not_evaluated` with warning CONSTRAINT_NOT_EVALUATED and never counts it as satisfied. | A.1 #16; 4.2.4 |

### 2.4 Pre-run validation

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-17 | Validate schema, units and required fields; INPUT_INVALID without calling the engine. | Must | Missing required field → INPUT_INVALID, zero engine calls, RunRecord with null engine fields. | A.1 #17 |
| FR-18 | Reject negative, empty or PF > 1 Load values. | Must | Each yields INPUT_INVALID naming the field. | A.1 #18 |
| FR-19 | Validate topology: isolated Bus, no Inverter, duplicate Line. | Must | Each yields INPUT_INVALID naming the error; no engine call. | A.1 #19 |
| FR-20 | Report all violations in one response with field paths and messages. | Should | Two independent violations → both listed. | A.1 #20 |
| FR-21 | Never reject a schema-valid request on physical grounds. | Must | A Fake canned PHYSICALLY_INADMISSIBLE reaches the user, not INPUT_INVALID. | A.1 #21 |

### 2.5 M1 — aliran daya droop

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-22 | Run M1; return FEASIBLE ("operating point found"), SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INPUT_INVALID or UNAVAILABLE; never INFEASIBLE. | Must | Each of the five canned Statuses is returned with code, message and RunRecord; a canned INFEASIBLE is rejected by the contract suite (reported UNAVAILABLE / ENGINE_ERROR). | A.1 #22 |
| FR-23 | Present bus voltages, frequency, Inverter outputs, Line flows, total load, losses and iterations with units, plus the validity indicator ε_X. | Must | Canned FEASIBLE payload holds the groups of Doc 3 §6.2 with units, including `epsilon_x_ratio`. | A.1 #23; Tabel 4.6 |

### 2.6 M2 — pemeriksaan batasan

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-24 | Run M2 with margins m_inv, m_line; return FEASIBLE or INFEASIBLE over the evaluated checks, plus λ_c and λ_s. | Must | Given a valid M1, canned verdicts are returned; `loadability` holds λ_c, λ_s and resolution; missing margins → INPUT_INVALID (SIZING_MARGIN_INVALID). | A.1 #24; 4.2.4 |
| FR-25 | List every limiting constraint and its location in an INFEASIBLE result. | Must | Two canned violations → two entries, each with kind and element. | A.1 #25 |
| FR-26 | Report a margin per constraint; highlight those below MARGIN_WARN. | Should | Margins and normalised margins present; **E2E:** a normalised margin < 0.05 is highlighted. | A.1 #26 |
| FR-27 | Carry SizingCheck separately from SizingAdvice. | Must | SizingCheck is a separate field; storing it does not alter SizingAdvice. | A.1 #27 |

### 2.7 M3 and M4 — further analyses

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-28 | Run local sensitivity (M3a) on chosen parameters with a relative or absolute step. | Should | Result for exactly the chosen parameters; nonexistent path or missing step → INPUT_INVALID. | A.1 #28; 4.2.5 |
| FR-29 | Run a 1-D sweep (M3b) over a parameter, a shared scale factor or λ. | Should | One result covering the range within SWEEP_CAP; each point carries its own Status. | A.1 #29; Tabel 4.10 |
| FR-30 | Save design variants as Scenarios. | Should | Stored with a name; later edits to the live design do not change it. | A.1 #30 |
| FR-31 | Compare Scenarios side by side (M3c) with explicit deltas, without ranking. | Should | Both listed with deltas; fewer than two → INPUT_INVALID. | A.1 #31 |
| FR-32 | Provide a 2-D feasibility envelope (M3d). | Could | One result within SWEEP_CAP with feasible fraction. | A.1 #32 |
| FR-33 | Run small-signal stability (M4a): eigenvalues, damping, dominant modes, participation factors and a stability class (STABLE, MARGINAL, UNSTABLE), with validity indicators labelled "validity not calibrated" until stage 1.6. | Should | Canned payload holds the groups of Doc 3 §6.8; missing τ_P/τ_Q → INPUT_INVALID (TAU_MISSING_FOR_M4). | A.1 #33; 4.2.6–4.2.7 |
| FR-34 | Run transient stability (M4b) for a disturbance chosen from the four-kind catalogue (load step, load scaling, reference step on P*, Q*, V* or ω*, inverter outage), returning trajectories and a transient class. | Should | Canned payload holds time series and `transient_class`; missing disturbance → INPUT_INVALID. | A.1 #34; 4.2.6 |

### 2.8 Status model and dependencies

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-35 | Every result carries one of six Statuses, a machine code and a message. | Must | Each canned Status has non-empty code and message. | A.1 #35 |
| FR-36 | SOLVER_FAILED, PHYSICALLY_INADMISSIBLE and INFEASIBLE have distinct messages naming their cause category. | Must | No two identical. | A.1 #36 |
| FR-37 | UNAVAILABLE states its reason and the causing dependency. | Must | M2 after a failed M1 → UNAVAILABLE naming M1. | A.1 #37 |
| FR-38 | M2 requires a valid M1 (three conditions); otherwise UNAVAILABLE / DEPENDENCY_NOT_MET without an engine call. | Must | No M1, failed M1, stale M1 or altered payload (result_hash mismatch) → UNAVAILABLE, zero engine calls; valid M1 → M2 runs. | A.1 #38 |
| FR-39 | M3a–M3d and M4a–M4b each require a valid M1. | Should | M1 PHYSICALLY_INADMISSIBLE → each returns UNAVAILABLE naming M1. | A.1 #39 |
| FR-40 | An M1 failing only the snapshot-hash condition is reported stale. | Must | Edit after M1, then M2 → UNAVAILABLE, reason says stale. | A.1 #40 |
| FR-41 | M3 and M4 are allowed on an M2-INFEASIBLE design with a valid M1. | Should | M3b and M4a not refused for infeasibility. | A.1 #41 |

### 2.9 Execution limits

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-42 | Execute each analysis synchronously. | Must | Same HTTP response holds the result; no job id or polling. | A.1 #42 |
| FR-43 | Enforce TIME_BUDGET; UNAVAILABLE / TIMEOUT on overrun. | Must | Fake configured to exceed 30 s → TIMEOUT with a RunRecord. | A.1 #43 |
| FR-44 | Refuse M3b/M3d above SWEEP_CAP with INPUT_INVALID (SWEEP_CAP_EXCEEDED) without an engine call. | Should | One step above 1 000 → refused, message states cap and size, zero calls; at the cap → accepted. | A.1 #44 |
| FR-45 | Show an in-progress state while the UI stays usable. | Should | **E2E:** indicator shown, navigation enabled. | A.1 #45 |

### 2.10 RunRecord

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-46 | The application service creates a RunRecord for every request, whatever the status. | Must | Records exist for all six Statuses; engine fields null when not called; the Fake has no RunRecord code path. | A.1 #46 |
| FR-47 | A RunRecord holds the 17 fields of manuscript Tabel D.2. | Must | All 17 present; engine fields non-null iff the engine was called. | A.1 #47 |
| FR-48 | Hash the canonical JSON (six rules); same input → same hash. | Must | Key-order-only differences → equal hash; one changed value → different hash. | A.1 #48 |
| FR-49 | Export a RunRecord as one file. | Must | One file parsing as a complete RunRecord. | A.1 #49 |
| FR-50 | Import a RunRecord, validate schema, recompute both hashes, refuse on mismatch. | Must | Unchanged file accepted; edited snapshot refused (HASH_MISMATCH), no engine call. | A.1 #50 |
| FR-51 | Show stored and current engine version; warn on difference without stopping. | Should | Different version → warning ENGINE_VERSION_MISMATCH and the analysis runs. | A.1 #51 |
| FR-52 | Compare a re-run: REPRODUCED iff status and result_hash equal; otherwise list differences. | Must | Identical Fake output → REPRODUCED; different → DIFFERS with differences. | A.1 #52 |
| FR-53 | A re-run creates a new RunRecord without modifying the imported one. | Must | New record with `replay_of_record_id`; imported record byte-identical. | A.1 #53 |

### 2.11 Project file

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-54 | Save a Project as one JSON document with `schema_version`. | Must | All parts present. | A.1 #54 |
| FR-55 | Load a saved Project back to an equivalent Project. | Must | Load then save → equal documents. | A.1 #55 |
| FR-56 | Migrate an older migratable file and tell the user. | Should | Older fixture loads at the current version with a migration notice. | A.1 #56 |
| FR-57 | Refuse an unmigratable or newer file without loading or overwriting. | Must | Refusal message; open Project unchanged. | A.1 #57 |

### 2.12 Report

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-58 | Provide an HTML report with tables and charts from stored results. | Must | **E2E:** with M1 and M2 results, ≥ 1 table and ≥ 1 chart. | A.1 #58 |
| FR-59 | State verdict, limiting constraints, margins, not-evaluated checks, assumptions and RunRecord hashes in plain language. | Must | **E2E:** INFEASIBLE M2 → verdict, each limiting constraint and the hash visible; no raw code as the only explanation. | A.1 #59 |
| FR-60 | Export the report by browser print to PDF; no server-side PDF. | Should | **E2E:** print output paginates without clipped tables or charts. | A.1 #60 |

---

## 3. Non-functional requirements

| ID | Category | Requirement | Measure | Source |
|---|---|---|---|---|
| NFR-01 | Reproducibility | Re-running a RunRecord gives the same status and result_hash; tolerances only for engine vs PSIM. | Export–import–re-run on the Fake. | A.2 #1 |
| NFR-02 | Deployment | One process, one documented command. | Start procedure lists one command. | A.2 #3 |
| NFR-03 | Offline | Works without internet. | Key flow completes with network disabled. | A.2 #4 |
| NFR-04 | Time budget | Each request completes or returns UNAVAILABLE / TIMEOUT within TIME_BUDGET (30 s initial). | Overrun test. | A.2 #5 |
| NFR-05 | Usability | Every numeric field shows its unit. | No unlabelled field. | A.2 #9 |
| NFR-06 | Usability | Every Status comes with a message naming the cause category and a next step. | Message review per Status (WP 1.7.2); non-empty message test. | A.2 #10 |
| NFR-07 | Testability | The Fake returns all six Statuses on demand. | Contract test per Status. | A.2 #11 |
| NFR-08 | Testability | Fake and Real adapter pass the same contract suite (nine behaviours). | One suite on both adapters. | A.2 #12 |
| NFR-09 | Testability | Every FR with a backend effect is testable at the API with the Fake. | Each FR marked with its test seam. | A.2 #13 |
| NFR-10 | Maintainability | The app never imports engine internals. | Import check in the build. | A.2 #15 |
| NFR-11 | Maintainability | Dependencies point inward only. | import-linter (Python), dependency-cruiser (TypeScript). | A.2 #16 |
| NFR-12 | Portability | A Project moves between machines as a versioned JSON file. | File opens on another machine. | A.2 #6 |
| NFR-13 | Browser | Latest stable Google Chrome (decided). | E2E flows pass; Chrome version logged. | A.2 #7 |
| NFR-14 | Determinism | The Fake is deterministic. | Repeated requests → identical results. | A.2 #14 |
| NFR-15 | Contract | API description generated from schemas, including units and validation. | Test fails when a schema changes without the description. | A.2 #17 |
| NFR-16 | Data integrity | A failed import or open never alters the open Project or stored RunRecords. | Before/after comparison. | A.2 #2 |
| NFR-17 | Security scope | No authentication, single user, loopback only. | Documented bind address. | A.2 #8 |
| NFR-18 | Process | Staged development with entry and exit gates, Fake first. | Gate criteria logged (Tabel 4.15). | A.2 #18 |

---

## 4. Documentation requirements

| ID | Requirement | Acceptance | Source |
|---|---|---|---|
| DR-01 | Every document opens with an Indonesian Ringkasan of 5–8 sentences. | Present in each doc. | A.3 #1 |
| DR-02 | One-page Indonesian executive summary. | Available. | A.3 #2 |
| DR-03 | Every requirement has a stable ID and testable acceptance criteria. | FR in Given/When/Then. | A.3 #3 |
| DR-04 | One-page ADR for each significant technical choice. | Ten decisions covered. | A.3 #4 |
| DR-05 | Register of assumptions, needs-source items, conflicts and future work. | Every tag recorded. | A.3 #5 |
| DR-06 | Traceability map from docs to manuscript chapters. | Every chapter covered. | A.3 #6 |
| DR-07 | Engine Port specified independently of any engine implementation. | No solver content in the port spec. | A.3 #7 |
| DR-08 | ~~No equations in application design docs.~~ **Cancelled by the user on 2026-11-01:** equations are allowed; manuscript equations are cited by number. | KONFLIK with manuscript Tabel A.3 #8 (user-decided), recorded in Doc 14 and to be stated in the skripsi methodology. | A.3 #8 |
| DR-09 | Entity and field names identical across documents, glossary (Doc 3) as source. | Cross-document term check. | A.3 #9 |

---

## 5. MoSCoW summary

| Capability | Priority | FR IDs |
|---|---|---|
| Project create; name/description | Must; Should | FR-01; FR-02 |
| Load entry; LoadProfile | Must; Should | FR-03, FR-05; FR-04 |
| PS advice; pre-fill | Must; Should | FR-06–FR-08; FR-09 |
| Network design; guard, diagram | Must; Should | FR-10, FR-12, FR-13; FR-11, FR-14 |
| DesignConstraints; empty-limit handling | Must; Should | FR-15; FR-16 |
| Pre-run validation; all-violations list | Must; Should | FR-17–FR-19, FR-21; FR-20 |
| M1 | Must | FR-22, FR-23 |
| M2; margin highlight | Must; Should | FR-24, FR-25, FR-27; FR-26 |
| M3a, M3b, Scenario/M3c; M3d | Should; Could | FR-28–FR-31; FR-32 |
| M4a, M4b | Should | FR-33, FR-34 |
| Status and M1/M2 dependency; M3/M4 dependency | Must; Should | FR-35–FR-38, FR-40; FR-39, FR-41 |
| Execution limits | Must (cap, progress: Should) | FR-42, FR-43; FR-44, FR-45 |
| RunRecord | Must (version warning: Should) | FR-46–FR-50, FR-52, FR-53; FR-51 |
| Project file | Must (migration: Should) | FR-54, FR-55, FR-57; FR-56 |
| Report | Must (print: Should) | FR-58, FR-59; FR-60 |
| M5 PSIM validation in the UI | Won't | offline script (Doc 13) |

## 6. Won't (v1)

Authentication and multi-user; database; hosting; asynchronous job queue; AI/LLM features; M5 inside the UI; grid-following inverters, VSM, PLL, secondary/tertiary control, unbalance, harmonics, short circuit, protection, motor starting, reconnection, automatic optimisation, detailed battery, current limiter; techno-economics, emissions, PV/wind/diesel sizing, dispatch, reliability; server-side PDF.

## 7. Coverage

Every FR, NFR and DR maps to one row of manuscript Tabel A.1–A.3 (Source column). The earlier user-story mapping (US-1–US-52) is superseded by the manuscript baseline.

## 8. Open points

| # | Item | Tag |
|---|---|---|
| 1 | Measured TIME_BUDGET (WP 1.4.3), SWEEP_CAP and MARGIN_WARN (WP 1.7.1). | [ASSUMPTION] until measured |
| 2 | Report content and layout details. | → Doc 7 |
| 3 | DR-08 cancellation stated in the skripsi methodology. | KONFLIK (user-decided) |
| 4 | Doc 12 extensions FR-61 onward merged at stage 1.5. | PENDING-1.5 |

## Log

| Date | Change |
|---|---|
| 2026-10-17 – 10-21 | Drafted; decisions I1–I7; change proposals C5.6, C5.14, C5.15. |
| 2026-11-01 | Aligned with the manuscript (Doc 14 C1–C8): PS parameters and staged storage (FR-06–FR-08); constraints without defaults (FR-15, FR-16); ε_X (FR-23); margins, λ_c/λ_s (FR-24, FR-26); M3 axis kinds (FR-29); M4a class and participation (FR-33); four-kind catalogue and transient class (FR-34); 17-field RunRecord (FR-47); initial execution values; Chrome decided (NFR-13); DR-08 cancelled; sources mapped to Tabel A.1–A.3. |
