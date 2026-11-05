# Carbon step (c): S-08 Constraint check (2026-11-03)

Presentation only. All labels, accessible names and test ids are unchanged.

## Screenshots
Location: `carbon-s08-2026-11-03/{before,after}/{1440x900,1280x720}/`. "Before" is commit a152208 (S-07). The states are the same as in the ADR-011 review:
- blocked: M1 not run
- empty: M1 current, not run yet
- loading: the request is held
- normal: D2 FEASIBLE, full page
- error: a transport failure shown as a toast
- stale
- INFEASIBLE (second server with `MGAPP_FAKE_PROFILE=m2-infeasible`), full page

## Changes
- **Violated rows (§7.3):** each violated row in a constraint table gets a 3 px `support-caution-major` left edge. `DataTable` has a new `rowViolated` hook that sets `data-violated` on the row group. The edge is drawn as an inset shadow on the first cell, so column widths do not change. The orange Misuse icon and the "Violated by" text stay, so the edge is never the only cue.
- **Warning lines** (`m2-warning`, e.g. "12 check(s) not evaluated"): these now use the shared `.problems` banner look, with WarningAlt in yellow-60 and text in text-primary. They used to be a yellow tint with yellow text.
- **Not evaluated list:** shown in the same banner layout, with the `support-info` edge and an Information icon in blue. The text is text-primary; it used to be blue on a blue tint. The list keeps its name "Not evaluated".
- **"Every check had a limit.":** uses the global `.all-clear` line with CheckmarkFilled in `support-success`.
- **Status banner, freshness Tag, Near limit Tag, Sizing check advisory, toast, empty state and busy button:** these come from the shared components restyled in step (b) and S-07.

## Critique
1. **The not-evaluated count appears twice.** The warning line gives the count, and the list below it names each check. This is existing behaviour: the warning is the engine notice, and the list is the payload. Both are kept.
2. **Two banners in a row on INFEASIBLE.** The status banner (orange) and the not-evaluated warning (yellow) sit next to each other. They differ by edge colour and icon, and in grayscale by icon shape.
3. **The edge reaches the Report and the M3b sweep.** `ConstraintTable` is shared, so violated rows there get the same edge. S-16 will check it in print.

## Tests
- check passed
- engine 53, Python 441 and client 35 passed
- E2E: 30 on Chromium and 30 on Chrome
