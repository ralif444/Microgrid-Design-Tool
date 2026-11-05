# SLD-7: tests, accessibility, 200 % zoom and screenshot review (2026-11-03)

Step SLD-7 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8, FR-94 – FR-98; Doc 9 D-82). This is the last step of the SLD round. UX-3 resumes next (Doc 10 §4.1).

## Screenshots
Location: `sld-7-2026-11-03/after/`, example D2 on the FAKE engine after M1 and M2.

| File | Shows |
|---|---|
| `zoom200-s05-focus`, `1440x900-s05-focus` | S-05: INV1 reached by Tab. It shows the teal symbol, the focus ring and its tooltip. |
| `zoom200-s07`, `1440x900-s07` | S-07 diagram with M1 labels |
| `zoom200-s08`, `1440x900-s08` | S-08 diagram after M2 (default profile: FEASIBLE, no marks) |
| `zoom200-s16`, `1440x900-s16` | S-16 report figure |

"zoom200" is a 640 × 450 CSS-pixel viewport at device scale 2. That is what 1280 × 900 at 200 % browser zoom gives. The screenshots of earlier steps (SLD-3 to SLD-6) cover the other states.

## Changes
- **Re-layout debounce (guideline §9).** `useSldLayout` re-lays out 150 ms after the last topology change. Value edits still keep the layout.
- **New E2E tests in `tests/e2e/test_sld.py`:**
  - **FR-95 tooltip equals Inspector.** For an inverter, bus, line and load after M1, the tooltip rows equal the Inspector rows, label · value, in order. No row ends in a bare number, so every value has its unit.
  - **FR-98 keyboard.** The SVG is the group "Single-line diagram". Tab from the system block reaches every drawn element in DOM order (system, buses, inverters, loads, lines). Enter on Bus B1 opens its Inspector.
  - **200 % zoom.** At 640 px the page has no sideways scroll after "Fit to view", and a focused line still opens its tooltip.
- **External-request guard.** Every E2E test, the SLD ones included, runs behind the `conftest.py` page fixture, which refuses non-localhost requests and fails the test (NFR-03). elkjs is served from the app's own chunk.
- **FR-14.** `tests/e2e/test_network_diagram.py` is unchanged and passes.

## Accessibility pass
- **Diagram.** The SVG is `role="group"` with a name. Elements are `role="button"` with full names from the model and `aria-pressed` for the selection. The system block is `role="img"`, for its tooltip.
- **Tooltip.** It is `role="tooltip"` and linked by `aria-describedby` while open.
- **Toggles.** "Fit to view" and "Show results" carry `aria-pressed`. "View as table" carries `aria-expanded`.
- **Focus.** It is visible only on keyboard focus (`:focus-visible`: teal symbol and focus-coloured halo). A mouse click shows no ring.
- **Colour.** State is never colour alone: icon plus word (SLD-3 test). Text uses `text-primary` and `text-secondary` on `layer-01`, as in the rest of the app (contrast checked in UX-1).
- **Not done.** No automated audit such as axe was run; it would be a new dependency. No screen reader was used.

## Critique
1. **The Inspector shows design rows first.** For about 0.3 s after it opens, the run rows are missing, until its own debounced validation returns the design hash (FR-93). The E2E test waits for the rows. A shared validation result would remove the delay, but that touches more than the SLD.
2. **The tooltip covers part of the drawing** (also noted in SLD-4). At 200 % it can cover much of the view. Escape or Tab moves it on.
3. **Programmatic focus shows no ring.** Focus moved by `.focus()`, for example when the Inspector closes and returns focus, shows no ring because it is not `:focus-visible`. The keyboard path shows it.
4. **Open owner points remain** (guideline §12): IEEE 315 wording, loading as ratio or %, drag-to-rearrange, battery symbol, PNG export. All stay at their defaults.

## Tests
- Results:
  - check passed
  - engine 53, Python 441, client 70
  - E2E 42 on Chromium and 42 on Chrome
