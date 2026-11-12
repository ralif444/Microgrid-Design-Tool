# BESS-4 review (B3 autonomy, depletion chart, report section, 2026-11-12)

Decisions: Doc 9 D-110 K324 – K328. The user took the recommendations for K324 (timeout ends the request; any other failed hour stops the walk; banks depleted earlier stay DEPLETED) and K327 (toggletip sources from the guideline and its equations). The rest are agent decisions within ADR-015 and guideline §3.3.

What changed
- Server:
  - `services/battery/autonomy.py`:
    - `lambdas` (Eq. 12.9) and `scaled` (P and Q times λ).
    - `hour_walk`: up to 24 M1 calls in start-hour order through `run_m1`, one overall budget, stop at the first non-FEASIBLE hour.
    - `autonomy`: Eq. 12.14 – 12.18 with the reasons of §3.3.
  - The service now returns `(result, identity)`.
  - The pipeline gives every app service a `run_m1` closure over the execution guard and the budget. The CB service ignores both.
  - Payload gains `banks[].autonomy` and `hours[]`. Warnings `PROFILE_PEAK_ABOVE_LOADS` and `ENGINE_KIND_FAKE` are added (Q3).
- Client:
  - S-20 gains the autonomy columns and the depletion chart "State of charge per inverter over the profile day" on the shared LineChart, with crosshair, Show data and Download SVG.
  - Indonesian toggletips for laju-C, DoD, SoC and otonomi.
  - S-16 section "Battery adequacy (advice, discharge only)"; the A2 row note is added.
- Docs: Doc 4 component 18 now depends on the guard; Doc 9 D-110.
- Seam-6 exceptions are now only FR-78, FR-79 (P11, BESS-6) and FR-121 (golden script).

Tests
- Unit, `tests/project_file/test_battery_service.py`:
  - V5: depletes at 12.5292 h, clock hour 12.
  - V6: not depleted, end SoC 0.2704.
  - Wrap past midnight.
  - The three empty fields and SoC at the limit.
  - No profile, failed hour, early depletion kept, negative power.
  - λ and scaling.
- Contract, `tests/api/test_battery.py`:
  - 24 calls with scaled loads in start-hour order, with identity and the FAKE warning.
  - Stop at the first failed hour.
  - Overall time budget gives TIMEOUT.
  - Profile-peak warning.
  - On the Real Engine, the curve is the running sum of the hour powers.
- Client: `socSeries` (starts at SoC_0, stops after depletion, limit line).
- E2E: `test_fr_120_depletion_chart_show_data_and_report_section` (25 data rows, report section names the RunRecord, A2 note). The two BESS-3 E2E now share the bank setup.

Checks
- Real Engine, D2 with PF-T scaled to 25 kW, measured outside the test suite: 24 hour calls in 0.07 s. INV2 8 × 2 depletes at 12.5292 h in clock hour 12 (V5). INV1 8 × 8 is not depleted with end SoC 0.2704 (V6). The formal V1 – V6 table follows in BESS-5.
- Golden comparison and the full suite: see the gate_log row.

Limits
- The GUI has no load-profile editor (FR-04 Should). The E2E adds the profile to a saved Project file and opens it.
- The discharge limit is drawn as a flat series per bank, so it also appears in Show data and the legend.
- The hour calls run even when no bank can be evaluated (ADR-015 §4 as written).
- No screenshots taken; 200 % zoom is checked in BESS-5.
