# UX-12: regression over the UX round (2026-11-04)

Work package UX-12 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X0–X8; Doc 9 D-91). It covers the full E2E run on Chromium and Chrome, 200 % zoom over all screens, a contrast check of the chart palette, and the external-request guard.

## Screenshots
Location: `ux-regression-2026-11-04/`. Each screen is shown at a 640×450 CSS viewport (200 % zoom of a 1280 px window), full page, after every analysis has run on the regression design (default profile, FAKE engine). All values are Fake Engine placeholders.

Files `<route>-640.png` for power-flow, constraint-check, sensitivity, sweep, scenarios, envelope, small-signal, transient, report and about.

No before set: this package adds checks, not screen changes.

## Checks
- **200 % zoom after every analysis.** New test `test_ux_round_200_percent_zoom_after_every_analysis`:
  - runs M1, M2, M3a, M3b, M3c, M3d, M4a and M4b
  - at 640 px, visits all 17 routes (the WP 1.7.2 list plus S-17 About) and the component gallery
  - finds no sideways page scroll; wide tables and the diagram scroll inside their own box
  - checks that a toggletip opened on S-07 stays inside the 640 px viewport
  - The WP 1.7.2 zoom test (`test_zoom.py`, M1 only, without About) is unchanged and still passes.
- **Chart palette contrast.** New test `test_ux_round_chart_colours_reach_3_to_1_on_the_frame`:
  - covers the five series colours read from `palette.ts`, and the three feasibility-marker colours as the page resolves them (`--role-success-icon`, `--role-negative-icon`, `--cds-border-strong-01`)
  - every colour reaches at least 3:1 against the chart frame (`--cds-layer-01`, white); this is graphics contrast, with no WCAG claim (Doc 7 §8)
  - Series against white: teal 5.6, navy 16.2, purple 5.0, magenta 5.0, yellow 3.3.
  - Feasibility markers, per the `tokens.css` notes: success 3.35, negative 5.0, unavailable 3.3.
- **External-request guard.** The conftest guard (NFR-03) wraps every E2E test, so every screen visited above, including S-17 and the gallery, ran with external requests refused. None was attempted.
- **Full E2E on Chromium and Chrome:** see Results.

## Critique
1. **Yellow is the weakest series colour.** It reaches 3.3:1 on the white frame but only 3.0:1 on the page background (#f4f2ee). It is safe while charts stay inside frames; the palette note already limits it to lines.
2. **A toggletip closes on any scroll.** The test scrolls the button into view before clicking, because a scroll that lands just after the click closes the toggletip again (D-89 K219). A user who scrolls while it is open loses it, which is intended; a user does not hit the click case.
3. **Zoom is checked by layout width only.** Overlap or clipped text inside a box is not measured. Five of the ten shots (constraint-check, envelope, small-signal, transient, about) were inspected by eye and showed none; the other five were not opened.
4. **Bookkeeping from earlier packages.**
   - The UX-1 gate-log row still reads "awaiting user confirmation", although D-74 records the confirmation (2026-11-03). The row is left as written; the summary row below points to D-74.
   - UX-4 (S-05 Inspector and diagram select) was absorbed by SLD-4 (D-79, SLD guideline A4).

## Tests
- New file `tests/e2e/test_ux_regression.py` with the two tests above.
- Existing E2E tests unchanged.
- Results:
  - check passed
  - engine 53, Python 441, client 82
  - E2E 52 on Chromium and 52 on Chrome, with no external request attempted
