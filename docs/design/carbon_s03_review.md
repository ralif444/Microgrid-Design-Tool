# Carbon step (c): S-03 Loads (2026-11-03)

First screen of ADR-012 step (c). Presentation only: no reducer, API or data-shape change. All
labels, accessible names and test ids are unchanged.

## Screenshots
Location: `carbon-s03-2026-11-03/{before,after}/{1440x900,1280x720}/`. "Before" is commit 018511c (step b). The states are the same as in the ADR-011 review:
- normal (D2)
- empty, no buses
- empty, buses but no loads
- error (negative P; PF without a direction)
- keyboard focus after Enter

There is no loading state, because editing is local.

## Changes
- **Fields (global):** they now look like Carbon TextInput and Select (guideline §6):
  - bottom border only
  - `field-01` on the page; inside tables `field-02` (corrected at S-05: `field-02` is white in Carbon white, so cells now use `layer-02`)
  - a 2 px `support-error` outline when invalid
  - number steppers hidden (`hideSteppers`)

  The NumberField unit suffix continues the bottom border. Because these rules are global, every screen with fields changes too.
- **Row errors:** the line under a row uses the error role and the `ErrorFilled` icon in `support-error`. It used to use the old warning glyph.
- **Row actions:** Delete is a ghost button (§6, secondary actions), so it no longer competes with "+ Add load".
- **Empty state:** its single action is primary, as §6 asks: "icon 32 px + one line + primary action". A link keeps its role and only looks like a button.
- **Design-level problems:** shown in the INPUT_INVALID banner look: layer-01, a 3 px `support-warning` edge, and a ListBulleted icon in yellow-60. The list keeps its name "Other problems".

## Critique
1. **Q / PF radios stay native, with a teal accent colour.** Carbon `RadioButton` hides the real input visually. The E2E suite calls `.check()` on the label "PF" inside the row, and the earlier fieldset legend shifted the radios inside a table cell (ADR-011 review). The look is close to Carbon: a circle with a teal dot.
2. **Cell padding stays 8 px.** Carbon `sm` uses 16 px. Wider cells would widen every table, and the Report has to fit 718 px at A4 printable width. To revisit with S-16.
3. **The footer repeats "Needs at least one load."** next to the server issue "Add at least one load." Both texts are kept, for the same reason as in the ADR-011 review.
4. **"+ Add load" stays enabled when there are no buses.** That is existing behaviour, not styling.

## Tests
- check passed
- engine 53, Python 441 and client 35 passed
- E2E: 30 on Chromium and 30 on Chrome
