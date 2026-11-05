# S-08 Constraint check (M2) restyle review (2026-11-03)

Step 2d of the ADR-011 rollout. Presentation only: no reducer, API or data-shape change; every
accessible name and test id used by the E2E suite is unchanged (two untested table names inside
the Sizing check changed, see below).

Screenshots: `s08-m2-2026-11-03/{before,after}/{1440x900,1280x720}/`: blocked (no M1), empty (M1
current), loading (request held), normal FEASIBLE (full page), transport error, stale, INFEASIBLE
(second server with the `m2-infeasible` Fake profile).

## Changes

- Page head: title and the M1 freshness chip (from S-07); the blocked note sits right under it, above
  the form, as an attention banner with icon (link: missing, clock: stale) and the Power flow link.
- Settings form in a sunken box with aligned NumberFields (`--field-label: 18rem`), primary Run M2,
  spinner while busy.
- Empty states: "Not run yet." or "No result on this screen." (with Run history), only when M1 is
  current; when blocked the banner says what to do.
- Engine warnings (`m2-warning`) as caution lines with icon. Transport failure as Toast.
- `ConstraintTable` on `DataTable`: Value and Limit right-aligned to 6 significant digits, a Unit
  column (rows mix p.u., Hz, A, ratio), Margin as "✕ Violated by …" in the negative role or the
  near-limit chip with icon (FR-26). Shared with the Report.
- Not evaluated: attention panel; none: check icon + text.
- Loadability as a definition list with units; "solution existence, not a stability limit" kept
  as a visible qualifier under λ_s.
- Sizing check in `AdvisoryPanel` (dashed, Advice chip, "from the network"); its tables on DataTable
  with units in headers. Their names are now "Inverter ratings" and "Line currents": the old names
  ("Sizing check per …") made the scroll regions collide with the "Sizing check" region in E2E.

## Not changed

- Not-evaluated list stays one line per check (12 lines for D2 with empty limits); grouping would be
  a content change.
- The Report's use of `ConstraintTable` and the Sizing check text is reviewed with S-16.
