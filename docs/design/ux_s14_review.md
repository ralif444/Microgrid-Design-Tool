# UX-6: S-14 restyle, KPI strip, time responses with crosshair (2026-11-03)

Work package UX-6 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X2 FR-87, X3 FR-88, X4 FR-89; Doc 9 D-85).

## Screenshots
Location: `ux-s14-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 on the FAKE engine. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `s14-blocked` | Before M1: the blocked note, Run disabled |
| `s14-not-run` | After M1, before M4b: the settings box and "Not run yet." |
| `s14-normal` | After M4b (load step 1 kW on L1 at 0.1 s, end 1 s, settling 0.1 Hz, 0.01 kV, 0.5 s): KPI strip, class, indicators, four time responses |
| `after/s14-crosshair` | The frequency chart focused, End pressed: crosshair at t = 1 s with its readout |
| `after/gallery-crosshair` | `/dev/components`: the crosshair on two series with a gap, the start mark and the final window, on placeholder numbers. The error toast in the corner is the gallery's own Toast demo. |

## Changes
- **Carbon restyle of S-14.** It follows S-13:
  - page head with the M1 freshness badge
  - the form "Transient settings" in a sunken box, one field per row, the settling criteria in their own box
  - Run as the primary button, Toast for errors, EmptyState "Not run yet."
  - Field ids, labels, the "Class:" heading, `transient-class` and the indicator panel are unchanged.
- **KPI strip "Transient key figures".** `m4bKpis` reads from the payload only:
  - transient class with its icon, or "not classified" with `class_reason`
  - settled (yes / no, or "not judged: no settling criteria")
  - largest RoCoF, marked descriptive
  - A payload word in a tile may now break after "_" (`<wbr>`), so RECOVERED_STABLE fits; its text is unchanged.
- **Time responses with crosshair (FR-89).** The four charts keep their names. `LineChart` gained three opt-in props:
  - `crosshair`: the chart is focusable; ←/→ move, Home/End jump, Escape hides; the pointer snaps to the nearest real sample. A readout lists t and every series there with its unit, "—" for a missing value. Hidden in print.
  - `vmarks`: a dashed vertical line at the disturbance start, read from the RunRecord parameters `disturbance.start_time_s`.
  - `xband`: the final window of the settling check, shaded over [last sample − window, last sample]. Drawing geometry only; no number is shown (user choice, as D-83 K196).
- **No amplitude envelope.** The frequency and voltage bands around the final value are written in the chart note only. The payload has no final value, and drawing final ± band would be arithmetic in the browser (guideline §1 rule 1; user choice).
- **"Show data" replaces the old "Data table".** The old table had only frequency and bus voltages; every chart's "Show data" lists its own series.

## Critique
1. **The Fake Engine returns two samples with flat values.** The crosshair has only t = 0 and t = 1 to visit on S-14; the gallery shows it on nine samples with a gap.
2. **The readout box can cover the curve** near the top of the plot. It sits at the top edge and flips side at mid-width; with real data it may hide a peak while it is shown.
3. **The note repeats under all four charts.** Each figure must stand on its own (it can be exported and printed alone), so the repetition is kept.
4. **Crosshair is opt-in.** Only S-14 and the gallery use it; S-10 follows in UX-7 (user choice). Other line charts get no extra tab stop.
5. **The final-window band uses the last sample, not `simulation_end_s`.** They are the same on the Fake Engine; if the engine stops earlier, the band follows the data.

## Tests
- Client: `components/kpi.m4b.test.ts`.
  - class word, icon, settled and RoCoF as given
  - null class: "not classified" with the reason; null settled stays null
- E2E: `test_fr_87_fr_88_fr_89_transient_kpis_and_crosshair` in `tests/e2e/test_ux_round.py`, default profile, with settling criteria:
  - The KPI strip shows RECOVERED_STABLE, the RoCoF tile and the FAKE note.
  - The frequency figure names the start time and the final window and carries the FAKE caption.
  - Focus shows "t 0 s" and a value in Hz; ArrowRight moves to "t 1 s", Home back to "t 0 s"; Escape hides the readout.
- FR-89 left the seam-6 exceptions (FR-91 and FR-92 remain).
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 77
  - E2E 45 on Chromium and 45 on Chrome
