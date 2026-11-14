# Check screen changes

Scope: presentation layer only. Built first in the mockup `docs/design/redesign-2026-11-13/workspace-mockup.html` (user decision, 2026-11-13); the real frontend is untouched so far. Values in the mockup are the real-engine D2 results recorded in `docs/ui-ux-audit.md`; the "preview a violation" values are illustrative and labelled as such.

## Phase 1: number formatting

File: `docs/design/redesign-2026-11-13/workspace-mockup.html`

- New constant `DP` (decimals per quantity type) and `fmt(n, type)`; a type name or a plain decimal count is accepted.
- Every result on the diagram, in the inspector, in the verdict facts and in the margins table now names a quantity type (`data-q` in markup, type name in `EL`), not a per-place decimal count.
- Negative zero is shown as zero (`signDisplay: "negative"`); the minus sign is U+2212.
- Self-check: `console.assert` beside `fmt` (8 cases). No console output means it passed.

| Quantity type | Key | Decimals |
|---|---|---|
| Power: kW, kvar, kVA | `power` | 2 |
| Loading, % | `pct` | 1 |
| Voltage, pu | `pu` | 4 |
| Angle, degrees | `deg` | 2 |
| Frequency, Hz | `hz` | 3 |
| Current, A | `amp` | 1 |
| Losses, kW | `loss` | 3 |

Before and after:

| Place | Before | After |
|---|---|---|
| INV2 on diagram | 9.6 kW, 24 % | 9.63 kW, 23.5 % (same as inspector) |
| INV1 on diagram | 15.4 kW, 24 % | 15.41 kW, 23.5 % |
| LN1 current in inspector | 21.84 A | 21.8 A (same as diagram) |
| L1 on diagram and in list | 25 kW, 10 kvar | 25.00 kW, 10.00 kvar (same as inspector) |
| Margins table, limit column | 49.750, 0.9500, 100.0 | unchanged, now from the type table |

Deviations from the brief, for the user to confirm:

- Losses keep 3 decimals (own type `loss`), not the 2 decimals of kW. At 2 decimals the line losses read 0.03 + 0.02 kW against a total of 0.04 kW.
- Not changed, because the brief's table does not cover them: ratings in kVA (0 decimals, inputs), loadability λc (2), lowest damping ratio (3), dominant mode frequency (2, shown as 11.72 Hz; the `hz` type would print 11.720).

## Phase 2: status strip

File: `docs/design/redesign-2026-11-13/workspace-mockup.html`

- New `.strip` at the top of the canvas. In Check it shows, left to right: "Power flow solved" chip, "Feasible" or "Not feasible" chip (icon and text), the count ("10 pass, 3 not evaluated"), system frequency, lowest bus voltage with its bus, loadability λc, line losses, and the freshness chip on the right.
- Freshness chip: "Up to date, 21:13", or "Stale, design changed since check" with a warning icon. Its tooltip carries the check date, the engine version and the pointer to the inputs used.
- The bottom-left verdict panel is removed; the dock now holds only the result tabs. In Model the dock is hidden and the strip reads "Ready to check".
- `main.canvas` is now a column: strip, then `.stage` (diagram, note, legend, mockup control).
- "Run check" now has a handler: it clears the stale state and opens Check.
- Removed strings: `okLine`, `badLine`, `tightest`, `trace`, `inputs`. Added: `pfSolved`, `okCount`, `badCount`, `vminLbl`, `at`, `fresh`, `stale`, `freshTip`, `staleTip` (English and Indonesian).

Before and after:

| Before | After |
|---|---|
| Verdict in a 400 px panel at the bottom left, under the diagram | Status in one strip above the diagram |
| No sign of whether the result still matched the design | Freshness chip, with a stale state |
| One verdict | Power flow and constraint check shown as two statuses |
| Tightest margin as a headline figure | Not in the strip; it becomes the first row of the margins table in phase 3 |

Notes:

- Freshness is simulated in the mockup: editing any parameter in the inspector sets the stale state. The real app can tell (snapshot hash compare, `m1Freshness` in `frontend/components/useValidation.ts`), so this is not blocked.
- Deviation: "Line losses" is kept in the strip although the brief does not list it, so that no result is dropped.
- Deviation: commas are used where the brief shows dot separators ("10 pass, 3 not evaluated"; "Up to date, 21:13").
- The strip wraps to two rows up to at least a 1440 px window (canvas 896 px wide).
- The header still has one "Run check" button; the split into two run actions is phase 5.
- The violated and passing counts in the violation preview (2 and 8) are illustrative, like the rest of that preview.

## Phase 3: results drawer

File: `docs/design/redesign-2026-11-13/workspace-mockup.html`

- The dock now spans the full window width (it used to stop at the inspector) and has a "Hide results" / "Show results" button. Collapsed, only the tab row stays (41 px); choosing a tab opens it again.
- Margins table rebuilt: Constraint, Element, Value, Limit, Margin, Normalised margin (bar), Status. Each number carries its unit in a fixed-width slot, so the separate Unit column is gone.
- All 10 evaluated constraints are listed (the old table showed 5), sorted by normalised margin, smallest first. Frequency lower limit is first, which matches the engine's reported tightest margin (0.127 Hz).
- Status is an icon plus a word: Pass, Near limit, Violated.
- Clicking a row (or Enter / Space on it) selects that element on the diagram, in the list and in the inspector; every row of the selected element is highlighted. System rows (frequency) select nothing.
- "Not evaluated" is unchanged: a list and the "Set limits" button.
- Strings added: `fHigh`, `cBar`, `cStatus`, `pass`, `near`, `viol`, `hideRes`, `showRes`. Removed: `cUnit`, `cShare`, `over`.

Before and after:

| Before | After |
|---|---|
| Dock 286 px high, always open, beside the inspector | Full-width drawer, collapsible |
| 5 rows, fixed order, "Margin used" bar, violations marked by colour and the word "over" | 10 rows, tightest first, normalised-margin bar, Status column with icon and word |
| Rows not clickable | Row selects the element |

Notes:

- In the app, `margin` and `normalised_margin` come from M2 `constraint_margins` (Doc 03, Eq. 4.18), already sorted by the engine. The mockup has no such data, so it derives both from the D2 values and limits: two-sided limits as margin over band width, one-sided as margin over the limit. The derived rows are for layout only and are not engine output.
- The bar shows the normalised margin clamped to 0–1: longer means more room; a violated row has an empty bar.
- No row in the D2 data is near its limit, so the "Near limit" status is built but not seen on screen.

## Phase 4: results on the diagram

File: `docs/design/redesign-2026-11-13/workspace-mockup.html` (implemented by a Sonnet subagent, checked in the browser afterwards)

- Bus voltage labels carry a status mark beside the value: tick (pass, grey), warning triangle (near limit, `--warn`), cross (violated, `--bad`). The mark has a text title with the status word. Status is the worst of that bus's margin rows, using the same rule and `NEAR_LIMIT` as the table.
- Inverters have a loading bar (60 by 5) under the "kW, %" line; the fill is loading over 100 %, clamped, and takes the status colour. INV1's "Overloaded" tag moved down 6 px to clear the bar.
- Lines show "no limit" under the current, because no current limit is set.
- The element with the smallest element-level margin (B2) gets a solid 2 px accent outline, 3 px outside the dashed selection box so both stay visible. Legend entry: "Smallest element margin".
- Strings added: `noLimit`, `lgTight`. Script: `PATH`, `COL`, `stOf` (the status rule, now shared by the table and the diagram).

Before and after:

| Before | After |
|---|---|
| Voltage labels plain; a violation shown by colour and a tag | Every bus label has a status mark and its word |
| Inverter loading as a number only | Number plus bar |
| No hint that line current is unchecked | "no limit" under each line current |
| Tightest constraint visible only in the table | Outline on the element concerned |

Notes:

- The tightest constraint overall is system frequency, which has no element. The outline therefore marks the tightest element-level constraint and the legend says so.
- Open for phase 6: the brief gives this outline and the selection the same style (solid 2 px accent). Selection is still dashed; one of the two needs a different treatment.
- Known defect, fixed in phase 6: the new legend entry is partly covered by the mockup control at 1440 px.

## Phase 5: header and inspector

File: `docs/design/redesign-2026-11-13/workspace-mockup.html` (implemented by a Sonnet subagent, checked in the browser afterwards)

- Header: the Language and Theme switches moved into one "Settings" menu (a native `details` element; closes on Escape and on a click outside; stays open while choosing).
- Header: "Run check" is now two buttons, "Run power flow" and "Run constraint check" (primary). In the mockup both clear the stale state and open Check.
- Header: Studies and Report use `aria-disabled` so they take focus and show a tooltip ("Not drawn in this mockup"). The 0.55 opacity is gone; they use `--ink-2`, enabled tabs use `--ink`, and the cursor is "not allowed".
- Inspector: "Parameters" renamed "Inputs"; inputs keep their field border in Check as well as Model, so they read as editable. "Results of last check" is a tinted read-only block (`--canvas` on the `--surface` panel).
- Inspector rows are a three-column grid, label / value / unit (`1fr 90px 56px`): values share a right edge, units a left edge. The unit moved out of the input box.
- Header spacing tightened (gap 20 to 12 px, tab padding 16 to 12 px) and the project name truncates with an ellipsis when short of room.
- Strings added: `settings`, `langLbl`, `themeLbl`, `runPf`, `notDrawn`. Changed: `run`, `params`, `results`.

Before and after:

| Before | After |
|---|---|
| Two switch groups always in the header | One Settings menu |
| One "Run check" | Two run actions, matching the two checks |
| Disabled tabs at 55 % opacity, not focusable, English-only tooltip | Full-contrast secondary text, focusable, translated tooltip |
| Inputs looked read-only in Check; units inside each box, ragged | Inputs editable everywhere; results tinted; one unit column |

Notes:

- At 1280 px the Indonesian header fits on one line only because the project name is cut ("Guided example D2, peru…"). English fits uncut.
- The tooltip reason on the disabled tabs is the mockup's own. The app's reason depends on its gating rules and must come from them.
- Editing an input in Check marks the result stale (phase 2), so editable inputs there do not leave a result that silently no longer matches.

## Phase 6: polish

File: `docs/design/redesign-2026-11-13/workspace-mockup.html` (implemented by a Sonnet subagent; checked in the browser; the mockup control was then moved by hand)

- Label positions, one rule per type. Bus: name above, value below, at the outer end (B2's name moved above the bus). Inverter: name, rating, result and bar to the right of the symbol (INV2 moved from left to right). Line: labels to the right of the line (LN2 moved). Load unchanged.
- Selection (user decision): solid 2 px accent outline in the tree and on the diagram; the dashed box and the tree's 3 px left bar are gone.
- Smallest element margin: now a filled accent bar, 4 high, under the element's box, with a matching legend swatch. It no longer shares a style with selection.
- Canvas toolbar: three icon buttons, fit to view, zoom in, zoom out, each with a translated `aria-label` and tooltip; the group is labelled "Diagram view". Zoom scales the view box by 1.25 per step, between 0.5 and 3 times.
- Legend order: bus, grid-forming inverter, line, load, smallest element margin. Nothing covers it.
- Mockup control: hidden unless the address ends in `#dev` (or carries `?dev`). When shown it sits in the drawer's tab row, off the diagram.
- Left tree: rows 24 px high (were about 30); the whole list fits at an 800 px tall window without scrolling.
- Strings added: `zoomIn`, `zoomOut`, `tbLabel`. `render()` now also translates `data-al` (aria-label).

Before and after:

| Before | After |
|---|---|
| INV2 and LN2 labels on the left, INV1 and LN1 on the right; B2's name below its bus | Same side and offsets per element type |
| Dashed box on the diagram, left bar in the tree | One solid 2 px accent outline in both |
| "Fit to view" text button, no zoom | Three-button toolbar with working zoom |
| Mockup control always visible, covering the legend | Dev-only, in the drawer tab row |

Notes:

- Loading bars are 50 wide (were 60) so INV2's bar clears the B3 label. INV2's result line and the B3 name are close (no overlap, measured), the tightest spot on the diagram.
- Bus values and marks sit 4 lower to clear the margin bar.
- Keyboard focus on a diagram element still shows the same box as selection; phase 7 separates the two.

## Phase 7: accessibility

File: `docs/design/redesign-2026-11-13/workspace-mockup.html`.

- Token value changed: light `--bad` `#c2410c` to `#b53b0b` (same hue, darker). Before, alert text failed 4.5:1 on the canvas (4.17) and on `--bad-soft` (4.30). No new token; dark theme unchanged.
- Hovered and selected rows (tree and margins table): secondary text, units and violated-row text use `--ink`. Before, `--ink-2` and `--bad` fell below 4.5:1 on the `--rule-2` hover fill and the `--act-soft` selected fill. Status in those rows is still carried by the icon and the status word.
- Input boundary: `.field` border `--rule` to `--ink-2` (1.67:1 to 5.70:1 on the field background). Placeholder colour set to `--ink-2` explicitly.
- Keyboard order: the drawer now comes before the inspector in the document; layout unchanged (grid areas). Tab order measured in the browser over 53 focusable elements: header, tree, canvas (strip, toolbar, diagram), drawer, inspector.
- Focus ring: the global `:focus-visible` outline (2 px `--act`) now also shows on diagram elements. Before, keyboard focus on a diagram element drew the selection box, so focus and selection looked the same. Checked with the Tab key on LN1.

Not changed (below 3:1, left on purpose, your call): dividers, button and chip borders, table rules and bar tracks use `--rule` / `--rule-2` (1.3 to 2.0:1). Each of these controls is identified by its text label or by a value printed beside it, so the border is not the only cue. Raising them would change the quiet look.

## New constants and tokens

| Name | Where | Meaning |
|---|---|---|
| `DP` | mockup script | Decimals per quantity type. Display choice only. |
| `NEAR_LIMIT` = 0.05 | mockup script | Normalised margin below which a satisfied constraint is labelled "Near limit". UI display choice, not an engineering criterion. Same value as the app's `margin_warn` from `/api/meta`; the app must read it from there, not hard-code it. |

No new colour tokens.

## Contrast table

WCAG 2.1 relative-luminance ratios, computed from the token values. Targets: text 4.5:1, UI 3:1. Light / dark.

Text:

| Text | Background | Where | Light | Dark |
|---|---|---|---|---|
| `--ink` | `--surface` | header, tree, inspector, drawer | 14.26 | 11.67 |
| `--ink` | `--raised` | input values, table | 15.17 | 10.43 |
| `--ink` | `--canvas` | diagram labels, strip, results block | 12.22 | 13.27 |
| `--ink` | `--act-soft` | selected row | 12.39 | 9.13 |
| `--ink` | `--rule-2` | hovered row | 10.79 | 8.34 |
| `--ink-2` | `--surface` | secondary text, units, unavailable tabs | 5.36 | 5.70 |
| `--ink-2` | `--raised` | units, placeholder | 5.70 | 5.09 |
| `--ink-2` | `--canvas` | diagram secondary text, legend | 4.59 | 6.48 |
| `--act-ink` | `--act` | primary button | 6.09 | 7.43 |
| `--surface` | `--ink` | pressed segment button | 14.26 | 11.67 |
| `--act` | `--surface` | links, active tab | 5.73 | 6.34 |
| `--bad` | `--surface` | violated text in tree and table | 5.49 (was 4.87) | 5.41 |
| `--bad` | `--canvas` | violated value on diagram, strip | 4.71 (was 4.17, fail) | 6.16 |
| `--bad` | `--bad-soft` | "Not feasible" chip | 4.85 (was 4.30, fail) | 4.82 |
| tag text | `--bad` | "Overloaded" / "Below voltage limit" tag | 5.84 (was 5.18) | 6.16 |
| `--warn` | `--warn-soft` | stale chip, mockup control | 4.96 | 5.87 |
| `--warn` | `--surface` | near-limit text | 5.57 | 7.06 |

Removed by the phase 7 rule (these pairs no longer occur): `--ink-2` on `--act-soft` (4.66 / 4.46), `--ink-2` on `--rule-2` (4.06 / 4.07), `--bad` on `--act-soft` (4.23 / 4.23), `--bad` on `--rule-2` (3.68 / 3.87).

UI (non-text):

| Element | Against | Light | Dark | Result |
|---|---|---|---|---|
| Focus ring, selection box `--act` | `--canvas` | 4.91 | 7.21 | pass |
| Focus ring `--act` | `--surface` | 5.73 | 6.34 | pass |
| Focus ring `--act` | `--raised` | 6.09 | 5.67 | pass |
| Selected-row outline `--act` | `--act-soft` | 4.97 | 4.96 | pass |
| Diagram symbols `--ink` | `--canvas` | 12.22 | 13.27 | pass |
| Pass mark `--ink-2` | `--canvas` | 4.59 | 6.48 | pass |
| Violated mark, bus, bar `--bad` | `--canvas` | 4.71 | 6.16 | pass |
| Near-limit mark `--warn` | `--canvas` | 4.77 | 8.03 | pass |
| Margin bar fill `--ink-2` | track `--rule-2` | 4.06 | 4.07 | pass |
| Violated bar fill `--bad` | track `--rule-2` | 4.16 | 3.87 | pass |
| Input border `--ink-2` | `--raised` | 5.70 (was 1.67, fail) | 5.09 (was 1.58, fail) | pass |
| Dividers, button and chip borders `--rule` | `--surface` | 1.57 | 1.77 | below 3:1, left (see phase 7) |
| Loading-bar track `--rule` | `--canvas` | 1.35 | 2.01 | below 3:1, left; value printed beside it |

### App tokens after W2 (2026-11-14)

Re-computed from the values in `frontend/app/carbon.scss` and `frontend/app/tokens.css` (WCAG 2.1 formula), light / dark. Role names: `ink` text-primary, `ink2` text-secondary (also success = FEASIBLE, info fg, input border, info edge), `act` interactive/focus/link, `onc` text-on-color, `neg` negative role, `cau` caution role (attention uses the same values), `errfg` error fg, `err_edge` support-error (error edge and icon), `adv` advisory fg. The chart series rows are also checked in the browser by `test_ux_round_chart_colours_reach_3_to_1_on_the_frame` in both themes.

Text:

| Foreground | Background | Where | Light | Dark |
|---|---|---|---|---|
| `ink` #1b2733 / #e6eaed | `page` #f7f8f9 / #252c33 | body text on page/header | 14.26 | 11.67 |
| `ink` #1b2733 / #e6eaed | `raised` #ffffff / #2c343c | tables, panels, inputs | 15.17 | 10.43 |
| `ink` #1b2733 / #e6eaed | `hover` #e8ebee / #343c44 | hovered row | 12.67 | 9.25 |
| `ink` #1b2733 / #e6eaed | `sel` #dfe9f8 / #273750 | selected row, SLD halo | 12.39 | 9.93 |
| `ink` #1b2733 / #e6eaed | `canvas` #e4e7ea / #1c2227 | diagram canvas | 12.22 | 13.27 |
| `ink2` #5b6875 / #9aa6b2 | `page` #f7f8f9 / #252c33 | secondary text; FEASIBLE (success fg); info fg on info bg | 5.36 | 5.70 |
| `ink2` #5b6875 / #9aa6b2 | `raised` #ffffff / #2c343c | secondary text on panels; FEASIBLE in a table | 5.70 | 5.09 |
| `ink2` #5b6875 / #9aa6b2 | `hover` #e8ebee / #343c44 | secondary text, hovered row | 4.77 | 4.52 |
| `ink2` #5b6875 / #9aa6b2 | `sel` #dfe9f8 / #273750 | secondary text, selected row | 4.66 | 4.84 |
| `onc` #ffffff / #10202f | `act` #1f5fbf / #7fb0f5 | primary button | 6.09 | 7.43 |
| `onc` #ffffff / #10202f | `acth` #0043ce / #a6c8ff | primary button hover | 7.79 | 9.71 |
| `onc` #ffffff / #10202f | `acta` #002d9c / #d0e2ff | primary button pressed | 11.32 | 12.61 |
| `onc` #ffffff / #10202f | `dang` #da1e28 / #ff8389 | danger button (delete dialog) | 5.00 | 6.98 |
| `onc` #ffffff / #10202f | `dangh` #b81921 / #ffb3b8 | danger hover | 6.56 | 9.76 |
| `page` #f7f8f9 / #252c33 | `ink` #1b2733 / #e6eaed | pressed theme segment | 14.26 | 11.67 |
| `act` #1f5fbf / #7fb0f5 | `page` #f7f8f9 / #252c33 | links on page | 5.73 | 6.34 |
| `act` #1f5fbf / #7fb0f5 | `raised` #ffffff / #2c343c | links, outlined button text | 6.09 | 5.67 |
| `acth` #0043ce / #a6c8ff | `raised` #ffffff / #2c343c | link hover | 7.79 | 7.41 |
| `acth` #0043ce / #a6c8ff | `hover` #e8ebee / #343c44 | row action link hover | 6.51 | 6.57 |
| `neg` #b53b0b / #f0834a | `negbg` #fbe6dc / #4a2c1e | INFEASIBLE chip / violated row | 4.85 | 4.82 |
| `neg` #b53b0b / #f0834a | `page` #f7f8f9 / #252c33 | negative text on page | 5.49 | 5.41 |
| `neg` #b53b0b / #f0834a | `raised` #ffffff / #2c343c | negative text in table | 5.84 | 4.84 |
| `cau` #8a5a0b / #e0b050 | `caubg` #f6ead0 / #443619 | caution and attention (stale M1) banner | 4.96 | 5.87 |
| `cau` #8a5a0b / #e0b050 | `page` #f7f8f9 / #252c33 | caution text on page | 5.57 | 7.06 |
| `cau` #8a5a0b / #e0b050 | `raised` #ffffff / #2c343c | caution text in table | 5.92 | 6.31 |
| `errfg` #a2191f / #ffb3b8 | `errbg` #fff1f1 / #520408 | error banner | 7.09 | 8.98 |
| `errfg` #a2191f / #ffb3b8 | `page` #f7f8f9 / #252c33 | error text on page | 7.33 | 8.34 |
| `errfg` #a2191f / #ffb3b8 | `raised` #ffffff / #2c343c | field error on panel | 7.79 | 7.45 |
| `adv` #6929c4 / #d4bbff | `page` #f7f8f9 / #252c33 | advisory text (layer-02) | 7.27 | 8.31 |
| `adv` #6929c4 / #d4bbff | `raised` #ffffff / #2c343c | advisory text on panel | 7.74 | 7.42 |

UI, non-text (target 3:1):

| Foreground | Background | Where | Light | Dark |
|---|---|---|---|---|
| `act` #1f5fbf / #7fb0f5 | `page` #f7f8f9 / #252c33 | focus ring on page | 5.73 | 6.34 |
| `act` #1f5fbf / #7fb0f5 | `raised` #ffffff / #2c343c | focus ring on panel | 6.09 | 5.67 |
| `act` #1f5fbf / #7fb0f5 | `canvas` #e4e7ea / #1c2227 | focus ring on diagram | 4.91 | 7.21 |
| `ink2` #5b6875 / #9aa6b2 | `raised` #ffffff / #2c343c | input border, info/success edge+icon | 5.70 | 5.09 |
| `ink2` #5b6875 / #9aa6b2 | `page` #f7f8f9 / #252c33 | info/success edge on page | 5.36 | 5.70 |
| `neg` #b53b0b / #f0834a | `negbg` #fbe6dc / #4a2c1e | negative edge+icon on tint | 4.85 | 4.82 |
| `neg` #b53b0b / #f0834a | `raised` #ffffff / #2c343c | negative mark on panel/SLD | 5.84 | 4.84 |
| `cau` #8a5a0b / #e0b050 | `caubg` #f6ead0 / #443619 | caution/attention edge+icon on tint | 4.96 | 5.87 |
| `cau` #8a5a0b / #e0b050 | `raised` #ffffff / #2c343c | caution mark on panel | 5.92 | 6.31 |
| `err_edge` #da1e28 / #fa4d56 | `errbg` #fff1f1 / #520408 | error edge+icon on tint | 4.55 | 4.54 |
| `err_edge` #da1e28 / #fa4d56 | `raised` #ffffff / #2c343c | error edge+icon, SLD issue outline | 5.00 | 3.76 |
| `err_edge` #da1e28 / #fa4d56 | `page` #f7f8f9 / #252c33 | error edge on page | 4.71 | 4.21 |
| `s0` #00737d / #08bdba | `raised` #ffffff / #2c343c | chart series 1 | 5.60 | 5.41 |
| `s1` #0b1f44 / #e6eaed | `raised` #ffffff / #2c343c | chart series 2 | 16.23 | 10.43 |
| `s2` #8a3ffc / #be95ff | `raised` #ffffff / #2c343c | chart series 3 | 5.00 | 5.37 |
| `s3` #d02670 / #ff7eb6 | `raised` #ffffff / #2c343c | chart series 4 | 5.01 | 5.36 |
| `s4` #b28600 / #d2a106 | `raised` #ffffff / #2c343c | chart series 5 | 3.33 | 5.31 |

Failures found and fixed (next step of the same hue, as planned in `w2-tokens.md` §5):

| Pair | Was (light / dark) | Fix | Now |
|---|---|---|---|
| `ink2` on hovered row (`layer-hover-01`) | 4.06 / 4.07 on mockup rule-2 #d6dade / #39434c | hover background #e8ebee (light), #343c44 (dark) | 4.77 / 4.52 |
| `ink2` on selected row (`layer-selected-01`, `highlight`), dark | 4.46 on mockup act-soft #2b3d55 | #273750 | 4.84 |

Not in the mockup, from `@carbon/colors`: hover/pressed blue-70/80 (light), blue-30/20 (dark); dark danger button red-40/30/20 (keeps `text-on-color` #10202f readable); dark error fg/bg red-30/red-90; dark advisory purple-30; dark chart series teal-40, purple-40, magenta-40, yellow-40 (yellow-30 is Carbon support-warning, so not a series colour), series 2 = ink.

## Blocked / needs logic change

- Line current has no limit in the model (no ampacity), so lines show "no limit" and get no status. A line-loading status needs a model change (the planned X10 cable work).
- "Power balance" is listed as not evaluated while losses are reported; showing it as a check needs the engine to return it.
- The "Near limit" state never occurs with the D2 data, so it is drawn but untested on screen. Needs a case whose normalised margin is below `margin_warn`.

## Engine output to check (reported, not hidden)

- Line losses in the mockup: LN1 0.029 kW + LN2 0.015 kW = 0.044 kW, total shown 0.043 kW. May be rounding of the per-line values; the per-line figures need checking against the engine output before use.
- "Power balance" is listed as not evaluated while a loss total is reported.
