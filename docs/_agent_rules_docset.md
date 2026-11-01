OVERRIDE 2026-11-01 (user decisions after the seminar proposal; take precedence over everything below)
O1. Source of truth: the final seminar-proposal manuscript `Seminar.pdf` (28-10-2026). Docs 02, 03, 06 are aligned with it; remaining differences are listed in docs/14_alignment.md. PROMPT_v2.md and 01_brief.md are historical inputs only.
O2. Addendum C below (no equations) is CANCELLED: design docs may contain equations (LaTeX); cite manuscript equation numbers; author-derived formulas are marked "diturunkan dalam penelitian ini" when moved into the skripsi. Recorded as KONFLIK with manuscript Tabel A.3 #8.
O3. Addendum E: implementation code is allowed from stage 1.1 onward, in the code repository, following Docs 02–08 and the gates of manuscript Tabel 4.15.
O4. Post-proposal extensions live in docs/12_extensions.md and must not add equations, states or assumptions to the engine model; PSIM validation basis in docs/13_psim_modeling.md.
O5. Prototype App.zip: app code reference only; its validation package (cases, designs, tolerance policy, PSIM guide) is reusable prior art for stage 1.6.

INTEGRITY RULES (all agents)
1. Never invent references, DOIs, authors, titles, data, equations, parameters or results.
2. Sources allowed: the manuscript, LR batch files (claude/LR_B*.md, claude/LR_P*.md), DAFTAR_REFERENSI_final.md, and staged full texts. Nothing from memory.
3. Equations/parameters only from FULL-read sources; else mark UNVERIFIED-EQ / UNVERIFIED-PARAM.
4. Label every claim in thesis drafts: [FAKTA-LIT ref], [ASUMSI], [DERIVASI-SENDIRI].
5. Missing claim support -> [PERLU REF]; missing data -> [PERLU DATA]; non-IEEE/Elsevier only -> [PERLU REF-NONIEEE]. Never fill silently.
6. Sources: IEEE Xplore and ScienceDirect/Elsevier preferred; high-quality official non-IEEE sources allowed where already cited. Citations IEEE format.
7. Thesis prose: Indonesian baku (EYD V), foreign terms italic, SI units, per-chapter numbering, LaTeX equations.
8. Do not state contents of IEEE 1547-2018, 2030.7/2030.8, IEC TS 62898, PUIL/SPLN, ESDM rules (not reviewed).
9. If blocked, stop and report the blocker in the reply; do not guess.

DOC-SET ADDENDUM (architecture docs, 2026-10-17) — overrides 4 and 7 for these docs only
A. Sources for this doc set: see O1. Prototype App is REFERENCE ONLY (vocabulary, feasibility); never treat it as a decision; never copy its code without review.
B. Technical text in English. Each doc opens with "## Ringkasan": Indonesian (EYD V), plain language, 5–8 sentences.
C. (CANCELLED 2026-11-01, see O2.)
D. Tags: [ASSUMPTION] for anything not settled; [NEEDS SOURCE] for unverified comparative/external claims.
E. (Superseded by O3 for the code repository.) Docs: Mermaid, tables, schema sketches, equations.
F. Fixed vocabulary (exact spelling): Project, Bus, Line, Load, LoadProfile, Inverter, DesignConstraints, SizingAdvice (PS output, advisory, pre-network; "saran kapasitas awal"), SizingCheck (M2 output, network-based; "penentuan kapasitas awal"), Scenario, AnalysisRequest, AnalysisResult, RunRecord, Status, Engine Port, Fake Engine, Real Engine adapter. Status values: INPUT_INVALID, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INFEASIBLE, FEASIBLE, UNAVAILABLE. analysis_type: PS, M1, M2, M3a, M3b, M3c, M3d, M4a, M4b.
G. Decisions 2026-10-17 (binding): M3/M4 may run on INFEASIBLE designs (still need a valid M1 operating point); report export = HTML view printed to PDF by browser; re-running a RunRecord on a different engine version = warn, still run.
H. Compact. Tables over prose. No filler.
I. Decisions 2026-10-17 round 2 (binding): I1 M1 never returns INFEASIBLE; valid M1 = FEASIBLE + same snapshot hash + matching result hash; verdict only from M2. I2 over-cap sweep -> INPUT_INVALID / SWEEP_CAP_EXCEEDED before the engine call. I3 every analysis request produces a RunRecord; engine fields null when the engine was not called. I4 physical units; voltage band in p.u.; unit conversion is the Real Engine adapter's job. I5 Line r/x per km with length; totals derived by the server. I6 Bus deletion with dependents refused; RunRecord hash mismatch refused; loopback only; one LoadProfile; single voltage level; diagram Should. I7 MoSCoW per manuscript Tabel A.1.
J. Architecture (approved 2026-10-17): J1 stateless backend, client-held Project, self-contained requests with depends_on; J2 all analysis outcomes HTTP 200 with AnalysisResult + RunRecord, 4xx transport only; J3 JSON/HTTP resource/action, OpenAPI from schemas, 15 endpoints (Doc 6); J4 UI -> API -> application services -> Engine Port <- adapters, inward dependencies only; J5 engine chosen at startup (FAKE|REAL); J6 time budget enforced by the execution guard around the Engine Port call; J7 one client-side Project store (Context + reducer).
K. Gap resolutions (approved 2026-10-17): K1 depends_on RunRecordRef; K2 result_hash over {status, payload}; K3 M3c scenarios in the request; K4 FileCheckResult for file endpoints; K5 engine exception -> UNAVAILABLE / ENGINE_ERROR; K6 unknown analysis_type route -> 404.
L. Decisions 2026-10-17 round 4: English UI labels + Indonesian glossary and tooltips; dependent Run buttons disabled when M1 missing/stale; staleness = conservative UI flag, server is final check. Doc 7 screen IDs S-01..S-17, flows F1–F4.
