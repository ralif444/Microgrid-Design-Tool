# ADR-011 step 2: S-03 Loads (2026-11-03)

Presentation only. The store actions, labels and test selectors are unchanged.

## Changes
- **Table:** the Load table now uses DataTable. Text is left-aligned and P / Q are right-aligned with tabular figures. Units sit in the headers, and the column order follows the Doc 7 §6.1 wireframe:
  Bus | P (kW) | Reactive power as Q/PF | Q (kvar) or power factor (ratio) | PF direction | Delete.
- **Row errors** move from a "Problems" column to an inline line under the row. The row is tinted, the field with the problem gets a red outline, and the message is prefixed with the column name ("P: Power cannot be negative…").
- **Keyboard:** Enter moves to the same column in the next row, and Escape restores the value the cell had on focus (Doc 7 §8).
- **Empty states:** with no buses there is one EmptyState that links to the network editor. With buses but no loads there is a "No loads yet." EmptyState. Validation problems that belong to the design, not to a row, appear in a caution-coloured list.
- **DataTable:** each row and its error line now share one `<tbody>`, so a row's test id also covers its messages. `CellInput` and `CellSelect` are exported for custom cells.
- **Q/PF choice:** the per-row choice moved from row components to one map on the screen. It is still screen state, not data.

## Screenshots
Before: `s03-loads-2026-11-03/before/<size>/`. After: `s03-loads-2026-11-03/after/<size>/`. Sizes: 1440x900 and 1280x720.

| State | File |
|---|---|
| Normal (D2 example) | `loads-normal.png` |
| Empty, no buses | `loads-empty-no-buses.png` |
| Empty, buses but no loads | `loads-empty.png` |
| Error (negative P; PF without direction) | `loads-error.png` |
| Keyboard: Enter from P of L1 | `loads-focus-after-enter.png` (focus is on P of L2) |

There is no loading state: editing is local (Doc 7 §6.1 "Loading: not applicable").

## Critique and fixes
1. **Two empty boxes when there were no buses.** "No buses yet" and "No loads yet" stacked on top of each other. Now only the bus box shows until a bus exists.
2. **Radios sat above the input line.** The fieldset legend shifted them inside a table cell. They now use a `radiogroup` with the same accessible name, and every control in a cell is centred vertically.
3. **The page was 47 px too wide at 200 % zoom (E2E).** The hidden "Actions" header label is absolutely positioned, and it escaped the table's scroll box. `.table-scroll` is now `position: relative`, so it clips that label as well.

## Tests
check passes; engine 53, Python 441, client 35; E2E 30 on Chromium and 30 on Chrome.

## Left as is
- The footer still says "Needs at least one load." next to the design-level validation message, which says the same. Both texts are kept, because one is the Doc 7 §6.1 wording and the other is a server issue.
- There is no LoadProfile editor on this screen. FR-04 is not part of this restyle.
