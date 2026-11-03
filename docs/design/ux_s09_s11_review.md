# UX-8: S-09 and S-11 restyle, tornado charts and scenario bars (2026-11-03)

Work package UX-8 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X3 FR-88; Doc 9 D-87). Guideline §4 gives no KPI strip for S-09 or S-11, so none is added.

## Screenshots
Location: `ux-s09-s11-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 on the FAKE engine. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `s09-blocked` | Before M1: the blocked note, Run disabled |
| `s09-not-run` | After M1: the settings box and "Not run yet." |
| `s09-normal` | M3a on `inverters/INV1/rated_kva` and `inverters/INV2/rated_kva`, metrics frequency and losses, step 0.01: one tornado and one table per metric |
| `s11-not-run` | After M1, no Scenario yet: the new-scenario box, Compare and N−1 buttons, "Not compared yet." |
| `s11-normal` | After the N−1 check: one chart per key metric, then the comparison table |

## Changes
- **Carbon restyle of S-09 and S-11.** It follows S-10 to S-14:
  - page head with the M1 freshness badge; settings in a sunken box
  - S-09: parameters, output metrics and step size each in their own box
  - S-11: each Scenario in its own box; the override fields one per row; Compare as the primary button
  - Toast for errors, EmptyState for "not run yet"
  - Labels, ids, the tables "Sensitivity of …" and "Scenario comparison" keep their names; both move to `DataTable`.
- **Tornado per metric (S-09) "Tornado: <metric>".**
  - bars of `normalised_value` in the payload's `ranking` order (sorting only)
  - a null `normalised_value` gets no bar; the note lists it as "Not reported" with its `reason`
  - a `status_change` is flagged with the word "(status differs)" on the bar's label and with icon + word in the table
- **Bars per key metric across scenarios (S-11) "<metric> per scenario".**
  - one chart per metric that has data, one bar or dot per scenario, in run order with the reference first; no sorting, so no ranking is implied (4.2.5)
  - frequency and lowest bus voltage are drawn as dots on a fitted axis, as on S-07; the others as bars from zero
  - the comparison table follows the charts and now also prints `relative_delta_ratio` beside each difference.

## Critique
1. **The Fake Engine returns 0 for every sensitivity and flat key metrics.** The tornado bars have no length and the scenario charts show equal values; "Not reported" and "status differs" are not seen on screen.
2. **The table is below the charts, not beside them.** Guideline §5 says "delta table beside it"; at the 40rem chart width there is no room for a three-column table beside a chart at 1280 px.
3. **Long parameter lists.** S-09 shows every numeric path as a checkbox in one column (26 for D2); grouping per element would help but is a new design choice.
4. **Two metrics have no key metric on S-11.** Highest bus voltage and highest line current are not in `KeyMetrics`, so they get no chart and stay empty in the table, as before.

## Tests
- E2E: `test_fr_88_tornado_and_scenario_bars` in `tests/e2e/test_ux_round.py`, default profile:
  - S-09: "Tornado: System frequency" has 2 bars, the FAKE caption and the rank-order note.
  - S-11 after N−1: "System frequency per scenario" has 3 dots, the "not a ranking" note and the FAKE caption; "Show data" has 3 rows including "Without INV1 (FEASIBLE)".
- No client test: no new selector logic (sorting and filtering only, inline).
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 79
  - E2E 47 on Chromium and 47 on Chrome
