# PRD: Example mode (guided example over the whole pipeline)

> Standalone feature guideline and PRD for Claude Code. Written 2026-11-05 against `tahap-1.5` at commit `045f89a` (UX-12 done, SLD-7 done). Companion to `docs/UX_ANALYTICS_GUIDELINES.md` (hard rules §1 stay binding), `docs/SLD_FEATURE_GUIDELINES.md`, `docs/VISUAL_DESIGN_GUIDELINES.md` and ADR-012. Source of truth stays `Seminar.pdf`; the doc set in `docs/` wins over this file on any conflict except where a user decision recorded here says otherwise.

## Ringkasan

Mode contoh memberi pengguna baru satu proyek contoh terpandu yang sudah lengkap: desain D2, batasan studi, skenario, dan pengaturan setiap analisis. Pada setiap layar pengguna cukup menekan Run untuk melihat hasil seluruh pipeline, dari saran kapasitas awal (PS) sampai stabilitas transien (M4b). Mode ini tidak menambah persamaan, keadaan, asumsi, atau kolom kontrak. Hasilnya tetap berasal dari mesin yang aktif (REAL atau FAKE) dan tercatat sebagai RunRecord biasa. Setiap nilai yang diisikan otomatis harus menyebut sumbernya (Doc 13, Doc 3 §3.7, atau pengaturan studi penulis yang dikonfirmasi pengguna). Nilai yang belum bersumber dibiarkan kosong dan ditandai, bukan dikarang. Fitur ini dicatat sebagai ekstensi Doc 12 X9.

## 1. Problem and goal

Every analysis form starts empty by design: the contract forbids defaults (Doc 3 §3.7 "no numeric defaults", §6.3 m_inv/m_line "no default", §6.4 step "no default", §6.9 settling "no defaults"; D-46 K11). That is right for real design work, but a first-time user, an examiner or the advisor cannot see what the tool does without knowing what to type on eleven screens. Today the only route is `docs/demo_script.md`, which a person reads and types from.

**Goal:** one click on S-01 opens a guided example. On every screen of the pipeline the form is already filled with sourced example values, so pressing **Run** gives a result. The user can follow the stepper from Loads to Report and see every analysis, chart, KPI strip, SLD overlay and the report, without typing.

**Non-goals:**
- No pre-computed or bundled results. Results always come from the engine that is running (REAL or FAKE) and are stored as normal RunRecords.
- No change to the engine, payloads, Project file schema, RunRecord schema, API or Engine Port.
- No default values for normal (non-example) Projects. Outside example mode every form behaves exactly as today.
- Not a tutorial system with overlays, highlights or forced steps. The stepper stays guidance, not a wizard lock (Doc 7 §3).

## 2. Users and use cases

| User | Use case |
|---|---|
| New user (junior engineer, Doc 1 §6) | Learn the workflow by running each step on a known design before entering their own. |
| Advisor / examiner | See the full pipeline in a demonstration in a few minutes (replaces typing from the demo script). |
| Author (thesis) | Reproducible walkthrough for BAB IV screenshots and for a short usability check (HANDOFF_UI_DESIGN_SYSTEM §5 item 6). |

## 3. Hard rules

1. **Never invent a value.** Every prefilled value names its source: Doc 13 §4/§5, Doc 3 §3.7, the manuscript, or an **author's study setting** that the user has confirmed and that is recorded in the Doc 9 D-entry of EX-0. A value without such a source stays empty and the field shows "Not set in the example: enter a value" (§6, status NEEDS VALUE).
2. **No numbers in explanatory text.** Guidance text never quotes a result value (results differ between FAKE and REAL and between engine versions). It may name what to look at ("the frequency lower-limit margin"), not what it equals.
3. **FAKE stays marked.** In example mode on the Fake Engine every result keeps the existing FAKE marking; the example banner adds "Results on the Fake Engine are placeholders. Start with `MGAPP_ENGINE=REAL` to see engine results."
4. **Example settings never enter the canonical snapshot or a RunRecord.** They are prefill only. What is sent to the engine is whatever the form holds when the user presses Run, exactly as today; the RunRecord stores those parameters as usual.
5. **Prefill never overwrites the user.** Precedence per field: value the user typed > refill from the last RunRecord of that analysis (K149 pattern) > example value > empty.
6. **No accept on the user's behalf.** The example never accepts SizingAdvice, never deletes or edits design data, never runs anything without a click (except the Could "Run whole example", §8, which is itself a click).
7. All rules of `docs/UX_ANALYTICS_GUIDELINES.md` §1 apply (no engine number computed in the browser, accessible names are test contracts, offline, status = colour + icon + word).

## 4. Data: two static files

| File | Content | Contract impact |
|---|---|---|
| `frontend/public/examples/guided-d2.mgproj.json` | A normal schema-v1 Project file: design D2 (same values as `d2.mgproj.json`), **plus** DesignConstraints and Scenarios (§6). Opens as a new unsaved copy with a new id, like FR-85. | None: every field already exists in schema v1. |
| `frontend/public/examples/guided-d2.example.json` | Example settings: per-screen prefill values with source, guidance text per screen, schema version of this file. Read only by the frontend. | None on the engine/API contract. It is a static UI asset with its own small versioned schema (`example_settings_version: 1`), documented in Doc 7 and validated on load (§5.3). |

The existing examples D1, D2, D2S, D2H (Doc 12 P2) stay unchanged, so their regression values (Doc 9 D-64) do not move.

**Open decision EX-D1:** one guided example (D2) only, or also guided D1? Recommended: D2 only. It has two inverters, so it exercises sharing, N−1, participation and the INV2 outage case.

## 5. Behaviour

### 5.1 Entering and leaving

- **S-01 Start:** a new primary action **"Open guided example (D2)"** with one line under it: "Every screen is pre-filled. Press Run on each step to see the whole pipeline." It sits above the four existing example links, which stay as they are.
- Opening sets UI state `example: { id: "guided-d2", settings }` in the store. This is **not** part of the Project file, the canonical snapshot or any RunRecord (Doc 3 §3.2 rules).
- The header shows a Carbon `Tag` **"Example mode"** next to the engine badge, plus a **"Leave example mode"** button. Leaving clears the prefill source; the Project, its data and its RunRecords stay.
- Opening another Project, creating a new one, or opening a file also leaves example mode.
- **Save** writes the Project file as today. The example settings are not saved; reopening the saved file opens a normal Project (state this in the toggletip of "Example mode").

### 5.2 On every screen with a form

- An info-role banner (Carbon InlineNotification, info, not a status colour) under the page head: "Example mode: this screen is pre-filled from the guided example. Press Run." plus a **"What this step shows"** disclosure with the guidance text (2–4 sentences, §7).
- Each prefilled field carries a small **"Example"** tag with a toggletip naming the source (e.g. "Doc 13 §5 case DR-01", "Doc 3 §3.7 reference-design study setting", "Author's study setting, D-92").
- A field with status NEEDS VALUE shows its normal empty state plus the line "Not set in the example: enter a value." The Run button behaves as today (stage-1 validation names the missing field).
- **"Reset to example values"** (ghost button) restores the example values on that screen.
- After a successful run, a **"Next: <step name>"** link under the result points to the next stepper step (pipeline order, Doc 7 §3). Further analyses go in this order: M3a → M3b → M3c → M3d → M4a → M4b → Report.

### 5.3 Loading and validation of the settings file

- Loaded once from the static export, with no network beyond the local server.
- Validated with a hand-written type guard (no new dependency). Unknown keys are ignored. A field whose value fails that field's normal stage-1 rule is dropped with a console warning and treated as NEEDS VALUE. If the file is missing or invalid, S-01 hides the guided-example action and shows nothing broken.
- `parameter_path` values in the settings (M3a paths, scenario overrides, axes) must resolve against the opened Project (Doc 3 §3.10); unresolved ones are dropped the same way.

### 5.4 Store

- A new UI-state slice `example` (null or `{id, settings}`), with actions `exampleEntered`, `exampleLeft`.
- Screen-local forms read their initial value through one helper, `initialValue(screen, field)`, which applies the precedence of §3 rule 5. "Reset to example values" re-applies the example layer only.
- This is a store-behaviour change, so it needs a Doc 9 D-entry (rule G6), like D-72 K151.

## 6. Example values: what is sourced and what you must decide

Status: **SOURCED** = from a doc or the manuscript; **AUTHOR** = an author's study setting, prefilled only after you confirm it at EX-0 (it is then recorded in D-92); **EMPTY** = deliberately left empty because the empty state is itself instructive; **NEEDS VALUE** = no source yet, so you supply one at EX-0 or the field stays empty.

| Screen | Field | Proposed value | Status | Source / note |
|---|---|---|---|---|
| S-03/S-05 | Design D2 (buses, lines, loads, inverters, τ) | as `d2.mgproj.json` | SOURCED | Doc 13 §4 (prototype values, confirmed or replaced at WP 1.6.1) |
| S-06 | voltage_min_pu / voltage_max_pu | 0.95 / 1.05 | SOURCED | Doc 3 §3.7 "reference designs use 0.95–1.05 as a study setting" |
| S-06 | frequency_min_hz / frequency_max_hz | 49.75 / 50.25 | SOURCED | Doc 3 §3.7 |
| S-06 | inverter_loading_limit_ratio | 1 | SOURCED | Doc 3 §3.7 |
| S-06 | line_current_limit_a | empty | EMPTY | Shows the "not evaluated" list on S-08 (manuscript 4.2.4: thermal limit is user-set) |
| S-06 | balance_tolerance_kw | empty | EMPTY | Same reason (D-54 K84) |
| S-04 PS | m_inv | 0.2 | AUTHOR | Same value as the demo-script M2 margin (D-70); confirm |
| S-04 PS | unit_count / redundancy | 2 / 0 | AUTHOR | Matches the two inverters of D2; confirm. **Guidance must say: do not Accept**, because accepting replaces INV1/INV2 with equal units (FR-09) and the rest of the example no longer matches D2. |
| S-04 PS | autonomy_h, η_dc, DoD | empty | EMPTY | No LoadProfile in D2, so storage would be null anyway |
| S-08 M2 | m_inv / m_line | 0.2 / 0.2 | AUTHOR | `docs/demo_script.md` step 5 (D-70); confirm |
| S-08 M2 | storage settings | empty | EMPTY | |
| S-09 M3a | parameter_paths | droop gains and ratings of INV1 and INV2 (`inverters/INVx/frequency_droop_hz_per_kw`, `voltage_droop_kv_per_kvar`, `rated_kva`) | AUTHOR | A selection, not a value; confirm |
| S-09 M3a | output_metrics | all six of Doc 3 §6.4 | AUTHOR | Selection; confirm |
| S-09 M3a | step_relative | — | NEEDS VALUE | Eq. 4.17 has no default; give a value and a reason, or leave empty |
| S-10 M3b | axis | LOAD_SCALE | AUTHOR | |
| S-10 M3b | range_min / range_max | 1.0 / 4.0 | AUTHOR | Proposed because it spans D2 (λ = 1), D2S (2.4) and D2H (4.0) of Doc 13 §4; confirm or replace |
| S-10 M3b | step_count | — | NEEDS VALUE | Keep it well under SWEEP_CAP; note D-67: LAMBDA_C per point costs about 0.38 s, so leave `point_metrics` without LAMBDA_C in the example |
| S-10 M3b | point_metrics / include_eigenvalues | ZETA_MIN / false | AUTHOR | Shows the stability trace without the LAMBDA_C cost; confirm |
| S-11 M3c | Scenarios | "D2 base" (no overrides); "D2S load × 2.4" (`loads/L1/p_kw` 60, `q_kvar` 24); "D2H load × 4.0" (100, 40) | SOURCED | Doc 13 §4 designs D2S and D2H; stored in the guided Project file |
| S-11 M3c | reference_scenario_id | D2 base | AUTHOR | |
| S-11 | N−1 check | (button, no values) | — | Works as today |
| S-12 M3d | axis_x | LOAD_SCALE, same range as M3b | AUTHOR | |
| S-12 M3d | axis_y | — | NEEDS VALUE | e.g. SCALE_FACTOR on `rated_kva` of both inverters; you choose the field and range |
| S-12 M3d | step counts | — | NEEDS VALUE | Product ≤ SWEEP_CAP; keep it small for speed |
| S-13 M4a | tau_in_s | empty | EMPTY | Demonstrates r_in "not evaluated" (as in the demo script, step 6) |
| S-13 M4a | damping_threshold_ratio | — | NEEDS VALUE | Optional; empty means no pass/fail on damping (manuscript 4.2.6). Recommended: leave EMPTY |
| S-14 M4b | disturbance (preset 1, default) | LOAD_STEP on L1, +2.5 kW, +1 kvar, start 1 s, permanent, simulation_end 4 s | SOURCED | Doc 13 §5 case DR-01. Check the permanent/duration reading against `validation` case DR-01 when it is ported |
| S-14 M4b | disturbance (preset 2) | INVERTER_OUTAGE INV2, start 1 s, end 5 s | SOURCED | Doc 13 §5 case TS-02 |
| S-14 M4b | disturbance (preset 3) | REFERENCE_STEP P_SETPOINT on INV1, +2 kW, start 1 s, end 4 s | SOURCED | Doc 13 §5 case DR-02 |
| S-14 M4b | settling (frequency_band_hz, voltage_band_kv, window_s) | — | NEEDS VALUE | Doc 13 does not give them in the app's form. Without them the class shows "not classified: settling criteria not given", which is honest but less instructive. Supply values with a reason, or leave empty |

S-14 shows the three presets as a choice ("Example disturbance: DR-01 load step / TS-02 inverter outage / DR-02 P* step"); choosing one refills the disturbance fields.

## 7. Guidance text per screen

Short, plain English (UI language), no result numbers (§3 rule 2), each with the manuscript section it paraphrases. Claude Code drafts them; **you approve the wording at EX-5**. Topics:

| Screen | What the text explains |
|---|---|
| S-03 Loads, S-05 Network | What D2 is (two droop inverters with different gains feeding one load) and where it comes from |
| S-04 PS | That PS is the *saran kapasitas awal*, ignores line losses, and why not to Accept here |
| S-06 Constraints | That limits are study settings, not standard values, and that empty limits are "not evaluated" |
| S-07 M1 | What to look at: common frequency, P sharing by droop gain, power-sharing advisory, ε_X |
| S-08 M2 | Verdict vs margins, the not-evaluated list, λ_c vs λ_s ("solution existence, not a stability limit") |
| S-09 to S-12 | What a sensitivity, a sweep, a scenario comparison and an envelope answer |
| S-13 M4a | Eigenvalues, damping, dominant mode, participation, and that r_in is not evaluated without τ_in |
| S-14 M4b | What each preset disturbance tests, that RoCoF is descriptive, and why there is no class without settling criteria |
| S-16 Report | That the report lists every run with hashes and that results are not yet validated against PSIM |

## 8. Run whole example (Could)

A button on S-02 Project overview, visible only in example mode: **"Run the whole example"**. It runs PS → M1 → M2 → M3a → M3b → M3c → M3d → M4a → M4b (preset 1) in order, each with the screen's current values, then opens the Report.
- It shows a progress list (step, status word + icon) and stops at the first result that is not FEASIBLE (INFEASIBLE, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INPUT_INVALID or UNAVAILABLE), naming that step.
- It skips steps whose required fields are NEEDS VALUE and lists them as "skipped: not set in the example".
- Each call is the normal synchronous request (ADR-007), with TIME_BUDGET unchanged. No parallel calls.
- **Open decision EX-D2:** build it (Could) or not. Recommended: build it last, only if time allows.

## 9. Requirements (proposed Doc 12 X9; FR IDs from FR-99, check they are free)

| FR | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-99 | S-01 offers "Open guided example (D2)", which opens `guided-d2.mgproj.json` as a new unsaved copy and enters example mode; the header shows "Example mode" and "Leave example mode". | Should | E2E: open, header tag visible; leave, tag gone, Project kept. |
| FR-100 | In example mode every screen with an analysis form prefills from `guided-d2.example.json` with the precedence of §3 rule 5; each prefilled field shows an "Example" tag naming its source; NEEDS VALUE fields stay empty with the note. | Should | Client: precedence helper; every settings entry has a source. **E2E:** on the Fake default profile, S-04, S-07, S-08, S-09–S-14 each show a result after pressing Run with no typing (except for fields you left NEEDS VALUE). |
| FR-101 | Example settings never reach the canonical snapshot, the Project file or a RunRecord beyond the parameters actually sent; outside example mode no screen prefills. | Should | Client: the snapshot hash of the guided Project equals the hash of the same design entered by hand; E2E: a normal new Project shows empty forms. |
| FR-102 | Each example screen shows the info banner, a "What this step shows" disclosure, "Reset to example values" and, after a run, a "Next" link in pipeline order; the text contains no result numbers. | Should | Client: guidance strings contain no digits except section and equation numbers in the source line. E2E: the Next link leads through the pipeline to S-16. |
| FR-103 | S-14 offers the three example disturbances DR-01, TS-02, DR-02 as presets. | Should | E2E: choosing TS-02 fills INVERTER_OUTAGE INV2 and Run gives a result. |
| FR-104 | (Could) "Run the whole example" on S-02 per §8. | Could | E2E on Fake: all steps run in order and the Report opens; with a forced failure (profile `m2-infeasible`) it stops at M2 and names it. |

## 10. Work packages

Same workflow as the UX and SLD rounds: plan first and list the decisions; then implement; then `tools\check.py`, `tools\test.py`, `tools\build_frontend.py`, E2E on Chromium and Chrome, before/after screenshots in `docs/design/ex-<step>-<date>/`, a review note, one gate-log row, commit and push to `tahap-1.5`; stop for confirmation.

| WP | Content |
|---|---|
| EX-0 | Docs only: Doc 12 X9 + FR-99 – FR-104, Doc 9 D-92 (decisions EX-D1, EX-D2, every AUTHOR value confirmed or rejected, every NEEDS VALUE given or left empty), Doc 7 (S-01 action, header tag, banner, guidance, settings-file schema), Doc 11 rows. **The user confirms the §6 table before EX-1.** |
| EX-1 | The two static files with values exactly as confirmed; type guard; store slice `example`; S-01 action; header tag and leave button; client tests (guard, hash equality FR-101). |
| EX-2 | Prefill helper, "Example" tags, NEEDS VALUE note and reset on S-04, S-06 (read-only notice: constraints come from the Project file), S-08. |
| EX-3 | Prefill on S-09, S-10, S-11, S-12. |
| EX-4 | Prefill and the three presets on S-13, S-14. |
| EX-5 | Guidance text (user approves wording), Next links, Report line "Produced in example mode from the guided example D2" while example mode is on. |
| EX-6 | (Could) Run whole example, if EX-D2 = build. |
| EX-7 | Regression on Chromium and Chrome; a REAL API test that runs the guided example end to end (M1 on the guided Project gives the D2 hand-check values of D-64, and no step returns INPUT_INVALID except NEEDS VALUE ones); update `docs/demo_script.md` to start from the guided example. |

## 11. Tests (summary)

- Client: the settings type guard (valid, unknown keys, bad value dropped, missing file); `initialValue` precedence; all settings entries have a source; guidance strings free of result numbers; snapshot-hash equality (FR-101).
- E2E (Fake): the full click-through of FR-100 and FR-102; leave mode; normal Project unaffected; presets; FAKE marking present in example mode; 200 % zoom and the external-request guard over the new UI.
- API (REAL): the guided example end to end (EX-7).
- Unchanged: all existing tests, including the P2 example tests and the FR-14 diagram test.

## 12. Open decisions for the user (answer at EX-0)

| # | Decision | Recommended |
|---|---|---|
| EX-D1 | Guided D2 only, or D1 as well | D2 only |
| EX-D2 | Build "Run whole example" (Could) | Yes, last, if time allows |
| EX-D3 | Confirm each AUTHOR value in §6 (PS m_inv and n/r, M2 margins, M3a selection, M3b axis and range, M3c reference, M3d x axis) | Confirm as proposed, or replace |
| EX-D4 | Give or leave empty each NEEDS VALUE (M3a step, M3b and M3d step counts, M3d y axis, M4a damping threshold, M4b settling) | Give values with a one-line reason for M3a step, step counts and M3d y axis; leave the damping threshold empty; decide on settling after one REAL run |
| EX-D5 | Guidance text in English (UI language) or Indonesian | English, like every UI label (D-72; glossary toggletips are Indonesian per FR-91) |
