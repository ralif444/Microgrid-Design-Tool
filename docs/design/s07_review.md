# S-07 Power flow (M1) restyle review (2026-11-03)

Step 2c of the ADR-011 rollout. Presentation only: no reducer, API or data-shape change; every
accessible name and test id used by the E2E suite is unchanged.

Screenshots: `s07-m1-2026-11-03/{before,after}/{1440x900,1280x720}/`: empty (not run), empty
project readiness, INPUT_INVALID, loading (request held), transport error, normal (full page and
top), stale.

## Changes

- Page head: title, M1 freshness chip, primary "Run M1" on one line (S-08 wireframe pattern).
  Busy: spinner plus "Running...", navigation stays enabled (FR-45).
- `M1FreshnessBadge` is a chip with icon + word: current (success, check), stale (caution, warn),
  not run yet (info, dot). Shared with S-08.
- Readiness: success line with icon, or a caution panel plus "You can still run M1" (Doc 7 P6).
- Empty states: "Not run yet." before any M1; "No result on this screen." with a Run history
  link when an M1 exists but this screen was left (results live in page state).
- Transport failure uses the Toast (bottom right, Dismiss) instead of a bare paragraph.
- `M1Results` tables on `DataTable`: units in headers, right-aligned tabular numbers rounded to 6
  significant digits, ids bold. System totals as Quantity / Value / Unit; "Total load" split into
  active (kW) and reactive (kvar) rows so each value has one unit.
- Power sharing (FR-81) inside `AdvisoryPanel` (dashed, "Advice" chip), since it is advisory.
- RunRecord line in muted small text.
- New global `button.primary` for primary buttons outside a form.
- StatusBanner issue rows without entity/id/field read "Design: …" instead of ": …" (seen in the
  INPUT_INVALID shot; same wording as the other issue lists).

## Not changed

- Validity indicators table keeps no class or style inside it (FR-62, asserted by E2E).
- `M1Results` also renders in the Report; its look there is reviewed with S-16.
- At 1280 px a stale flag wraps the stepper to a second line (stepper, step 1).
