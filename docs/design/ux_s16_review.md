# UX-9: S-16 report charts and print check (2026-11-04)

Work package UX-9 of `docs/UX_ANALYTICS_GUIDELINES.md` §9 (Doc 12 X3 FR-88, FR-60 print; Doc 9 D-88).

## Screenshots and print
Location: `ux-s16-2026-11-04/{before,after}/`. The example is D2 on the FAKE engine, profile `m2-infeasible`, after M1, M2 (margins 0.2) and M4a. All values are Fake Engine placeholders.

| File | Shows |
|---|---|
| `{1440x900,1280x720}/s16-screen` | The report on screen |
| `s16-print-718` | Print media at the A4 printable width of 718 px |
| `after/s16-report.pdf` | Chromium "Save as PDF", A4, 10 mm margins, with backgrounds (8 pages) |
| `after/pdf-page1`, `pdf-page6`, `pdf-page7` | PDF pages rendered for the review: verdict and margin chart; inverter loading and P/Q; line loading and the eigenvalue plane |

**PDF inspected visually (all 8 pages):**
- Every chart fits the page width; none is cut at a page break.
- The smallest chart text is 9 pt; tick labels and captions are readable.
- Every caption gives the analysis, RunRecord id, result hash, engine kind and the FAKE mark.
- "Show data" buttons are not printed.

The grey page background in the PDF is the screen background, which shows because the PDF was made with backgrounds on; a browser print without "Background graphics" is white.

## Changes
- **Static report charts.** The report wraps its content in `ReportCharts`:
  - chart captions add "result hash <hash>" (guideline §5: caption with RunRecord id and result hash)
  - line charts offer no crosshair
- **Section 3 (M2):** the margin chart "Normalised margin per constraint" and the axis "Loadability along the load scale λ", as on S-08.
- **Section 5 (M1):** "Inverter loading", "Inverter output, P and Q" and "Line loading", as on S-07. Their reference lines use the limits in the reported run's own snapshot, not the current design. The report keeps its existing bus-voltage chart, so the S-07 "Bus voltage profile" is not drawn a second time.
- **Section 5 (M4a, run-specific):** when the report has an M4a result, a heading with the stability class, the eigenvalue plane and the participation grid (or the reason it is missing). The two charts moved from S-13 into the shared `components/M4aCharts.tsx`; S-13 uses the same component.
- **One existing test edited (user decision 2026-11-04).** `test_fr_86_show_data_lists_the_payload_rows` found the FAKE caption with a page-wide `get_by_text` in strict mode; the report now has several such captions, so the lookup is scoped to its figure. The test checks the same thing.

## Critique
1. **The Fake Engine gives zero bars and no eigenvalues.** The printed charts show the frames, axes and captions, not a real shape.
2. **The eigenvalue note says "Hover a point".** In print there is no hover; the table on S-13 has the values, but the report does not repeat it.
3. **The report is long.** Eight A4 pages for D2, mostly from the "Not evaluated" list and the chart frames; section toggles (Should) are still not built.
4. **M3a to M4b runs other than M4a are not in the report.** The report reads PS, M1, M2 and M4a only; adding the other runs would change the report's scope (Doc 7 §6.7), which UX-9 does not do.

## Tests
- E2E: `test_fr_88_report_charts_are_static_and_fit_a4` in `tests/e2e/test_ux_round.py`, profile `m2-infeasible`, after M1, M2 and M4a:
  - the four new figures carry "result hash" and the FAKE caption; no second bus-voltage profile
  - no focusable chart in the report (no crosshair)
  - in print media at 718 px "Show data" is hidden and every figure ends within 718 px
- Existing E2E tests: unchanged except the one lookup above (FR-60 print-width test unchanged and passing).
- Results:
  - check passed
  - engine 53, Python 441, client 79
  - E2E 48 on Chromium and 48 on Chrome
