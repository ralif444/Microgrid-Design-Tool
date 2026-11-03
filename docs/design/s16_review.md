# S-16 Report restyle review (2026-11-03)

Step 2e, the last screen of the ADR-011 rollout. Presentation only: no reducer, API or data-shape
change; every accessible name and test id used by the E2E suite is unchanged.

Screenshots: `s16-report-2026-11-03/{before,after}/{1440x900,1280x720}/`: empty, partial (M1
only), normal FEASIBLE, outdated, INFEASIBLE (`m2-infeasible` Fake profile); print media at the A4
printable width (`report-print-718.png`) and a Chromium A4 PDF (`report-print.pdf`) for each side.

## Changes

- Control strip (screen only): primary "Print / Save as PDF" and a one-line note on what print hides.
- Head: title, then Date / Engine / App as a muted meta line. Fake note as a caution box with icon and
  the word "FAKE engine" (same treatment as the banner's Fake line).
- Numbered sections separated by a hairline; headings inside M2Results stay unruled.
- Verdict as a status box in the M2 banner's colour role, with the status icon and word; the
  "outdated" label carries a clock icon.
- Limiting constraints, margins, Sizing check and M1 tables come from the restyled shared
  components (S-07, S-08). Design summary on DataTable as Quantity / Value / Unit.
- Voltage chart value labels rounded to 6 significant digits (same `num` as the tables).
- Sizing advice basis in `AdvisoryPanel`.
- Empty state: EmptyState "No results yet." with links to Power flow and Constraint check.

## Print layout (FR-60)

- `.table-scroll` gets `overflow: visible` in print: on paper a scroll box would cut off the hidden
  columns. The report still measures 718 px wide at the A4 printable width (E2E assertion).
- The control strip is hidden in print by its own module rule; the module's `display: flex` had the
  same specificity as the global `.no-print` and won (found in the first print screenshot).
- Print tokens (tokens.css) turn role backgrounds transparent and text black; borders, icons and
  words keep status readable in grayscale.

## Critique after first pass, fixed

- Controls visible in print (above).
- Status word in the verdict sat above the sentence baseline: icon aligned inline instead of flex.

## Not changed

- Limiting constraints appear in section 2 and again inside "All evaluated margins" in section 3
  (content, Doc 7 §6.7).
- Validity indicators and Model assumptions tables keep plain table styling (FR-62 forbids classes
  inside the indicator panel; the assumptions table keeps its `th scope=row` structure).
- Section toggles (Should) are still not built.
- The PDF was generated, not rendered here for inspection (no PDF rasteriser on this laptop).
