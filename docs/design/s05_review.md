# S-05 Network restyle review (2026-11-03)

Step 2b of the ADR-011 rollout. Presentation only: no reducer, API or data-shape change; every
accessible name and test id used by the E2E suite is unchanged.

Screenshots: `s05-network-2026-11-03/{before,after}/{1440x900,1280x720}/`
(empty, buses, lines, inverters with diagram, lines with row errors, buses with delete refusal
and isolated bus, focus row from `?focus=INV1`).

## Changes

- `EntityTable` now draws through `DataTable`: units in headers (muted), numbers right-aligned
  with tabular figures, derived totals to 6 significant digits, inline row errors under the row
  (the separate "Problems" column is gone), sr-only "Actions" header.
- `DataTable` gained `labelCell` (read-only cell named "<header> of <row>") and `rowCurrent`
  (`aria-current="true"` plus focus-colour outline and info background); first column no-wrap.
- Tabs: underlined tab strip with a selected tab (border, weight, focus-colour top edge) instead of
  three plain buttons.
- Bus delete refusal uses the inline Toast (error role, icon, "Error:" word, Dismiss).
- No buses: EmptyState. Network issues: caution panel; none: check icon + success text.
- "Choose from catalogue" form in a sunken box with its own heading.
- Diagram colours from tokens; the isolated bus uses the negative role (same as row errors), with
  the dashed ring and "not connected" word, so not colour alone.

## Critique after first pass, fixed

- Ids ("LN1", "INV1") broke one letter per line when the table scrolled: first column no-wrap.
- "Lines need two buses" hint touched the tab strip: top margin.
- Delete refusal stretched to the full content width: capped at the prose width.

## Not done

- Diagram layout keeps its fixed coordinates, so it leaves empty space (layout, not styling).
- Number inputs show the OS decimal separator (comma on this laptop), as before.
