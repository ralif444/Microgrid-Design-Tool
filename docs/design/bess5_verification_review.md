# BESS-5 review (hand cases V1 – V6 on the Real Engine, golden, E2E, 200 % zoom, 2026-11-12)

Decisions: Doc 9 D-111 K329 – K331 (agent decisions within the verification framework §4; gate confirmed 2026-11-12).

What changed
- `tests/fixtures/FAKE_battery_TEST_ONLY.json`: the fictitious test data of framework §2 and the printed hand values of §3. It is marked TEST ONLY.
- `tests/api/test_battery_cases.py` runs on the Real Engine in every later gate (framework §4 step 6). It checks three things:
  - Input chain: M1 inverter powers and frequency on D2 at λ = 0.4, 0.6, 1.0 equal §3.0 within 5e-7, the rounding of their 6 printed decimals.
  - Published hand values (V1 PS energy, V3 – V6) within 5e-5, the rounding of their 4 printed decimals.
  - Rule chain: the outputs equal the equations applied to the powers the tool used, within 1e-9. Outcomes, the depletion clock hour and λ per hour must match exactly.
- The B1 counts of V1, V2 stay in the client test `frontend/components/battery.test.ts`. Its E_nom is the same PS value checked here on the Real Engine.
- E2E `test_fr_120_…` ends with the 200 % zoom check (640 px CSS viewport). S-20 and the report show no sideways page scroll, and the Otonomi toggletip stays inside the viewport.
- `.scratch/bess/cases_table.py` prints the comparison table below (framework §4 step 5). It is local only and not committed.

Comparison (framework §4 step 5; tool values from `mgengine` on this branch, one run of 2026-11-12)

| Case | Quantity | Hand (framework §3) | Tool (REAL) | Difference | Pass | RunRecord / result hash |
|---|---|---|---|---|---|---|
| V1 | e_ac_kwh | 100 | 100.000000 | +0.00e+00 | pass | 165d38fda6eb4452be122cfa436dee30 / 1d4e4f62b22a |
| V1 | e_dc_kwh | 105.2632 | 105.263158 | -4.21e-05 | pass | 165d38fda6eb4452be122cfa436dee30 / 1d4e4f62b22a |
| V1 | e_nom_kwh | 131.5789 | 131.578947 | +4.74e-05 | pass | 165d38fda6eb4452be122cfa436dee30 / 1d4e4f62b22a |
| V3 | capability_kw | 40 | 40.000000 | +0.00e+00 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V3 | dc_side_power_kw | 16.2224 | 16.222415 | +1.49e-05 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V3 | margin_kw | 23.7776 | 23.777585 | -1.49e-05 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V3 | outcome | OK | OK | — | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V5 | usable_energy_kwh | 60.8 | 60.800000 | +7.11e-15 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V5 | cum_kwh_at_11 | 57.7436 | 57.743646 | +4.61e-05 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V5 | soc_at_11 | 0.2402 | 0.240215 | +1.52e-05 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V5 | autonomy_h | 12.5292 | 12.529224 | +2.37e-05 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V5 | depletion_clock_hour | 12 | 12.000000 | +0.00e+00 | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V5 | outcome | DEPLETED | DEPLETED | — | pass | bc775916918b4238bf6cd477b5aa57a4 / b98059392d3c |
| V4 | capability_kw | 8 | 8.000000 | +0.00e+00 | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V4 | dc_side_power_kw | 10.139 | 10.139009 | +9.32e-06 | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V4 | margin_kw | -2.139 | -2.139009 | -9.32e-06 | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V4 | outcome | SHORT | SHORT | — | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V6 | usable_energy_kwh | 243.2 | 243.200000 | +2.84e-14 | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V6 | cum_kwh_at_23 | 221.7927 | 221.792677 | -2.35e-05 | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V6 | end_soc_ratio | 0.2704 | 0.270419 | +1.88e-05 | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |
| V6 | outcome | NOT_DEPLETED | NOT_DEPLETED | — | pass | 5d22008605c44bf0841db2da6cb3a031 / 78b086388069 |

The RunRecord ids are random per run. The result hashes are reproducible for the same input and engine.

Checks
- Every case passes. The largest difference from a printed value is 4.74e-5 kWh (V1 E_nom, printed as 131.5789). That is rounding of the print, not a model difference: the rule-chain check against the tool's own powers holds to 1e-9.
- Golden comparison, full suite and E2E on both browsers: see the gate_log row.

Limits
- Framework §4 steps 1 – 2 are the author's: recompute the hand sheet from your own REAL M1 RunRecords before the values enter the thesis. The fixture holds the framework's draft values, and this round did not change them.
- V2 has no Real Engine part (no PS window check on the server). Its counts are client-side algebra.
- No screenshots taken; the zoom check is numeric (scroll width, toggletip box).
