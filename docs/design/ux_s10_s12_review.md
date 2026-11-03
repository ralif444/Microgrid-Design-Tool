# UX-7: S-10 and S-12 restyle, KPI strips, sweep chart and status grid (2026-11-03)

Work package UX-7 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X2 FR-87, X3 FR-88, X4 FR-89; Doc 9 D-86).

## Screenshots
Location: `ux-s10-s12-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 on the FAKE engine. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `s10-blocked` | Before M1: the blocked note, Run disabled |
| `s10-not-run` | After M1: the settings box and "No sweep run yet." |
| `s10-normal` | Sweep of `inverters/INV1/rated_kva` 5–15 kVA, 5 points: KPI strip, chart, points table |
| `after/s10-crosshair` | The chart focused, ArrowRight pressed: crosshair at 7.5 kVA with its readout |
| `s12-not-run` | After M1: the two axis boxes and "No envelope run yet." |
| `s12-normal` | Envelope λ 0.5–1.5 (4 points) × rated kVA 5–15 (3 points): KPI strip, status grid |
| `after/s12-readout` | A grid cell focused after ArrowRight, ArrowDown: the readout names the point, its Status and limiting constraint |

## Changes
- **Carbon restyle of S-10 and S-12.** It follows S-13 and S-14:
  - page head with the M1 freshness badge
  - the settings form in a sunken box; the axis fields one per row; on S-12 each axis in its own box
  - Run as the primary button, Toast for errors, EmptyState for "not run yet"
  - Labels, ids, `first-infeasible`, `feasible-fraction`, the tables "Sweep points" and "Envelope grid" are unchanged.
  - The page styles of S-10 to S-14 now share `components/Further.module.css` (the S-13 and S-14 copies are removed).
- **KPI strips.** Counts and payload values only:
  - "Sweep key figures": points, first infeasible value ("none in range" when null), points per Status
  - "Envelope key figures": feasible fraction (ratio, as in the payload), points, points per Status
- **Sweep chart.**
  - The metric picker lists the six base key metrics, plus λ_c, ζ_min, Re λ_dom, r_τ and κ only when a point carries them (`point_metrics`). ζ_min is the "ζ_min trace" of guideline §5.
  - Crosshair on, as UX-6 (D-85 K203).
  - A dashed vertical mark at `first_infeasible_value` when there is one.
  - The points table moves to `DataTable`; it shows the same metric columns as the picker.
- **Status grid "Status per point".** The existing "Envelope grid" table becomes the figure's body:
  - every cell shows an icon and a word; the tint only repeats the word
  - one tab stop; arrow keys move between cells; focus or hover shows the point, its Status and limiting constraint in a readout under the grid
  - "Show data" lists x, y, Status and limiting constraint for every point.

## Critique
1. **The Fake Engine returns only FEASIBLE points with flat metrics.** The infeasible and other-Status cells, the first-infeasible mark and the gaps are not seen on S-10 or S-12; the client tests cover the counts.
2. **A wide grid scrolls inside its figure.** With the D2 axis names the row header is long and four columns already reach the frame edge. Arrow keys scroll the focused cell into view.
3. **The status grid is an HTML table, not an SVG `GridChart`.** It has to stay the "Envelope grid" table for the existing test, and a table gives screen readers row and column headers for free.
4. **No root locus.** Points can carry `eigenvalues` (`include_eigenvalues`), but S-10 has no control to ask for them; the ζ_min trace covers the guideline line.
5. **The "Feasible fraction … %" sentence stays.** It multiplies by 100 in the browser (code from WP 1.5.5); an existing E2E reads it, so it is left as is and the KPI tile shows the payload ratio.

## Tests
- Client: `components/kpi.m3.test.ts`.
  - points per Status only for Statuses that occur; a null first infeasible value stays null
  - the feasible fraction is read as given
- E2E: `test_fr_87_fr_88_fr_89_sweep_and_envelope` in `tests/e2e/test_ux_round.py`, default profile:
  - S-10: the KPI strip with "Points FEASIBLE", "none in range" and the FAKE note; the Sweep figure has the FAKE caption; focus shows "inverters/INV1/rated_kva 5 kVA" and a frequency in Hz; End moves to 15 kVA.
  - S-12: the KPI strip; four cells, each "feasible"; one tab stop; focus shows the point with "limiting constraint: none"; ArrowRight moves to λ 1.5; "Show data" has four rows.
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 79
  - E2E 46 on Chromium and 46 on Chrome
