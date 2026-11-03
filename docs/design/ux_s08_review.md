# UX-3: S-08 KPI strip, margin chart and loadability axis (2026-11-03)

Work package UX-3 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X2 FR-87, X3 FR-88; Doc 9 D-83). It resumes the UX round after the SLD round (Doc 10 §4.1).

## Screenshots
Location: `ux-s08-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 after M1 and M2 on the FAKE engine. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `s08-feasible` | Default profile: verdict FEASIBLE, 0 violated, 12 not evaluated (no limits set) |
| `s08-infeasible` | `m2-infeasible` profile: 2 violated constraints, the margin chart with the "Violated (margin < 0)" side |
| `after/gallery-charts` | `/dev/components`: the diverging bars and the loadability axis with placeholder λ values, because the Fake Engine returns λ = null. The error toast in the corner is the gallery's own Toast demo. |

## Changes
- **KPI strip "Constraint check key figures".** It sits under the StatusBanner. `m2Kpis` reads, picks or counts from the payload only:
  - verdict, with its icon and the word
  - violated constraints: count of `margin < 0`
  - tightest constraint: min `normalised_margin`, with the kind and element
  - not evaluated: count
  - λ_c and λ_s, each with its resolution
  - FAKE note when the run is FAKE
  - A `Kpi` value may now be a payload word with an icon (the verdict).
- **Margin chart "Normalised margin per constraint".** Horizontal bars of `normalised_margin`, sorted tightest first, with a zero line. The negative side is shaded and named "Violated (margin < 0)". Items without a limit are not drawn; the note points to the Not-evaluated list. `BarChart` gained `negative` and `labelWidth`.
- **Loadability axis "Loadability along the load scale λ"** (new `LoadabilityAxis`):
  - Markers λ_c (circle, solid), λ_s (square, dashed) and λ_ub (triangle, dotted), each labelled "name = value".
  - The bisection bracket `resolution` is a band above λ_c and λ_s. This is the user's choice of 2026-11-03, following D-51 K44. The band end is geometry only; no number is shown or derived.
  - A null λ is not drawn: it is listed under "Not available" and as "—" in "Show data". Stop reason in the caption.
- **Charts on S-08 only.** They appear through `M2Results` `charts`; the report's section 3 stays without them until UX-9.
- **`BarChart` fix for every chart with negative bars.** The plot now leaves 36 units left of the axis for negative value labels. Before, "-2" ran into the category name (gallery, UX-1).

## Critique
1. **The Fake Engine returns no λ.** On S-08 the axis shows only "No loadability value". The real look is seen in the gallery only, with placeholder numbers.
2. **The λ_s wording differs from the guideline.** The tile and caption say "solution-existence diagnostic, not a stability limit", the Doc 3 wording. The guideline's exact phrase is already used by the Loadability list, and an existing E2E test finds it by text (strict mode), so a second copy would have broken that test.
3. **Margin chart labels are estimated.** Category names are "element, kind" in a 210-unit column. A very long element id could be clipped.
4. **The verdict icon is not tinted.** It is black; the word carries the status, so colour is not needed.

## Tests
- Client: `components/kpi.m2.test.ts`.
  - counts of violations and of not-evaluated items
  - the tightest margin with its detail
  - null λ, the empty margin list and the FEASIBLE icon
- E2E: `test_fr_87_fr_88_constraint_check_kpis_and_charts` in `tests/e2e/test_ux_round.py`, on `m2-infeasible`:
  - The KPI strip shows the verdict, the tightest constraint, the λ_s wording and the FAKE note.
  - The margin chart is named with 2 bars and shows the Violated side.
  - The axis is named with 0 markers.
  - Both figures carry the FAKE caption.
  - "Show data" lists λ_c as "—".
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 72
  - E2E 43 on Chromium and 43 on Chrome
