# UX-5: S-13 restyle, KPI strip, eigenvalue plot and participation grid (2026-11-03)

Work package UX-5 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X2 FR-87, X3 FR-88; Doc 9 D-84).

## Screenshots
Location: `ux-s13-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 on the FAKE engine. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `s13-blocked` | Before M1: the blocked note, Run disabled |
| `s13-not-run` | After M1, before M4a: the settings box and "Not run yet." |
| `s13-normal` | After M4a with threshold 0.05: KPI strip, class, indicators, eigenvalue plane, participation text |
| `after/gallery-charts` | `/dev/components`: the point plane with a highlighted point and the grid with row groups, on placeholder numbers, because the Fake Engine returns no eigenvalues. The error toast in the corner is the gallery's own Toast demo. |

## Changes
- **Carbon restyle of S-13.** It follows S-07 and S-08:
  - page head with the M1 freshness badge
  - the form "Small-signal settings" in a sunken box, Run as the primary button
  - Toast for errors
  - tables on `DataTable`
  - Field ids, labels, the "Class:" heading, `stability-class` and the indicator panel are unchanged.
- **KPI strip "Small-signal key figures".** `m4aKpis` reads or picks from the payload only:
  - stability class, with its icon
  - lowest damping ζ_min ("no oscillatory mode" when null)
  - damping check, only when a threshold was sent ("not judged: no oscillatory mode" when null)
  - dominant mode frequency, with eigenvalue index and elements
  - outside definition
- **"Eigenvalues in the complex plane".** Points only (`line={false}`); the dominant mode is a filled diamond, the others hollow circles. Hovering a point gives its ζ and f (new `LineSeries.title`). Axis unit 1/s, as in the contract.
- **"Participation factors (Eq. 4.21), states × modes"** (new `GridChart`):
  - one row per state, grouped per inverter (δ, P_f, Q_f), by `participationRows`
  - one column per mode, the dominant ones marked "dom."
  - every cell prints its value; the shade only repeats it
  - "Show data" replaces the old participation table.

## Critique
1. **The Fake Engine returns no eigenvalues.** On S-13 the plane shows "No data" and the participation grid is replaced by "Participation factors not available". The real look is seen in the gallery only.
2. **The Im unit differs from the guideline.** Guideline §5 says Im in rad/s; the plot keeps 1/s, the unit Doc 3 §6.8 gives for `eigenvalues`. Changing it needs a contract entry (G6).
3. **No damping-threshold ray**, as guideline §5 says: it would need geometry from Eq. 4.20 in the browser. The chart note says so.
4. **The facts list repeats the KPI strip.** It was kept to change no existing text in this package; it can go in a later clean-up.
5. **Grid width is fixed per cell.** With many modes the grid scrolls inside its figure, not the page.

## Tests
- Client: `components/participation.test.ts`.
  - state names parsed and grouped per inverter; unknown names under "other"
  - `m4aKpis`: damping check only with a threshold; null ζ and no dominant mode
- E2E: `test_fr_87_fr_88_small_signal_kpis_and_plot` in `tests/e2e/test_ux_round.py`, default profile:
  - The KPI strip shows STABLE, the damping check with "no oscillatory mode" and the FAKE note.
  - The plane is named with 0 points and shows "No data"; the figure carries the FAKE caption.
  - "Participation factors not available" and the `stability-class` text are shown.
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 75
  - E2E 44 on Chromium and 44 on Chrome
