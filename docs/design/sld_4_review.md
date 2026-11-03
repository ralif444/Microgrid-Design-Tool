# SLD-4: interactive single-line diagram on S-05 (2026-11-03)

Step SLD-4 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8, FR-94, FR-95, FR-98; FR-90 diagram path; Doc 9 D-79). The SLD replaces the circle diagram on S-05. UX-4 is absorbed here (guideline A4).

## Screenshots
Location: `sld-4-2026-11-03/{before,after}/{1440x900,1280x720}/`, example D2 (FAKE engine, no runs).

| File | Shows |
|---|---|
| `before/network-diagram` | The old circle diagram |
| `after/network-diagram` | The SLD at fit-to-view, with toolbar and legend |
| `after/network-tooltip` | Line LN1 focused by keyboard: its tooltip with units |
| `after/network-inspector` | Enter on LN1: Inspector open, Lines tab chosen, LN1 row highlighted, LN1 drawn as selected |
| `after/network-table` | "View as table": one row per drawn element |

## Changes
- **`components/sld/SingleLineDiagram.tsx`** wraps the static `SldSvg`:
  - Every element is focusable in the §8 order (system, buses, inverters, loads, lines), with `aria-label` from the model.
  - Bus, Line, Inverter and Load are `role="button"`; the system block is focusable for its tooltip only.
  - Tooltip (`@floating-ui/react`, `role="tooltip"`, flat popover): opens 150 ms after hover and at once on focus; closes on leave, blur or Escape. Its rows are the model's section rows, the same rows the Inspector shows.
  - Enter, Space or click calls `onSelect`. The selected element is drawn as selected and has `aria-pressed`.
  - Toolbar: Zoom out, Zoom in, Fit to view (default; fit to the container width, never above 100 %). Pan is the container's scroll.
  - Legend, a list of elements that could not be drawn, the failure text and the empty text.
  - "View as table" (`aria-expanded`) shows the element table: Element, Design data, Results, Checks, Issues.
- **S-05.** The diagram stays in "Diagram (read-only)". It draws design data only; the tooltip and the Inspector use the latest current M1 and M2 (FR-93). Choosing an element opens the Inspector, sets the row highlight and selects the matching tab (a load has no tab on S-05).
- **Table path (UX-4).** `EntityTable` has an optional `onInspect`; on S-05 each row gets an "Inspect <id>" button.
- **Inspector** now reads its rows from `buildSldModel` through the new `useSldModel` hook, so tooltip and Inspector cannot disagree (guideline A7). It also opens for a Load ("Edit in Loads"). The sizing rows are now their own model section, "Sizing check", instead of sitting inside Checks.
- **Removed:** `components/NetworkDiagram.tsx`.
- **Dependency:** `@floating-ui/react` 0.27.20 is now a direct dependency. It was already installed through Carbon, so the bundle does not grow.

## Critique
1. **The tooltip can cover the drawing.** It opens above the element's box. For a long vertical line that box is tall, so the tooltip may cover the system block or an inverter. Escape or moving away closes it.
2. **Bus design rows say "1 count".** That is the model's unit word from SLD-1 and it reads oddly. I left it, because the Inspector shows the same rows.
3. **No drag-pan or wheel zoom.** Panning uses the scroll bars, and zoom is buttons only. This is enough for the design sizes of the manuscript.
4. **The selected element is matched by id only.** Ids are unique within a Project, so this holds.

## Tests
- New E2E `tests/e2e/test_sld.py`:
  - **FR-90 / FR-95:** focus on Line LN1 opens a tooltip with Ω/km, and Escape closes it. Enter opens the Inspector, selects the Lines tab and sets `aria-pressed`. Escape returns focus to the line. The row's "Inspect LN1" opens the same panel.
  - **FR-98:** the table has one row per drawn element.
- The existing FR-14 and UX-round E2E tests pass unchanged.
- Seam 6: FR-98 has left the exceptions; FR-96 and FR-97 remain (SLD-5).
- Results:
  - check passed
  - engine 53, Python 441, client 68
  - E2E 36 on Chromium and 36 on Chrome
