# Plan: audit 2026-11-14 improvements

Status: ready-for-agent (variant A chosen 2026-11-14)

Basis: `docs/ui-ux-audit-2026-11-14.md` (findings D-1 to D-33, out-of-scope O-1 to O-9, decisions §12) and the mockup `docs/design/redesign-2026-11-14/engineering-document-mockup.html`. Branch: a new branch `design/audit-improvements` from `design/ui-redesign` (PR #9 stays as it is). One commit per phase; full E2E after each phase.

## Rules for every phase
- Engine, Engine Port, equations and the Project file format do not change. Backend changes are limited to user-facing message text (P5) and are listed.
- No value is invented. Labels, units and limits come from `elementFields.ts`, the Project, the run payload or `/api/meta`.
- No information loss: anything removed from a screen is shown that it still exists elsewhere (table, "Show data", Run history, export), checked per removal.
- English only (decision 6): Indonesian toggletips leave the screens; `glossary.ts` stays for later.
- Each phase ends with vitest, `tools/check.py`, full E2E, and a live browser pass in light and dark at 1024 and 1440 px, with before/after screenshots kept in `docs/design/redesign-2026-11-14/`.

## Phase 1: Numbers (D-1, D-2, D-3)
- One display function for results: `fixed(v, unit)`. Add missing units to its table: kV 4, h 2, kWh 2, s 3, Hz/s 3, 1/s 2, count 0, ratio stays 3. Loading stays a ratio (the inputs and the manuscript use a ratio).
- Route every displayed result through it: KPI strip, Details lists, chart value labels and axes, Sizing advice table, study tables (`Further.tsx` `fmt`), M4a/M4b, Battery.
- Values below the display resolution: "< 0.001" (participation factors, grids), with the exact value in the tooltip and "Show data".
- Full precision stays in "Show data", CSV/JSON export, Run history.
- Test: unit tests for `fixed` per unit and the "<" rule; E2E text assertions updated where they pinned 6-digit values.

## Phase 2: Words instead of codes (D-4, D-5, D-6, D-24, D-25, D-26, O-7)
- `paramLabel(path)`: "INV1, Frequency droop (Hz/kW)" from `elementFields.ts`; pickers grouped by element (`<optgroup>`), unit shown; used by M3a, M3b, M3c, M3d axis titles and table headers. Axis kinds in words ("One parameter", "Scale factor over …", "Load scale λ").
- Outcome words: banner headline in words; the status code moves to Details. The "FEASIBLE" tag is dropped from analyses that make no constraint check (M1, M4a, M4b) and replaced by their own result word (Solved, Stable, Simulated).
- Advice states in words (Proposed, Accepted, Skipped); "INPUT_INVALID" becomes "Input needs fixing"; field paths become labels.
- Remove internal references from screens ("Doc …", "KONFLIK", "supervisor") in Scenarios and Battery; Cable sizing is out of scope and left as is.
- O-7 backend text: the parameter-path message names the right concept per analysis; "check(s)" becomes correct singular/plural. Golden files and tests are updated with the change.
- Studies tabs: plain name first, code second ("Sensitivity", with "M3a" as a smaller secondary label); one helper in `tests/e2e/flows.py` keeps the 123 locator uses working.

## Phase 3: Check traceability (D-7, D-8, D-9, D-18, D-19, D-21, D-22, O-5)
- M1 tables gain a Limit column from the Project limits and a Status column taken from the current M2 when there is one ("Run the constraint check" otherwise). No margin is computed in the browser.
- Line-loading chart draws each line's own limit (per-line limit first, Project limit otherwise, the same rule as the diagram).
- Element links: inside the workspace, every element id selects the element in the inspector; on standalone pages it opens the workspace with that element selected.
- Near-limit threshold shown under the margin table ("near limit below 0.05"); while `/api/meta` is loading the Status column says "checking" instead of "Pass" (O-5).
- Workspace M2 settings stay open while the user is editing; the verdict line restates the margins used.
- Diagram legend gains Pass, Near limit, Violated, Limiting and the loading bar; Limiting gets its own icon; one shared violated count for strip, banner and KPI.
- Results drawer gets a bounded, resizable height with internal scroll, so diagram and table are on screen together.

## Phase 4: Model inputs (D-12 to D-17, D-20, O-1, O-2, O-4, O-8)
- Project: inline errors on kV and Hz (aria-invalid, message by the field).
- O-4: validation failure is its own state: "Could not check the design: …" with Retry, never "no problems".
- Loads: Q and PF become two columns with one unit each; one sign-convention line under the table and in the inspector (taken from Doc 03 if it states one; otherwise flagged to you, not invented).
- Sizing: Accept and Skip explained in one line each; both disabled on stale advice with a re-run hint.
- O-1: "Add N inverter drafts" is recorded in the store state of the accepted advice so a second visit shows "N drafts added" instead of the button; a new Accept clears it. (Store only; the Project file is unchanged: on reload the button returns, with the count of drafts already present shown next to it.)
- O-8: Constraint check shows the m_inv used by the accepted Sizing advice next to its own m_inv field, with "Use 0.20 from sizing advice". The two stay separate inputs; no model change.
- O-2: LoadProfile editor on the Loads screen: a 24-row hour × scale table bound to the existing `load_profile` in the Project; this unblocks storage advice and Battery. Validation messages come from the backend as today.

## Phase 5: Studies (D-10, D-11, D-23, D-27, D-28, D-30, O-3)
- New Studies overview (`/studies/`, the Studies tab lands here): one row per study (M3a–M4b, Battery), the question it answers, last run, Current / Out of date / Not run, Open.
- Per-study state in the Studies sub-tabs (the done/stale marks the Model tabs already have).
- O-3: an out-of-date result is still shown, greyed under an "Out of date: the design changed after this run. Re-run." band, instead of "Not run yet." (latest run of that type, not only the current snapshot).
- Run buttons disabled until the form is complete, with the missing item named next to the button.
- Study layout: inputs left ("Given"), result right, on desktop widths.
- Chart series: beyond five series, colour and dash combine so no two lines share both; legend words stay unique.
- Run history: DataTable, local time, row-named buttons ("View run 9932761f"), detail opens next to the row.

## Phase 6: Engineering-document identity (§8; needs your variant choice)
- Result sheet component: verdict line, key figures row, reference table, basis block, title block (variant A) or header strip and numbered clauses (variant B).
- Applied to Power flow, Constraint check, Small-signal, Transient, Sizing advice, Battery and the studies' result panes; the Report prints the same sheets.
- Removed as duplicates, after checking each is fully shown elsewhere: the normalised-margin bar chart (same numbers as the table bars), the repeated "Validity indicators" sentence on each result (one footnote per sheet), the KPI tiles (become the key figures row). Kept: voltage profile, loading, sharing, eigenvalue plane, time series, participation grid.
- Generic-look fixes of §8: sentence-case labels in Plex Sans Condensed, middle-dot strings into the title block, empty sheets instead of one-line empty states, chart colours from the neutral and accent scale.

## Phase 7: Retire duplicate step pages (decision 4)
- Project and Constraints fold into the workspace: the "System" element and "Design limits" in the element tree already edit the same fields. `/project/` and `/constraints/` become redirects to the workspace with that item selected.
- Loads and Network stay as table views (bulk entry is faster in a table), reached from the workspace as "Table view".
- E2E: 15 uses move to the workspace helpers. Doc 14 gets a KONFLIK (user-decided) row; thesis notes record it.

## Order and delegation
1 → 2 → 3 → 4 → 5 → 6 → 7, one at a time on one branch (phases touch shared files, so no parallel writers). Mechanical work (label mapping, E2E locator moves, Run history table) goes to Sonnet subagents with a brief and acceptance checks; design-heavy work (sheets, traceability, Studies overview) I do. Every subagent result is checked by running the tests and reading the diff before commit.

## Not in this plan
- Cable sizing (decision 8).
- Indonesian strings (decision 6).
- "1.500" vs "1,500" parsing (D-33/O-6): with English only, "1.500" = 1.5 is correct; revisit when Indonesian ships.
