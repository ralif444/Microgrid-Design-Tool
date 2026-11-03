# Carbon step (c): S-16 Report (2026-11-03)

Last screen of ADR-012 step (c). Presentation only. All labels, accessible names and test ids are unchanged.

## Screenshots
Location: `carbon-s16-2026-11-03/{before,after}/`. "Before" is commit fab4f3c (S-08). The states are the same as in the ADR-011 review:
- empty: no M1 or M2 run
- partial: M1 only
- normal: D2 FEASIBLE, full page
- outdated: the design changed after the run
- INFEASIBLE (second server with `MGAPP_FAKE_PROFILE=m2-infeasible`), full page
- print: print media at the A4 printable width of 718 px (`report-print-718.png`), plus `report-print.pdf`

There is no separate loading or error state: the Report reads runs already in the project.

## Changes
- **Verdict:** shown in the StatusBanner look (§7.2): `layer-01`, a hairline border, a 3 px role edge and a 20 px icon in the role colour. The status word and headline are in text-primary. Before, the box used a role tint with role-coloured text.
- **FAKE engine note:** uses the shared `.problems` banner look, with WarningAlt in yellow-60 and text in text-primary. The `role="note"` and the test id are kept.
- **Print controls bar:** on `layer-01` with square corners, like the other Carbon containers. It stays hidden in print.
- **Constraint tables, Not evaluated list, advisory panels, tables and chart:** these come from the shared components (step b, S-08). The violated-row edge from S-08 shows on screen and in the print layout.

## Critique
1. **"outdated: design changed after this run" stays in orange-70 text.** It is the global `.outdated` line, also used on other screens, and passes 7.9:1. It is left as is so all screens match.
2. **Cell padding stays 8 px** (open point from the S-03 review). The print layout still fits 718 px with the wider Carbon look. With 16 px cells, the Assumptions table would wrap further, so the padding is kept.
3. **The Report keeps the app's warm-gray page.** Print uses white, as before.

## Tests
- check passed
- engine 53, Python 441 and client 35 passed
- E2E: 30 on Chromium and 30 on Chrome, including `test_fr_60_report_print_layout`
