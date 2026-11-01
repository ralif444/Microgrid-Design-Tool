# 09 — Risks, Assumptions and Open Questions Register

> Doc 9 of 11. Inputs: Docs 1–8, 10, ADR-001…010, rules G–L (approved 2026-10-17). Doc 11 was read as it stood at writing time (it is not a formal input of this doc); rows citing it are marked "Doc 11". Guardrail (dec. 19): no equations, code or numerical settings. Likelihood/impact in §5 are qualitative judgements [ASSUMPTION].

## Ringkasan
Dokumen ini mengumpulkan semua hal yang belum pasti dalam kumpulan dokumen arsitektur aplikasi web: asumsi, klaim yang masih memerlukan sumber, konflik dengan catatan pembimbing, risiko, pertanyaan terbuka, pekerjaan lanjutan, dan keputusan yang sudah diambil pada tinjauan 2026-10-17. Setiap baris menunjuk ke dokumen asal dan menyebut tindakan penutupnya serta gerbang fase (P0 sampai P4) tempat hal itu harus selesai. Nilai yang belum diukur, seperti batas waktu 30 detik dan batas ukuran *sweep*, tetap berstatus asumsi sampai diukur pada fase P2 dan P4. Klaim tentang perangkat pembanding dan kerangka kerja tidak boleh masuk proposal sebelum didukung sumber resmi atau literatur IEEE/Elsevier. Konflik dengan catatan pembimbing tentang pemodelan matematis sudah diputuskan pengguna, tetapi konfirmasi pembimbing masih dianjurkan; penerimaan proposal dihitung sebagai konfirmasi (Doc 10 §6 #7). Fitur AI/LLM hanya dicatat sebagai pekerjaan lanjutan. Bagian terakhir memuat pemeriksaan kelengkapan terhadap hasil pencarian tag di seluruh dokumen.

## 1. How to use this register
| Item | Rule |
|---|---|
| ID scheme | A-xx assumption, S-xx needs-source, K-xx KONFLIK, R-xx risk, Q-xx open question, F-xx future work, D-xx decided-in-review (decision log). |
| Status values | OPEN, DECIDED, RESOLVED, ACCEPTED, DEFERRED. |
| Owner | Student unless stated. |
| Close by | Phase or gate (P0…P4; EG-/XG- ids from Doc 10) or "before seminar". "Measured" = replaced by a recorded value or an explicit "unmeasured" label (XG-P4 item 4). |
| Source notation | "Doc n §x" = section; "#n" = row of that doc's open-points table; FR-/NFR- ids as in Doc 2. A row lists every doc that states the same item. |
| Maintenance | New tags added by any change go here (Doc 8 §8 checklist). Scope moves need a row here or an ADR (Doc 10 R3). |

## 2. Assumptions (A-xx)
| ID | Assumption | Sources (doc §) | Impact if wrong | Validation/closing action | Close by | Status |
|---|---|---|---|---|---|---|
| A-01 | `TIME_BUDGET` is about 30 s per request; tests use a shortened value. | Doc 1 §4, §9 A1; Doc 2 §1, FR-43, NFR-04, #2; Doc 3 §5.4, §9 #8; Doc 4 §11 #14; Doc 6 §8 #8; Doc 8 §9 #8; Doc 10 §6 #6, XG-P2 item 5; ADR-007 | Sync model may not fit real runs; wrong value causes false TIMEOUT or a hanging UI | Measure on representative cases with the Real Engine adapter; record in this register; `/api/meta` shows null until fixed | XG-P2 | OPEN |
| A-02 | `SWEEP_CAP` (M3b, M3d sweep/envelope size) value. | Doc 1 §4, §9 A2; Doc 2 §1, FR-44, #1; Doc 3 §4 notes, §9 #7; Doc 4 §4 execution guard, §11 #14; Doc 6 §8 #8; Doc 10 §6 #6; ADR-007 | Cap too low blocks useful sweeps; too high exceeds time budget | Measure after A-01; set from measurement | P4 (EG-P3 needs placeholder) | OPEN |
| A-03 | Other caps: `SCENARIO_CAP`, `M3A_PARAMETER_CAP`, `M4B_DURATION_CAP_S`. | Doc 3 §4 (PARAMETER_CAP_EXCEEDED, DURATION_CAP_EXCEEDED), §6.4, §6.6, §6.9, §9 #7, #17; Doc 4 §11 #3, #14; Doc 6 §4 (M3a, M4b rows), §8 #4, #8; Doc 7 §3.1 gating text; Doc 10 §3.4 EG-P3, §6 #6 | Same as A-02; Compare/Stability screens would enforce wrong limits | Fix placeholder values before P3 entry; confirm by measurement at P4 | EG-P3 (placeholder), P4 (measured) | OPEN |
| A-04 | Request body size limit (413) and 415 media-type behaviour; request size grows with M1 payload and M3c snapshots. | Doc 6 §5.2, §8 #8, #12; ADR-010 consequences | Large Projects rejected, or limit set blindly | Measure request sizes on the largest fixture Project; then fix limit | P4 | OPEN |
| A-05 | PO-1…PO-6 map onto the approved thesis Tujuan T without rewording T. | Doc 1 §3, §9 A3; Doc 11 §4 | Proposal Bab I objectives do not match skripsi T (see K-03) | Resolve K-03 option A or B | Before seminar | OPEN |
| A-06 | Default DesignConstraints (voltage band, frequency band, inverter loading ratio, line current limit) and default nominal frequency 50 Hz; all "TBD-default". | Doc 2 FR-16, #3; Doc 3 §3.7, §9 #5, §10 | Misleading defaults; M2 verdicts depend on them | Take values only from reviewed official standards (see S-04); until then keep TBD-default marked as defaults | EG-P1 (test fixtures); before seminar if shown | OPEN |
| A-07 | `MARGIN_WARN` threshold and unit handling per constraint kind. | Doc 2 §1, FR-26, #4; Doc 7 §5.1, §9 #5 | Highlight misleading or noisy (FR-26 is Should) | Choose value and unit rule with Doc 3 / Doc 6 | EG-P3 | OPEN |
| A-08 | M4b disturbance catalogue and parameters (kinds LOAD_STEP, LOAD_SCALING, REFERENCE_STEP, INVERTER_OUTAGE after alignment with the engine plan, C5.5 2026-10-21; LINE_OUTAGE removed; duration cap). | Doc 2 FR-34, #11; Doc 3 §6.9; Doc 7 §6.6 (S-13/S-14); Doc 10 EG-P3 | Stability screens and contract change late | Approve catalogue in Doc 3 | EG-P3 | OPEN |
| A-09 | Enumerations: LimitingConstraint kinds, M3a `output_metrics`, `initial_guess` values. | Doc 3 §5.3, §6.4, §9 #14 | Contract suite and UI labels change | Confirm with Real Engine adapter at P2 | XG-P2 | OPEN |
| A-10 | Supported browser list: E2E gated on one Chromium-based browser, Firefox and WebKit at P4. | Doc 2 NFR-13, #12; Doc 7 §9 #7; Doc 8 §9 #4; Doc 10 §3.2 deliverables, §3.5 | Demo browser fails; unsupported browser claims | Fix list in Doc 8 at P1; widen at P4 | XG-P1 (fixed list), XG-P4 | OPEN |
| A-11 | Exact report content, section order, print layout, empty/partial states. | Doc 2 FR-59, #14; Doc 7 §6.7, §9 #6 | Report not readable by a non-technical decision maker (PO-6) | Define layout in P1; review printed output | XG-P1 | OPEN |
| A-12 | NFR-06 "next step" wording of Status messages is judged adequate. | Doc 2 NFR-06 | Messages not actionable for junior engineer | Message review per Status in P4 | P4 | OPEN |
| A-13 | Optional browser autosave (localStorage) as convenience only; never a saved Project. | Doc 3 §8; Doc 4 §3 browser SPA row, §11 #12; Doc 7 §7; ADR-004, ADR-010 | Work lost on closed tab if users trust autosave | Keep export prompt; test private-mode failure | EG-P1 | OPEN |
| A-14 | Retention of `INPUT_INVALID` RunRecords: stored, hidden by default in the UI. | Doc 4 §11 #12; Doc 7 §9 #7; Doc 3 §10 | Project file grows; reproduction audits confused | Decide retention rule with Doc 7 filter; check file size at P1 | XG-P1 | OPEN |
| A-15 | Timeout mechanism is an implementation detail; engine fields in a TIMEOUT RunRecord are filled only if the adapter reported them before overrun. | Doc 4 §4 execution guard, §7c, §11 #9; Doc 8 §5 (TIMEOUT row), §9; ADR-007 | Hung engine call blocks the single worker | Choose mechanism at P0 with Fake Engine delay test (FR-43) | XG-P0 | OPEN |
| A-16 | Engine Port has a read-only report-identity operation (engine version, commit, `engine_kind`); `engine_kind` null when engine not called. | Doc 4 §5; Doc 3 §7 | Version comparison (FR-51) and Fake-vs-real marking not possible | Confirm in Doc 3/6 contract tests | XG-P0 | OPEN |
| A-17 | Allowed top-level Status per `analysis_type` (cells marked ◇); unsupported type returns `UNAVAILABLE`/`NOT_APPLICABLE`. | Doc 4 §5, §11 #11; Doc 6 §4, §5.1, §8 #7 | Contract suite asserts wrong sets | Re-confirm with Real Engine adapter | XG-P2 | OPEN |
| A-18 | Fake Engine scenario selection and call recording are a test/demo control (in-process script and call log; startup fixture profile), never a request field or route. | Doc 4 §5, §11 #10; Doc 6 §8 #9; Doc 8 §4/§5, §9 #3; Doc 10 §6 #5 | Production request polluted; E2E restarts slow | Implement per Doc 8; revisit if E2E too slow | XG-P0 | OPEN |
| A-19 | Canonicalisation rule details (key order, number format, entity-array sorting), canonical snapshot content, `result_hash` over {status, payload}, M3c hash over snapshot plus scenarios, hash of an incomplete snapshot as submitted. | Doc 3 §7 (RunRecord fields, canonical snapshot, rule), §9 #9, #10, #17; Doc 4 §11 #8; Doc 6 §5.1 | Same input gives different hash; reproducibility (PO-3) fails | Specify and test at P0 (same snapshot, same hash) | XG-P0 | OPEN |
| A-20 | Hash and derived Line totals are computed by the server only; client sends neither. | Doc 4 §11 #7; Doc 6 §3.1 | Two definitions drift; stale-M1 check inconsistent | Keep one definition; UI uses server response | XG-P0 | OPEN |
| A-21 | Id pattern and length for entities. | Doc 3 §1 | Import of hand-edited files rejected unexpectedly | Confirm with Doc 6 validation tests | XG-P0 | OPEN |
| A-22 | Network model: balanced three-phase; `nominal_voltage_kv` line-to-line, one level; `nominal_frequency_hz` is a Project field. | Doc 3 §1, §3.1, §9 #13 | Models in skripsi need different inputs | Check against skripsi scope at P2 | XG-P2 | OPEN |
| A-23 | Entity data-shape choices: diagram positions excluded from snapshot; per-Line current limit override; several Loads or Inverters per Bus; leading load via power factor plus direction; one system-level LoadProfile of 24 entries (total demand); droop in physical units; no storage entity in v1. | Doc 3 §3.2–§3.6, §9 #12, §10 | Contract changes after XG-P1 need a recorded decision (R5) | Freeze Doc 3 fields at EG-P1 | EG-P1 | OPEN |
| A-24 | SizingAdvice and Scenario shape choices: `input_hash` of load data, history kept with one in effect, override list with `parameter_path` form, topology changes not overrides. | Doc 3 §3.8, §3.10, §8 | Advice staleness not detectable; scenario comparison inconsistent | Freeze at EG-P1 / EG-P3 | EG-P1 | OPEN |
| A-25 | `solver_config` (tolerance, max_iterations) is present on every request and ignored by PS; defaults TBD; tolerance meaning engine-defined. | Doc 3 §5.1, §9 #6 | Reproducibility is exact equality of Status and `result_hash` (deterministic engine); if an engine is non-deterministic, DIFFERS is reported with the differing quantities, no tolerance pass; tolerance stays an engine-defined input and the M5 criterion (UP-08, 2026-10-18) | Engine defines at P2 (→ skripsi scope) | XG-P2 | OPEN |
| A-26 | Engine is stateless between calls. | Doc 3 §5 | Dependent analyses need state the engine lacks | Contract test at P0 | XG-P0 | OPEN |
| A-27 | Engine reason codes for `SOLVER_FAILED` / `PHYSICALLY_INADMISSIBLE` are examples; final list belongs to the Real Engine adapter. | Doc 3 §9 #15 | Reason codes mismatch at P2 | Replace with adapter list | XG-P2 | OPEN |
| A-28 | Analysis calls are idempotent in domain result (new `record_id`/`created_at` per call), so retry is safe. | Doc 6 §1 | Duplicate RunRecords confuse users | Document in UI run history | XG-P1 | OPEN |
| A-29 | API wrapper shapes and codes: no `/api` route emits 422 (`MALFORMED_REQUEST`); Warning code set incl. `ENGINE_KIND_FAKE` on every Fake result; minimum FileCheckResult code set; `differences` kinds; `RerunResponse`; `target_analysis_type` on validate; `limits` null in `/api/meta`; 415 behaviour. | Doc 6 §1, §3.3–§3.9, §5.1, §8 #10, #13, #14; Doc 10 §3.2 deliverables | Contract suite (NFR-08) built on unverified shapes | Treat as sketches until the contract suite exists | XG-P0 | OPEN |
| A-30 | File extensions `.mgproj.json` / `.mgrun.json` and package name `mgapp`. | Doc 6 §6, §8 #11; Doc 8 §1, §9 #6 | Cosmetic; rename cost | Confirm at P0 | EG-P0 | OPEN |
| A-31 | RunRecords inside a Project file with unreadable content are reported and skipped, never deleted silently; RunRecord hash-mismatch details name which hash. | Doc 3 §8; Doc 6 §6 (RunRecord import steps) | Silent data loss or unclear refusal | Cover in project-file tests (FR-55, FR-57) | XG-P1 | OPEN |
| A-32 | Console-only logging, no telemetry, no log file (a log file would be a server disk write). | Doc 4 §9 | Defects hard to diagnose | Revisit if P1 debugging needs files | XG-P1 | OPEN |
| A-33 | Security residual risk accepted: other local software could reach the loopback port. | Doc 4 §9; Doc 2 NFR-17 | Local-only claim over-stated | State as limitation in proposal | Before seminar | ACCEPTED |
| A-34 | Hash checks on the client-supplied M1 reference (snapshot hash, `result_hash`) detect accident only; acceptable for single-user local use. | Doc 4 §9, §12; Doc 6 §9 | Tampered operating point accepted | State as limitation; not security | Before seminar | ACCEPTED |
| A-35 | Stale-M1 flag stays set after edit-and-revert until M1 re-run or hash re-check; conservative by design. | Doc 7 §3.1 (stale rule), §9 #3, §10 | Valid reverted design blocked | Check wording in E2E; offer re-check | XG-P1 | ACCEPTED |
| A-36 | Network diagram is Should and read-only first; drag-to-edit and library choice undecided; Screen S-17 (About) is Should. | Doc 7 §1 P5, §2 (S-17), §9 #4 | Users expect diagram editing | Decide at P3a | EG-P3 | OPEN |
| A-37 | Accessibility target: readable contrast and 200 percent zoom, with no formal WCAG claim. | Doc 7 §8; Doc 10 §3.5 scope | Accessibility claim unsupported | Check at P4; see S-09 | XG-P4 | OPEN |
| A-38 | Client store exposes a small interface so a state library can replace Context + reducer. | Doc 7 §7; ADR-005 | Rewrite of screens if library needed | Keep interface; revisit per ADR-005 | P1 | OPEN |
| A-39 | Pin tool versions (Python, FastAPI, Pydantic, Node, Next.js) in lock files at P0; engine version and commit at P2 (XG-P0 item 5a; C5.20, 2026-10-21). | ADR-001 | Contract drift between machines | Pin in lock files | XG-P0 | OPEN |
| A-40 | Dev tooling: pytest, ruff, mypy, import-linter, Vitest, Playwright, dependency-cruiser, task runner; "highest seam" rule and import checks fail the build. | Doc 8 header, §2, §3, §4, §9 #5 | Tool friction; names change | Confirm at P0 | EG-P0 | OPEN |
| A-41 | Printed-PDF check (FR-60) relies on browser print emulation, not a visual accuracy claim. | Doc 8 §9 #10 | Print layout broken on demo laptop | Manual print check at P4 | XG-P4 | OPEN |
| A-42 | Gate reviews are self-administered; advisor review at phase boundaries and an advisor demo at P4 are recommended, not mandatory. | ADR-009; Doc 10 §4 R6, §3.5 XG-P4 item 6, §6 #8 | Weak independent review | Request advisor review at EG-P2 and XG-P4 | EG-P2 | OPEN |
| A-43 | Doc set effort 2026-10-17 to about 2026-10-31; phase durations in relative weeks (P0 1–2, P1 4–6, P2 open, P3 3–5, P4 2–3); seminar date not fixed; effort bounded by usage limits. | Doc 10 §1, §6 #1; Doc 11 §7 | Schedule slips; seminar earlier than P1 | Fix seminar date (Q-01) | EG-P0 | OPEN |
| A-44 | Toolchain friction for two languages and the P1 load (30 of the 38 Must FRs; 8 are in P0) are manageable by one developer; Real adapter for each analysis type is delivered as engine modules become available. | Doc 10 §3.1, §3.2, §3.4 | Phase overrun | Thin slice at P0; three P1 increments | XG-P0 | OPEN |
| A-45 | M5 PSIM validation placement: offline, starts P2 for M1/M2. | Doc 10 §3.3 | Thesis evidence late | Keep outside app gates (R2) | XG-P2 | OPEN |
| A-46 | Doc 2 wording for client-held state (FR-01, FR-08–FR-13, FR-30, FR-49, FR-54, FR-55) aligned with ADR-010; seam T7 added. | Doc 8 §9 #1; Doc 10 §6 #9 | Tests written against wrong behaviour | Aligned per Doc 10 §6 #9 | — | RESOLVED |
| A-47 | Proposal Bab I–III structure follows the skripsi outline but describes the web app; independent/dependent variables for a software methodology; tool versions and hardware not fixed. | Doc 11 §1, §6/§7 #1, #6, #7 | Proposal structure rejected by supervisor | Supervisor decision (Doc 11 §6 items 2–3) | Before seminar | OPEN |

## 3. Claims needing a source (S-xx)
| ID | Claim | Sources | Where it would appear in the proposal (Bab/§) | Candidate source type (official docs / IEEE / Elsevier — no invented refs) | Status |
|---|---|---|---|---|---|
| S-01 | Reviewed tools operate at the level of energy balance, techno-economics and reliability (HOMER, MDT) or general network analysis (pandapower, GridPACK); among the reviewed tools, none was found that combines droop power flow and a stability check for an islanded AC grid-forming microgrid in one early-design flow [INFERENCE from absence; limited to the reviewed tools]. No ETAP or PowerFactory names; no "slow" or "too detailed" wording. Proposal wording (Indonesian): "Alat yang ditinjau bekerja pada tingkat neraca energi, tekno-ekonomi, dan keandalan (HOMER, MDT) atau analisis jaringan umum (pandapower, GridPACK); di antara alat yang ditinjau, tidak ditemukan alat yang menggabungkan aliran daya *droop* dan pemeriksaan stabilitas untuk *microgrid* AC terisolasi berbasis inverter *grid-forming* dalam satu alur desain awal [INFERENSI]." (UP-01, 2026-10-18) | Doc 1 §1 item 2, §9 S1; Doc 2 #17; Doc 11 §2 (1.1.4) | Bab I 1.1 Latar Belakang, 1.2 | Vendor official documentation; LR batch B09 (design software tools); IEEE/Elsevier papers on design tools | RESOLVED (reworded; proposal v1 1.1.4) |
| S-02 | In computational science, the assumption that identical inputs always give identical results is considered wrong because software keeps changing [PR-13, PR-22]; repeatable analysis requires code and data managed together under version control [PR-15]; energy modellers state the need for traceable input-data processing [PR-16]; recording the tool version is supported by [PR-21, PR-22]. The domain part (early-design microgrid results are hard to trace to exact inputs and solver settings) is a design rationale [ASSUMPTION], not a claim about microgrid practice (Q-P06-1). Proposal wording (Indonesian, softened): "Dalam sains komputasi, anggapan bahwa masukan identik selalu menghasilkan hasil identik dinilai keliru karena perangkat lunak terus berubah; analisis yang dapat diulang menuntut kode dan data dikelola bersama dalam kendali versi; dan pemodel energi menyatakan perlunya pengolahan data masukan yang dapat ditelusuri." (UP-02, 2026-10-18) | Doc 1 §1 item 3, §9 S2, §11; Doc 2 #17; Doc 11 §2 (1.1.3), §7 #4 | Bab I 1.1 Latar Belakang (problem tree) | IEEE/Elsevier literature on reproducibility of engineering studies | PARTLY (general part sourced PR-13/15/16/21/22; domain part = design rationale) |
| S-03 | "Common practice" for expressing the voltage band in p.u. of nominal voltage; physical droop units (Hz/kW, kV/kvar) vs percent-of-rating convention. | Doc 3 §3.7, §9 #2, §10 (a), (b) | Bab III 3.5 data model | IEEE/Elsevier microgrid control literature; official standard text once reviewed | OPEN |
| S-04 | Default DesignConstraints values and their basis; any standard limit. | Doc 2 FR-16, #3; Doc 3 §3.7, §9 #5; Doc 11 §2 (3.5) | Bab III 3.5; Doc 3 defaults | Official standard documents (IEEE/IEC/PUIL/SPLN) after review; none stated now (rule 8) | OPEN |
| S-05 | Comparative claims about FastAPI, Next.js, Streamlit, Vite and state libraries (performance, popularity, adoption). | Doc 4 §11 #13; ADR-001; ADR-005; ADR README self-review; Doc 11 §2 (2.3) | Bab II 2.3; Bab III 3.4 | Official framework documentation only | PARTLY (UP-16, 2026-10-18): features cited from official docs (FastAPI, Pydantic, Next.js, React; proposal v2 2.3, 3.4, 3.5, 3.7); comparative claims still not made |
| S-06 | Iterative-incremental methodology is selected by project characteristics (single developer, engine follows later, requirements can be deferred per increment) [PR-25, PR-17, PR-19 §9.6.9, PR-12 M.2.3]; comparative empirical evidence between methodologies is limited [PR-17]. This is a justified selection, not a claim of superiority over Waterfall, V-model or Scrum. Phase gates are [ASSUMPTION]. (UP-03, 2026-10-18) | ADR-009; Doc 11 §2 (2.6) | Bab II 2.6; Bab III 3.2, 3.4, 3.11 | IEEE/Elsevier software-engineering literature | RESOLVED (reworded) |
| S-07 | Comparative claims about test tooling; software-engineering theory behind Engine Port, Fake Engine and HTTP/OpenAPI concepts. | Doc 8 §9 #11; Doc 11 §2 (2.4, 2.5) | Bab II 2.4–2.5; Bab III 3.9 | Official tool documentation; IEEE/Elsevier software-engineering papers | OPEN |
| S-08 | Formal accessibility claims (WCAG). | Doc 7 §8 | Bab III 3.7 (if claimed) | Official W3C documentation; claim avoided unless sourced | OPEN |
| S-09 | Global and remote-area background statistics; concept theory for microgrids; Bab II literature (about 30 papers) and standards content (IEEE 1547, 2030.7/2030.8, IEC TS 62898, PUIL/SPLN, ESDM). Absent from Docs 1–10. | Doc 11 §2 (1.1.1–1.1.2, 2.1–2.2, 2.8), §5, §7 #5 | Bab I 1.1; Bab II 2.1–2.8 | LR batch files, IEEE Xplore / ScienceDirect; non-IEEE/Elsevier would be [PERLU REF-NONIEEE] | PARTLY (UP-16, 2026-10-18): context sentence sourced from IPCC AR6 SYR SPM, Tracking SDG 7 2025/2026, ESDM (proposal v2 1.1.1); concept theory from skripsi LR [existing] (2.1, 2.2.2); standards content still not reviewed |
| S-10 | Campus rules on AI use in thesis writing. | Doc 11 §7 #9 | Proposal front matter / declaration | Official campus guideline (Pedoman Tugas Akhir) | OPEN |

## 4. KONFLIK (K-xx)
| ID | Conflict | Rule A vs Rule B | Resolution | Status |
|---|---|---|---|---|
| K-01 | Supervisor note "mathematical modelling required" vs settled decision 19. | A: supervisor note asks for mathematical modelling in the proposal. B: dec. 19 limits the proposal to methodology; equations belong to the skripsi. | User 2026-10-17: the proposal has no mathematical formulation; it discusses methodology, clear and fit for a proposal. Proposal acceptance counts as supervisor confirmation (Doc 10 §6 #7); supervisor confirmation still advisable. Sources: Doc 1 §9 K1; Doc 2 #16; Doc 10 EG-P0, §6 #7; Doc 11 §5. Proposal v2 adds a method-level plan without formulation (D-41). | RESOLVED (user) |
| K-02 | Supervisor Bab III notes (independent/dependent variables, parameter variation, flowchart with iterations) assume a calculation method. | A: notes expect variables and parameter variation. B: Bab III describes a software methodology without a calculation method. | User 2026-10-17: acceptable for now; Bab III uses an iterative flowchart and states the development methodology clearly; revisit after supervisor reply. Sources: Doc 1 §9 K2; Doc 2 #16; Doc 10 EG-P0; Doc 11 §5. | ACCEPTED (user, revisit) |
| K-03 | KONFLIK-T (Doc 11 §4): reusing RM2–RM6/T2–T6 in the proposal would promise model content the proposal does not contain. | Skripsi RM/T (approved) vs decision 19 (no math in proposal) | **Option B chosen by user 2026-10-17:** proposal gets its own RM-P/T-P (draft in Doc 11 §4.1); skripsi RM/T unchanged. Wording needs supervisor approval. | DECIDED (wording OPEN) |
| K-04 | Wording conflict (not tagged KONFLIK in source): Doc 7 F2 named "validate and migrate" while Doc 6 defines one `/api/projects/import`. | A: Doc 7 flow wording. B: Doc 6 endpoint list (authoritative). | Doc 6 authoritative (Doc 8 §9 #7); `migrate` replaced by `import` (Doc 6 §8 #1); Doc 7 text no longer shows the old wording at writing time. | RESOLVED |
| K-06 | Supervisor note N24 (parameter variation toward an optimal value, several case studies, select the most optimal) vs proposal scope (Q-PD-10: Bab IV of the proposal reports design checks only; no engine, no sweep results). | A: supervisor note. B: D-04, Q-PD-10. | User 2026-10-21: option (a)+(b). (b) proposal Bab IV 4.6 records the skripsi-stage parametric design (4 reference designs, 7 independent variables, sweep plan, lexicographic selection rule R1) as design without results; (a) written supervisor confirmation still to be obtained (Q-02, Q-16). Contract gaps found: Q-17. | DECIDED (supervisor confirmation OPEN) |
| K-05 | Tension (Doc 7 §10 self-review, not tagged KONFLIK): disabling dependent Run buttons vs "every request creates a RunRecord" (I3). | A: I3, every request yields a RunRecord. B: L2, UI never sends a dependent request without a valid M1. | `DEPENDENCY_NOT_MET` is produced only through the API and covered by API tests; accepted by user (L2). | ACCEPTED |

## 5. Risks (R-xx)
Likelihood (L) and impact (I): L/M/H, qualitative judgement [ASSUMPTION].
| ID | Risk | L | I | Mitigation | Trigger | Source |
|---|---|---|---|---|---|---|
| R-01 | Two-language stack (Python + TypeScript) with two toolchains for one developer. | M | M | Generated types from OpenAPI; one served build; thin slice at P0 | P0 exit gate slips past 2 weeks | ADR-002; Doc 10 §3.1 |
| R-02 | Fake-vs-real engine behaviour gap at P2: contract insufficient or Status sets diverge. | M | H | Same contract suite on both adapters (NFR-08); recorded decision loops back to P1 | Contract suite fails on the Real Engine adapter | ADR-008; Doc 10 §3.3, §7 (b); Doc 3 §10 |
| R-03 | Time budget unmeasured; real runs may exceed ~30 s. | M | M | Measure at P2 (XG-P2 item 5); report as limitation if exceeded | A real M1/M2 run above the placeholder | ADR-007; Doc 10 §3.3 |
| R-04 | Request size growth: every dependent call re-sends the M1 payload; M3c carries several snapshots. | M | L | Measure before fixing the 413 limit; local use only | 413 or slow response on a large Project | ADR-010; Doc 6 §8 #12, §9 (d) |
| R-05 | Usage limits and a short timeline (2 weeks for the doc set; seminar date unfixed) squeeze quality. | H | M | Compact docs, fixed order, no rework loops; fix seminar date (Q-01) | Doc 11 or proposal not ready by about 2026-10-31 | PROMPT_v2 dec. 14; Doc 10 §1, §6 #1 |
| R-06 | Mermaid diagrams could contain syntax errors. **Mitigated 2026-10-17:** all 17 blocks in Docs 1, 4, 7, 8, 10 and ADR-009 pass the Mermaid parser (orchestrator check); visual layout still to be reviewed when redrawn as original figures for Bab II/III. | L | L | Re-run the parser after any diagram edit; redraw for the thesis | Diagram edited | Docs 1, 4, 7, 8, 10, ADR-009 |
| R-07 | Must-heavy scope: P1 holds 30 of the 38 Must FRs (8 in P0) and nearly all screens for a solo developer. | H | M | Three P1 increments; Should deferred by rule; scope moves only by recorded decision (R3) | P1 not at 50 percent of Must FRs by mid-phase | Doc 10 §3.2, §7; Doc 2 §9; Doc 7 §10 (a) |
| R-08 | Supervisor rejects a proposal with no mathematical formulation. | M | H | Strong methodology in Bab III (iterative flowchart, gates, verification plan); ask for confirmation | Supervisor reply to Doc 11 §6 | Doc 1 §11 (b), K-01; Doc 11 §5 |
| R-09 | Unsourced problem statement: Bab I "gap" is opinion without S-01/S-02. | H | H | Close S-01, S-02 from LR B09 and official docs before writing Bab I | Bab I drafted without sources | Doc 1 §11; Doc 11 §5 |
| R-10 | Engine delivery date is outside the app's control; P2 entry gate is external. | M | H | Run P3 on Fake only by recorded decision; keep M5 offline | Engine package not versioned at EG-P2 | Doc 10 §3.3 EG-P2, §7 |
| R-11 | Thesis ends with Fake-only stability results if M3/M4 real adapter arrives late. | M | H | XG-P3 requires Real adapter for M3a–c, M4a–b; limitation entry for M3d | Real adapter for M4 not ready at P3 midpoint | Doc 10 §3.4, §7 (e), §6 #3 |
| R-12 | Fake results mistaken for real results. | M | H | `engine_kind` in RunRecord; Fake banner and `ENGINE_KIND_FAKE` warning; rule R7 | Fake RunRecord appears in thesis evidence | ADR-008; Doc 10 §4 R7; Doc 6 §8 #10 |
| R-13 | Passing tests show plumbing, not usefulness or engine correctness. | H | M | Offline M5 against PSIM for correctness; state limit in Bab IV | Reviewer asks for correctness evidence | Doc 2 §9 (a); Doc 8 §10; Doc 10 §7 (b) |
| R-14 | Browser holds the only copy of the open Project; closed tab loses unsaved work. | M | M | Export prompts; optional autosave (A-13) | User closes tab after long edit | ADR-010; Doc 4 §12 (a) |
| R-15 | Gate reviews are self-administered. | M | M | Advisor review at phase boundaries (A-42) | Gate passed with no recorded check | ADR-009; Doc 10 §4 R6, §7 (a) |
| R-16 | Contract shapes (Docs 3, 6) rest on unverified assumptions and may be wrong at P2. | M | M | Freeze at EG-P1; changes need ADR or register entry (R5) | Contract change requested after XG-P1 | Doc 3 §10; Doc 6 §9; Doc 10 §3.1 |
| R-17 | Mixed unit conventions (physical inputs, p.u. voltage band) rely on correct conversion in the Real Engine adapter. | M | M | Adapter conversion tests at P2 | Unit mismatch found in a Real Engine result | Doc 3 §10 (a) |
| R-18 | `INPUT_INVALID` RunRecords enlarge the Project file and clutter the record list. | M | L | Hide by default; retention rule (A-14) | Project file grows beyond comfortable size | Doc 2 §9 (d); Doc 3 §10 (d); Doc 7 §10 (e); ADR-004 |
| R-19 | 17 screens form a large surface; only S-01…S-08, S-15, S-16 are Must. | M | M | Build Must screens only in P1; Should in P3 | P1 screen work crowds out tests | Doc 7 §10 (a) |
| R-20 | Stale-M1 flag blocks a valid reverted design. | M | L | Re-check offer; conservative by design (A-35) | User reverts edit and cannot run M2 | Doc 7 §10; Doc 10 §3.2 |
| R-21 | Late discovery of browser or performance problems; evidence not reproducible if versions are unpinned. | L | M | Freeze at EG-P4; pin engine version and commit in RunRecords (FR-47) | Regression failure after freeze | Doc 10 §3.5 |
| R-22 | Scope creep from Should into Must work; M4 results shown on Fake may mislead. | M | M | Recorded-decision rule; Fake banner; caps stay null until measured | Unrecorded pull-forward | Doc 10 §3.4 |
| R-23 | Single-worker sync call blocks the server during a run; no concurrent-edit protection. | L | L | Acceptable for one user | Two tabs used at once | ADR-007; ADR-004 |

## 6. Open questions (Q-xx)
| ID | Question | Recommended answer | Needed by | Source |
|---|---|---|---|---|
| Q-01 | What is the seminar date? | Ask the advisor; fix date, then re-plan phase durations (A-43) | EG-P0 | Doc 10 §6 #1; Doc 11 §6 item 4 |
| Q-02 | Does the supervisor confirm "methodology only, no mathematical formulation" (K-01, K-02)? | Send Doc 11 Ringkasan; treat proposal acceptance as confirmation (Doc 10 §6 #7) | EG-P0 | Doc 1 §9; Doc 10 §6 #7 |
| Q-03 | Approve the RM-P/T-P draft wording (Doc 11 §4.1)? | Review with supervisor at the next bimbingan; user approved 2026-10-18 (Q-PD-1); supervisor pending (UP-10, 2026-10-18) | Before seminar | Doc 11 §4.1 |
| Q-04 | Routes for Should analysis types before P3. | RESOLVED (orchestrator): 404 `UNKNOWN_ANALYSIS_TYPE` until the type is built (P3); all nine routes exposed by XG-P4 (Doc 10 §6 #4). | — | Doc 10 §6 |
| Q-05 | Stale "pending" status markers in ADR index and Doc 4 §10. | RESOLVED (orchestrator): updated to approved by user 2026-10-17. | — | 05_adr/README, Doc 4 §10 |
| Q-06 | Which standard supplies the default constraint values, and which edition? | Review the official documents first; keep TBD-default until then (S-04) | EG-P1 | Doc 3 §9 #5 |
| Q-07 | Which browsers are supported? | Gate E2E on one Chromium-based browser; others at P4 | XG-P1 | Doc 8 §9 #4 |
| Q-08 | What does the report contain and in what order? | Verdict, limiting constraints, margins, assumptions, RunRecord hash; layout reviewed with a printed page | XG-P1 | Doc 7 §9 #6 |
| Q-09 | Keep `INPUT_INVALID` RunRecords in the Project file? | Keep and hide by default | XG-P1 | Doc 7 §9 #7; Doc 4 §11 #12 |
| Q-10 | M4b disturbance catalogue and duration cap values? | Four kinds as aligned with the engine plan (LOAD_STEP, LOAD_SCALING, REFERENCE_STEP, INVERTER_OUTAGE; C5.5, 2026-10-21), approval at EG-P3; placeholder cap until measured | EG-P3 | Doc 2 #11; Doc 3 §6.9 |
| Q-11 | `MARGIN_WARN` value and unit rule per constraint kind? | Define with Doc 3 / Doc 6 before FR-26 | EG-P3 | Doc 7 §9 #5 |
| Q-12 | Network diagram library and drag-to-edit? | Read-only first; choose library at P3a | EG-P3 | Doc 7 §9 #4 |
| Q-13 | When will the engine package for PS/M1/M2 exist, with git commit? | Ask engine owner; schedule P2 from that date | EG-P2 | Doc 10 EG-P2 |
| Q-14 | Which campus guideline governs AI use and the number of references for Bab II? | Obtain Pedoman Tugas Akhir and supervisor notes | Before seminar | Doc 11 §6 items 5, §7 #9 |
| Q-16 | Does the supervisor confirm in writing that model formulation, parameter study, case studies and selection of the best design belong to the skripsi, while the proposal records their design only (K-01, K-06)? | Ask at the next bimbingan with proposal Bab IV 4.6 and Tabel 4.16 | Before seminar | proposal Bab IV 4.6; K-06 |
| Q-17 | Close the contract gaps for the skripsi parametric study: (i) power-filter time constants τ_P, τ_Q absent from Inverter (Doc 3 §3.6) though M4 needs them; (ii) M3b/M3d axes take one `parameter_path`, the skripsi plan sweeps group scale factors (all loads, both inverters' droop, ratings, line R); (iii) M3 points carry no stability metrics or λ_c/λ_s needed by rule R1. | Pending user decision (proposal record C6.2–C6.4). Options: add Inverter fields; add a group-scale axis kind; add optional per-point M4 metrics or run R1 outside the app | EG-P3 | proposal record C6.2–C6.4 |
| Q-15 | Is `MALFORMED_REQUEST`-style conversion needed for every analysis route, including unknown routes (404)? | Yes for analysis routes; 404 stays transport | XG-P0 | Doc 6 §1, §8 #4 |

## 7. Future work (F-xx)
| ID | Item | Why not v1 | Sources | Status |
|---|---|---|---|---|
| F-01 | AI/LLM features (for example assisted interpretation of results). Recorded here and in Doc 1 only. | Out of scope for v1 (dec. 13) | Doc 1 §5; Doc 2 §6; Doc 10 §3.5 | DEFERRED |
| F-02 | Asynchronous job queue: submit/status/result endpoints, worker, progress polling. | Sync model sufficient for one user (ADR-007); upgrade path not designed | ADR-007; Doc 1 §4; Doc 2 §6 | DEFERRED |
| F-03 | Hosted demo or hosted deployment. | Local only (dec. 12) | Doc 1 §4; Doc 2 §6; Doc 10 §3.5 | DEFERRED |
| F-04 | Database (SQLite rejected in ADR-004). | Single user, file-based reproducibility | Doc 1 §4; Doc 2 §6; ADR-004 | DEFERRED |
| F-05 | Authentication and multi-user. | Single user, local (dec. 7) | Doc 1 §4; Doc 2 §6; Doc 10 §3.5 | DEFERRED |
| F-06 | Thesis-level exclusions: grid-following inverters, VSM, secondary/tertiary control, unbalance, harmonics, protection, automatic optimisation, detailed battery models (no storage entity in v1). | Fixed islanded-droop scope | Doc 1 §4; Doc 2 §6; Doc 3 §3.6, §9 #12 | DEFERRED |
| F-07 | Techno-economic and environmental analysis; resource-based PV/wind/diesel sizing and dispatch. | Unless explicitly added later | Doc 1 §4; Doc 2 §6 | DEFERRED |
| F-08 | M5 PSIM validation inside the UI. | Offline script; report goes to the thesis | Doc 1 §4; Doc 2 §6; Doc 8 §7; Doc 10 §3.6 | DEFERRED |
| F-09 | Server-side PDF generation. | Report export is browser print-to-PDF (G) | Doc 2 §6 | DEFERRED |
| F-10 | Undo and redo in the client store. | Not provided in v1 | Doc 7 §7; ADR-005 | DEFERRED |
| F-11 | Drag-to-edit network diagram. | Diagram Should and read-only first | Doc 7 §9 #4 | DEFERRED |
| F-12 | M3d 2-D feasibility envelope (Could, FR-32); may exit P3 on Fake Engine only with a limitation entry. | Time permitting | Doc 10 §3.4, §3.6, §6 #3 | DEFERRED |
| F-13 | Unimplemented Should/Could items at XG-P4 listed as stated limitations. | Gate rule | Doc 10 XG-P4 item 3 | OPEN |
| F-14 | Indonesian UI labels (v1 labels are English with Indonesian glossary and tooltips) [ASSUMPTION: derived, not stated as future work]. | Decision L1 | Doc 7 §9 #1 | DEFERRED |

## 8. Decision log (D-xx)
All decisions dated 2026-10-17 except D-41 (2026-10-18). "Orch." = orchestrator, user-approved where stated in the source doc.
| ID | Decision | Date | Decided by | Docs affected |
|---|---|---|---|---|
| D-01 | G: M3/M4 may run on `INFEASIBLE` designs (a valid M1 is still required). | 2026-10-17 | user | 1, 2, 3, 6, 10 |
| D-02 | G: Report export is an HTML view printed to PDF by the browser. | 2026-10-17 | user | 1, 2, 7 |
| D-03 | G: Re-running a RunRecord on a different engine version warns and still runs. | 2026-10-17 | user | 1, 2, 6, 10 |
| D-04 | G / K1: The proposal has no mathematical formulation (methodology only). | 2026-10-17 | user | 1, 2, 11 |
| D-05 | K2: Bab III uses an iterative flowchart and states the development methodology; revisit after supervisor. | 2026-10-17 | user | 1, 10, 11 |
| D-06 | Terminology: `SizingAdvice` = PS output (advisory, pre-network); `SizingCheck` = M2 output (network-based). | 2026-10-17 | user | 1, 3 |
| D-07 | I1: M1 returns only `FEASIBLE` ("operating point found"); verdict only from M2; valid M1 = FEASIBLE and equal snapshot hash; six-value enum unchanged. | 2026-10-17 | user | 2, 3, 6, 8, 10 |
| D-08 | I2: Over-cap sweep/envelope → `INPUT_INVALID` / `SWEEP_CAP_EXCEEDED` before the engine call; not an `UNAVAILABLE` reason. | 2026-10-17 | user | 2, 3, 6 |
| D-09 | I3: Every analysis request produces a RunRecord; engine fields null when the engine was not called. | 2026-10-17 | user | 2, 3, 4, 6 |
| D-10 | I4: Inputs in physical units; voltage band in p.u. of nominal; conversion is the Real Engine adapter's job. | 2026-10-17 | user | 3 |
| D-11 | I5: Line r, x per km and length required; totals derived by the app (simple product). | 2026-10-17 | user | 3 |
| D-12 | I6: Bus deletion with dependents refused; RunRecord import with hash mismatch refused. | 2026-10-17 | user | 2, 6, 7 |
| D-13 | I6: Server binds loopback only (NFR-17). | 2026-10-17 | user | 2, 4, 10 |
| D-14 | I6: One system-level LoadProfile per Project; single voltage level, no transformers. | 2026-10-17 | user | 3 |
| D-15 | I6: Network diagram Should; table editing Must. | 2026-10-17 | user | 2, 7 |
| D-16 | I7: MoSCoW tightening; FR-26 and FR-51 are Should; other Must rows reviewed against the Must pipeline. | 2026-10-17 | user | 2, 10 |
| D-17 | J1: Stateless backend; open Project and RunRecords held in the browser; self-contained requests; persistence by export/import; no server disk writes. | 2026-10-17 | Orch., user-approved | 3, 4, 6, ADR-010 |
| D-18 | J2: All analysis outcomes are HTTP 200 with AnalysisResult and RunRecord; request-model failures converted to `INPUT_INVALID`; 4xx transport only; 5xx = defect. | 2026-10-17 | Orch., user-approved | 4, 6, ADR-006 |
| D-19 | J3: JSON over HTTP, resource/action style, OpenAPI generated; GraphQL, WebSocket/SSE, single-endpoint RPC rejected. | 2026-10-17 | Orch., user-approved | 4, 6, ADR-003 |
| D-20 | J4: Layers UI → API → services → Engine Port ← adapters; domain schemas shared; frontend talks only to the API. | 2026-10-17 | Orch., user-approved | 4, 8, ADR-010 |
| D-21 | J5: Engine chosen by startup configuration (FAKE or REAL), never per request. | 2026-10-17 | Orch., user-approved | 4, 6, 10, ADR-008 |
| D-22 | J6: Time budget enforced in the application service around the Engine Port call; mechanism left open (A-15). | 2026-10-17 | Orch., user-approved | 4, ADR-007 |
| D-23 | J7: One client-side Project store with React built-in (Context + reducer); weak margin against a small store library. | 2026-10-17 | Orch., user-approved | 4, 7, ADR-005 |
| D-24 | K1: `depends_on` (RunRecordRef) required for M2, M3a–d, M4a–b; stored in the dependent RunRecord input. | 2026-10-17 | Orch., user-approved | 3, 4, 6 |
| D-25 | K2: `result_hash` in every RunRecord; three-part dependency check (status, snapshot hash, result hash). | 2026-10-17 | Orch., user-approved | 3, 4, 6 |
| D-26 | K3: M3c request carries the compared scenarios, part of the hashed input; count capped (A-03). | 2026-10-17 | Orch., user-approved | 3, 4, 6 |
| D-27 | K4: Non-analysis endpoints return HTTP 200 with FileCheckResult (not a Status). | 2026-10-17 | Orch., user-approved | 3, 4, 6 |
| D-28 | K5: Unexpected engine exception → `UNAVAILABLE` / `ENGINE_ERROR`, RunRecord created, logged locally. | 2026-10-17 | Orch., user-approved | 3, 4, 6, 8 |
| D-29 | K6: Unknown `analysis_type` in the route → HTTP 404, no RunRecord. | 2026-10-17 | Orch., user-approved | 4, 6 |
| D-30 | L1: UI labels English in v1, Indonesian glossary on S-17 and Indonesian tooltips. | 2026-10-17 | user | 7, 11 |
| D-31 | L2: Dependent Run buttons disabled when M1 is missing or stale; `DEPENDENCY_NOT_MET` arises only at the API. | 2026-10-17 | user | 7, 8 |
| D-32 | L3: Staleness is a conservative UI flag on any design edit; the service is the final check. | 2026-10-17 | user | 7, 8 |
| D-33 | L4: Doc 6 (15 endpoints) and Doc 7 (S-01…S-17, F1–F4) approved; their IDs are used. | 2026-10-17 | user | 6, 7, 8, 10 |
| D-34 | `/api/projects/import` (check plus forward migration) replaces `/migrate`; RunRecord import checks both hashes; unparseable JSON → 400, valid non-Project JSON → 200 `MALFORMED_FILE`. | 2026-10-17 | Orch. | 3, 6, ADR-003 |
| D-35 | Request-level codes added (`PARAMETER_CAP_EXCEEDED`, `DURATION_CAP_EXCEEDED`, `SCENARIO_COUNT_INVALID`, `DEPENDS_ON_NOT_ALLOWED`, `MALFORMED_REQUEST`); `initial_guess` only `DEFAULT`; rerun `outcome` values `REPRODUCED` / `DIFFERS`. | 2026-10-17 | Orch. | 3, 6 |
| D-36 | Engine returning a Status outside the allowed set for its type (for example M1 `INFEASIBLE`) fails the contract suite and maps at runtime to `UNAVAILABLE` / `ENGINE_ERROR`. | 2026-10-17 | Orch. | 3, 8 |
| D-37 | Offline M5 starts in P2 (M1/M2) and extends to M4 in P3; Real adapter for M3a–c and M4a–b is part of XG-P3 (M3d may be Fake-only with a limitation). | 2026-10-17 | Orch. | 8, 10 |
| D-38 | Proposal acceptance counts as the supervisor's confirmation of K-01 / K-02 (no separate step). | 2026-10-17 | Orch. (user resolved K1/K2) | 10, 11 |
| D-39 | FR-49 and FR-54 export is client-side; FR-49/50/52/53 are Must; seam T7 (client store tests) added. | 2026-10-17 | Orch. | 2, 8, 10 |
| D-40 | Stack: FastAPI backend and Next.js static export (settled decision 16); methodology iterative-incremental, Fake-Engine-first (settled decision 17). Listed because ADR statuses depend on them. | 2026-10-17 | user (settled before this review) | ADR-001, 002, 009 |
| D-41 | Proposal names the planned modelling level and calculation methods per module in Bab II 2.2.2 without equations, parameter values or algorithm steps (KF-1 option b); D-04 still holds (no mathematical formulation). (UP-15, 2026-10-18) | 2026-10-18 | user | 9, 11 |
| D-42 | Document change proposals from the proposal design checks (C5.1–C5.18, C5.20; record claude/PROPOSAL_pemeriksaan_Bab4-5_v1.md) applied to Docs 2, 3, 4, 6, 7, 8, 9, 10, 11; C5.19, C5.21, C5.22 applied to the proposal text. Architecture change: Re-run orchestrator component (C5.12). M4b catalogue aligned but still approved at EG-P3 (A-08 OPEN). | 2026-10-21 | User (approved change proposals) | 2, 3, 4, 6, 7, 8, 10, 11 |

## 9. Self-review
- **Grep counts (Docs 1–8, 10 and ADR-001…010, run at writing time):** `[ASSUMPTION]` 188 occurrences on 179 lines; `[NEEDS SOURCE]` 25 occurrences on 24 lines; `KONFLIK` 5 occurrences on 5 lines. Doc 11 has 12 `ASSUMPTION`, 15 `NEEDS SOURCE` and 13 `KONFLIK` lines (read, not counted toward the gate); its items map to A-05, A-43, A-47, S-01…S-10, K-01…K-03.
- **Coverage:** every `ASSUMPTION` line in the three inputs maps to A-01…A-47 (manual line-to-row check by file and line number, 179 of 179 lines mapped). Lines that only define or quote the tag are mapped to §1, not to a row: Doc 2 §1 tag definition and DR-05, Doc 3 Ringkasan, Doc 8 §8 checklist, Doc 10 EG-P0 and XG-P4 gate wording. Every `NEEDS SOURCE` line maps to S-01…S-10 (24 of 24; definitional lines Doc 2 DR-05 and Doc 8 §8 excepted). Of the five `KONFLIK` lines, four map to K-01 and K-02 (Doc 1 §9 K1/K2, Doc 2 #16, Doc 10 EG-P0); Doc 2 DR-05 is definitional.
- **Weakest point:** deduplication merged related items (for example A-23, A-29), so one row can hide several small decisions; the Sources column lists every location so none is lost. Likelihood/impact values are judgement, not measurement.
- **Could not place cleanly:** (a) Doc 10 §6 #4 states a choice ("keep, or register all nine") and also marks it DECIDED, so I recorded it as Q-04 rather than D-xx; (b) ADR index status lines say "pending review" while Docs 4 and 6 say approved (Q-05); (c) Doc 11 was read as a moving target and may change K-03, A-47, S-09, S-10.
- **Guardrail check:** no equations, pseudocode, numerical-settings justification or accuracy claims; the only numbers are the ~30 s placeholder and the P0–P4 relative weeks already stated in Docs 1 and 10.

## Log delegasi (Task "Doc 9 drafting", Model sonnet)
| Task | Model | Retries/escalation | Orchestrator fixes |
|---|---|---|---|
| Doc 9 drafting | sonnet | 0 | — |
| Doc 9 cross-check | Opus (orchestrator) | — | Closed Q-04, Q-05; R-06 mitigated (Mermaid parse check 17/17); fixed stale pending markers in ADR README and Doc 4 |
| UP-01 edit | sonnet | 0 | – |
| UP-02 edit | sonnet | 0 | – |
| UP-03 edit | sonnet | 0 | – |
| UP-08 edit | sonnet | 0 | – |
| UP-10 edit | sonnet | 0 | – |
| UP-15 edit | sonnet | 0 | – |
| UP-16 edit (S-05, S-09 status) | Opus (orchestrator) | – | – |

DOC 9 COMPLETE

## Change log 2026-10-21 (user-approved change proposals from the proposal design checks)
- C5.5 A-08 text updated to the aligned catalogue (still OPEN, close at EG-P3).
- C5.20 A-39 pinning scope: tool versions at P0, engine version/commit at P2.
- D-42 added: change proposals applied.
- K-06 and Q-16 added (KONFLIK N24 option (a)+(b)); Q-17 added (contract gaps C6.2–C6.4, pending decision).
- Q-10, A-44, R-07 aligned with C5.5 and C5.18.

## 10. Alignment with the final manuscript (2026-11-01, Doc 14 D6)
The rows above are kept as written on 2026-10-21. This section overrides their status where listed; the manuscript (`Seminar.pdf`) wins on conflict. Phases P0–P4 in the rows above map to stages 1.1, 1.2, 1.4, 1.5, 1.7 (Doc 10).

### 10.1 Items closed or changed by the manuscript
| ID | New status | Basis |
|---|---|---|
| A-01 | TIME_BUDGET initial value 30 s, replaced by measurement at WP 1.4.3. DECIDED (initial). | Manuscript 4.1.3, 4.3.3 |
| A-02 | SWEEP_CAP initial value 1 000 points (largest planned 2-D sweep 891 points); re-set at WP 1.7.1. DECIDED (initial). | 4.1.3, 4.2.9 |
| A-06, S-04, Q-06 | No numeric defaults for DesignConstraints; empty limit reported "not evaluated". Default nominal frequency 50 Hz stays (Tabel 4.9). CLOSED. | 4.2.4, Tabel 4.9, A.1 #16 |
| A-07, Q-11 | MARGIN_WARN 0.05 on the normalised margin of Eq. (4.18). DECIDED (initial; re-set at WP 1.7.1). | 4.1.3 |
| A-08, Q-10 | M4b catalogue: four kinds (load step, load scaling on one or all buses, reference step on P*, Q*, V* or ω*, inverter outage); steps permanent or finite duration. Duration cap value still null. CLOSED except cap. | 4.2.6 |
| A-10, Q-07 | Browser: latest stable Google Chrome; version written in the test log. CLOSED. | 4.1.1, 4.3.9, A.2 #7 |
| A-15 | Timeout mechanism for stage 1.1: worker thread, wait at most TIME_BUDGET, discard a late result; engine fields filled because the engine was called. Revisit at WP 1.4.3 (option: subprocess per call). DECIDED (user 2026-11-01). | Doc 4 §7(c) |
| A-19 | Number format for canonical JSON: ECMAScript Number-to-String (shortest round trip, as in RFC 8785 [PERLU VERIFIKASI against RFC text]); integers written without fraction; `-0` → `0`; NaN/Infinity refused; keys ordered by Unicode code point; entity arrays sorted by `id`. DECIDED (user 2026-11-01). | 4.3.5 |
| A-39 | Library versions pinned in `backend/uv.lock` and `frontend/package-lock.json` at stage 1.1; recorded via `app_version`. DECIDED. | 4.3.9 |
| Tools (Doc 8 §9 #5) | uv, npm, ruff, mypy, pytest, import-linter, Vitest, Playwright, dependency-cruiser; tasks as stdlib Python scripts in `tools/`. DECIDED (user 2026-11-01). | Doc 8 §3 |
| Fake payloads | Placeholders derived from the snapshot (nominal V and f, zero losses, element ids from the request); no invented physics. DECIDED (user 2026-11-01). | Doc 8 §5 |
| Stage 1.1 endpoints | health, meta, nine analysis routes; validate/import/verify/rerun in 1.2. DECIDED (user 2026-11-01). | Doc 10 §7 #3 |
| DR-08 | Cancelled (equations allowed). KONFLIK user-decided. | Doc 14 A20 |

### 10.2 New open points
| ID | Item | Tag | Owner / when |
|---|---|---|---|
| A-50 | Sixteen-component list of Doc 4 §4 reconstructed from text; verify against Gambar 4.4b. | [ASSUMPTION] | author, before 1.2 |
| A-51 | DoD ten conditions reconstructed (manuscript gives count and two examples only). | [ASSUMPTION] | author, exit 1.1 |
| A-52 | Gate rules G3–G6 not listed in manuscript text (Doc 10 §5). | [PERLU VERIFIKASI] | author, exit 1.1 |
| A-53 | Caps SCENARIO_CAP, M3A_PARAMETER_CAP, M4B_DURATION_CAP_S have no value; `/api/meta` returns null. | [ASSUMPTION] | WP 1.7.1 |
| A-54 | Node.js 26.7.0 (manuscript Tabel 3.5) installed in the build sandbox from the npm package `node-linux-x64@26.7.0`; TypeScript pinned to 5.9.3 (latest 5.x) because openapi-typescript requires `^5.x`. | DECIDED | 1.1.1 |
| A-55 | HTTP port 8000 (uvicorn default), overridable by `MGAPP_PORT`; the docs fix no port. | [ASSUMPTION] | author, exit 1.1 |
| Q-20 | Doc 13 #1: do layer-1 numerical aids for constant-PQ loads change the fidelity class? | DECISION NEEDED | before WP 1.6.3 |
| Q-21 | Doc 13 #2–#6: layer-2 parameter source, current-limit value, PSIM constant-power element, PSIM scripting, resolution floor. | [NEEDS SOURCE] / VERIFY | WP 1.6.2–1.6.3 |
| Q-22 | Doc 12 #2, #4, #5: author-derived Eq. 12.3–12.13 need hand-check; B3 needs supervisor approval; fictitious catalogue names. | [ASSUMPTION] / FUTURE | before stage 1.5 |
