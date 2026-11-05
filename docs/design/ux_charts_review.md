# UX-1: latest result per screen (X0) and chart foundation (X1) (2026-11-03)

Work package UX-1 of `docs/UX_ANALYTICS_GUIDELINES.md` (Doc 12 X0, X1; Doc 9 D-72, D-73). Presentation only: no payload, contract, API or Engine Port change. Existing accessible names, roles and test ids are unchanged; chart names keep their old text and add the point count.

## Screenshots
Location: `ux-charts-2026-11-03/{before,after}/{1440x900,1280x720}/`, plus `report-print-718.png` (print media at the A4 printable width). "Before" is commit 2a4147a (UX-0). All runs use the Fake Engine on example D2.
- `m1-after-return`: S-07 after Run M1, then Loads, then back
- `m1-after-edit`: S-07 after an inverter rating edit
- `report-full`, `report-show-data` (after only): S-16 bar chart, and its "Show data" table
- `sweep-chart`: S-10 after a 5-point sweep
- `transient-charts`: S-14 after a load step
- `gallery-charts` (after only): `/dev/components` with the normal, gaps, markers, FAKE, empty and bar states

There is no loading state of its own: a chart appears with its result. The error and missing cases are the gap, "—" and "No data" states in the gallery.

## Changes
- **X0 (FR-93):** S-07, S-08 and S-09 to S-14 show the latest RunRecord of their type on the current design. The record comes from the store; the screens no longer keep a local copy of the last response. Leaving a screen no longer loses its result. After a design edit, S-07 and S-08 show "No result on this screen. The design changed after the last run." An M3c hash also covers the scenarios (Doc 3 §6), so M3c matches on its M1 reference instead (D-73 K153). PS is unchanged, because its advice is already stored.
- **X1 (FR-86):** new folder `frontend/components/charts/`:
  - `scale.ts`: linear scale, nice domain and ticks, nearest sample, and null splitting. The logic is ported from the prototype and rewritten.
  - `palette.ts`: six Carbon categorical colours, none of them a status colour, each at least 3:1 on white and on layer-02. Also dash patterns and marker shapes.
  - `ChartFrame`: Carbon tile with title, plot, legend (dash or marker word, so never colour alone), and a caption with analysis, RunRecord id and engine kind. A FAKE run reads "FAKE engine: placeholder, not an engine result". "Show data" (`aria-expanded`) lists the plotted values in a `DataTable`.
  - `LineChart`: a null is a gap and is never interpolated; optional markers; "No data" when empty.
  - `BarChart`: horizontal bars from zero; a null has no bar and the label "—"; optional reference lines.
- **Old charts replaced:** `VoltageChart` (S-16), `SweepChart` (S-10) and `TimeChart` (S-14).
  - On the sweep, marker shape carries the Status (circle feasible, cross infeasible). Points without a value leave a gap and are named in the note.
  - The Report's dashed 1.0 p.u. line is kept from the old chart; it marks nominal voltage, not a limit.

## Critique
1. **Flat Fake series fill the plot with padding** (for example, bus voltage −0.5 to 1.5 kV), because a constant series gets ±1. Real Engine results vary, so this matters only on the Fake Engine.
2. **S-14 still has its "Data table" details under the charts.** Each chart now has its own "Show data", so that block is a duplicate. It is left for UX-6, which restyles S-14.
3. **The bar chart starts at zero, so voltages near 1 p.u. look equal.** The S-07 voltage profile in UX-2 (guideline §5) is the place for a zoomed view.
4. **Not built yet:** the crosshair (FR-89), `ScatterChart` and `GridChart`. They are deferred to the work packages that first use them (D-73 K154).

## Tests
- Client: `components/charts/scale.test.ts` covers scale, ticks, nearest sample, null splitting, and that no series colour is a status colour. `store/reducer.test.ts` covers `latestRun`, including the M3c case.
- E2E: `tests/e2e/test_ux_round.py` covers:
  - FR-93: the result survives leaving S-07 and is hidden after a design edit.
  - FR-86: the Report chart shows the FAKE caption, and its "Show data" table has as many rows as the "Bus voltages" table.
- The first full run had 2 failures: the M3c comparison table was hidden, because of the M3c hash rule (K153). After the fix:
  - check passed
  - engine 53, Python 441 and client 42 passed
  - E2E: 32 on Chromium and 32 on Chrome
