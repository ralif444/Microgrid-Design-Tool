# Carbon step (c): S-05 Network (2026-11-03)

Presentation only. All labels, accessible names, test ids and the keyboard flow are unchanged.

## Screenshots
Location: `carbon-s05-2026-11-03/{before,after}/{1440x900,1280x720}/`. "Before" is commit 6451905 (S-03). The states are the same as in the ADR-011 review:
- empty
- Lines with row errors
- Buses after a refused delete, with the diagram open
- D2 Buses, Lines and Inverters
- an inverter row opened from a limiting-constraint link

There is no loading state, because editing is local.

## Changes
- **Tabs** look like Carbon contained Tabs (guideline §6):
  - 48 px blocks on `layer-accent-01`
  - the selected tab on `layer-01` with a 2 px teal top edge
  - disabled tabs in `text-disabled`

  The panel below the tabs is a `layer-01` box, as in Carbon. Fields inside it and in table cells use `layer-02` (#FAF9F7). Carbon's `field-02` is white in the white theme, and §3.2 makes `field-01` white too, so neither would show a field on white. The bottom border (`border-strong-01`, 3.3:1) marks the field.
- **Hint position:** "Lines need two buses; inverters need one." moved above the tabs, so it no longer separates the tabs from their panel.
- **Choose from catalogue:** shown on `layer-02` with a hairline border. Its submit button stays primary.
- **Diagram:** when opened, it sits in a white tile with a border.
- **Network issues:** shown in the INPUT_INVALID banner look: layer-01, a 3 px `support-warning` edge, and ListBulleted in yellow-60. The list keeps its name "Network issues".
- **"No network-level problems found.":** CheckmarkFilled in `support-success`, text in text-primary.

## Critique
1. **Tabs are not Carbon `Tabs`.** Carbon's roving tabindex removes inactive tabs from the Tab order. The keyboard E2E reaches "Lines" and "Inverters" with Tab, and Doc 7 §8 keeps every control in the Tab order. The tablist keeps our markup (role `tab`, `aria-selected`) and Carbon's look (ADR-012 option C).
2. **Wide Lines and Inverters tables still scroll sideways inside the panel.** That is intended: 11 and 12 columns at 1280 px.
3. **"From catalogue (entry)" wraps onto three lines in the header.** This existed before. It is left as is, because shortening the header would change the column's accessible name.
4. **Number inputs show a decimal comma (`0,44`).** This comes from the Playwright Chromium locale on this laptop. It was already recorded in the step (a) review.

## Found and fixed while reviewing
- **Fields on white looked like no field.** Carbon `field-02` is #FFFFFF in the white theme. Cells and the tab panel now use `layer-02` (globals and the network module). The same fix reaches the S-03 tables.
- **The selected tab turned gray under the mouse.** The hover rule overrode the selected background. Hover now skips the selected tab, and the selected rule includes `:hover`, so the global button hover cannot win either.

## Tests
- check passed
- engine 53, Python 441 and client 35 passed
- E2E: 30 on Chromium and 30 on Chrome
- After the last CSS-only fix, the keyboard and catalogue E2E files were re-run: 4 passed.
