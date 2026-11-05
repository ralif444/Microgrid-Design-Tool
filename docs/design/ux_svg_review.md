# UX-11: chart download as SVG (2026-11-04)

Work package UX-11 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X7, FR-92; Doc 9 D-90).

## Screenshots
Location: `ux-svg-2026-11-04/{before,after}/`. The example is D2 on the FAKE engine, default profile, after M1. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `{1440x900,1280x720}/s07-figure` | S-07 "Inverter loading"; after: "Download SVG" beside "Show data" |
| `after/inverter-loading.svg` | The downloaded file |
| `after/svg-rendered` | That file rendered on its own page: the chart with the caption block (title; analysis, RunRecord id, snapshot and result hash; engine kind and version, run date; the FAKE line) |

## Changes
- **"Download SVG" on every chart with a RunRecord.**
  - `ChartFrame` gains a button "Download SVG: <title>" beside "Show data", hidden in print.
  - It uses the shared exporter `charts/exportSvg.ts` that the single-line diagram already uses (FR-97): computed styles inlined, no class names or CSS variables, and the X7 caption block of `captionLines`, with "FAKE ENGINE — not an engine result" for a FAKE run.
  - File name: the title in lower case with dashes, then the RunRecord id (`inverter-loading-<id>.svg`).
  - Covers S-07 – S-14 and the S-16 report charts, since they all draw through `ChartFrame`. Charts without a RunRecord (the gallery) get no button.
- **Font size at A4 text width.** The charts are 560 units wide with 12 px text. Placed at a 16 cm A4 text width (about 454 pt), 12 px becomes about 9.7 pt, so the ≥ 8 pt rule holds.
- FR-92 left the seam-6 exception list, which is now empty of UX-round ids.

## Critique
1. **Font outside the app.** The file names IBM Plex Sans, as drawn. A computer without that font falls back to a system sans (as in `svg-rendered`). Embedding the font is not asked for.
2. **Wide participation grids.** `GridChart` grows with the number of modes (104 + 64 per mode). From 10 modes on (D2 has 5 states), 12 px text would drop below 8 pt at A4 width.
3. **A crosshair that is showing is exported too.** The SVG is taken as drawn. If the user has moved the crosshair, its line is in the file; pressing Escape first hides it.
4. **The run date is the UTC date of `created_at`**, the same as on the diagram download.

## Tests
- E2E: `test_fr_92_chart_svg_download_carries_the_caption` in `tests/e2e/test_ux_round.py`. On S-07 after M1, "Download SVG: Inverter loading" saves `inverter-loading-<id>.svg`. The file is checked to:
  - be well-formed and 560 wide
  - contain the title, the RunRecord id, "Engine FAKE" and the FAKE caption
  - have no class names or CSS variables, and 12 px text
- Client: the caption block is already covered by `exportSvg.test.ts` (FR-97).
- Existing E2E tests unchanged; the diagram download test (FR-97) still passes.
- Results:
  - check passed
  - engine 53, Python 441, client 82
  - E2E 50 on Chromium and 50 on Chrome
