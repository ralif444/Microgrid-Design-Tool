# UX-2: S-07 power flow, KPI strip, charts and Inspector (2026-11-03)

Work package UX-2 of `docs/UX_ANALYTICS_GUIDELINES.md` (Doc 12 X2, X3, X5; Doc 9 D-72, D-74). Presentation only: no payload, contract, API or Engine Port change. Existing accessible names, roles and test ids are unchanged. The browser only selects and rounds stored values.

## Screenshots
Location: `ux-s07-2026-11-03/{before,after}/{1440x900,1280x720}/`. "Before" is commit 39cb9e1 (UX-1). All runs use the Fake Engine on example D2.
- `m1-top`: S-07 after Run M1, first screen
- `m1-full`: S-07 full page
- `m1-inspector` (after only): Inspector on INV1 after M2
- `sweep-chart`: S-10 after a 5-point sweep (palette and feasibility markers)
- `report-full`: S-16

## Changes
- **Palette (D-74 K157):** `docs/VISUAL_DESIGN_GUIDELINES.md` is now in the repository. Its §9 replaces the UX-1 colours: teal, navy, purple 60, magenta 60, yellow 50 (lines only). Feasibility markers: ● feasible, ✕ infeasible, – unavailable (drawn on the x axis).
- **X2 KPI strip (FR-87):** nine tiles under the Status banner: system frequency, lowest and highest bus voltage (with bus), highest inverter loading (with inverter), total load P and Q, total losses, iterations, and ε_X ("threshold not yet calibrated"). An empty list gives "—", never 0. A FAKE run adds "FAKE engine: placeholder values, not engine results."
- **X3 charts (FR-88):** each S-07 table gets its chart: bus voltage profile (dot chart on a nice domain), inverter loading, inverter P and Q (inside the power sharing advice), line loading. Limit lines appear only for limits set on S-06. Otherwise the caption says "No … set: not evaluated." `BarChart` now takes grouped series and values on either side of zero (K158).
- **X5 Inspector (FR-90):** a side panel, not a modal. It opens from the id cell of Bus voltages, Inverter outputs and Line flows. The cell is a button named "Inspect <id>" and shows the id as its text. The panel shows the inputs, the latest M1 values, the M2 constraints on the element, and the sizing-check row. Each section is hidden when no run matches the current design (FR-93). "Edit in table" goes to `/network/?focus=<id>`. Focus moves to the heading. Escape and "Close inspector" both close the panel and return focus to the trigger. S-05 and the diagram follow in UX-4 (K159).

## Critique
1. **Fake values are flat zeros.** The loading and P/Q bars have no length, and the KPI tiles read 0. The empty state looks like a bug, but this only happens on the Fake Engine.
2. **Inspector input labels are field keys** (`rated_kva`, `tau_p_s`) rather than the S-05 column headers with units. The S-05 column definitions live in the Network page. Reusing them belongs with UX-4, when S-05 opens the panel.
3. **S-07 is long.** It shows four charts plus their tables. A two-column layout at 1440 px would reduce scrolling, but that is a layout decision for the guideline owner.
4. **Sweep table Status wraps "FEASIBL E" at 1440 px.** This predates UX-2 (also in the "before" shot) and is left for UX-5, which restyles S-10.

## Tests
- Client: `components/kpi.test.ts` covers the selectors, the element named per tile, and "missing, never zero".
- E2E: `tests/e2e/test_ux_round.py`:
  - FR-87 and FR-88: the KPI strip with its FAKE note, the four "Show data" buttons, and the dot chart name.
  - FR-90: the panel opens from "Inspect B1", focus lands on its heading, there is no M2 section before M2 runs, the "Edit in table" href is correct, Escape returns focus to the trigger. After M2, INV1 shows its sizing check and "Close inspector" closes the panel.
- Results:
  - check passed
  - engine 53, Python 441, client 45
  - E2E 34 on Chromium and 34 on Chrome
  - The FR-90 test was extended after the full runs and was re-run alone on both browsers: 4 passed each.
