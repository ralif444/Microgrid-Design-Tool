# EX-2 review: prefill helper, "Example" tags, reset on S-04, S-06 and S-08

Date 2026-11-05. Scope: Doc 12 X9 FR-100 on S-04 and S-08, plus the S-06 notice (Doc 9 D-92, D-94). Screenshots are in `docs/design/ex-2-2026-11-05/`: `before/` was taken at `c833a6f`, `after/` with this change. All are on the Fake Engine, at 1440 and 640 px wide.

## What changed

- **`store/example.ts`, `initialValue`.** Picks a field's starting value by the precedence of D-92 K233: last-run refill, then example value, then empty. A typed value stays in the form. `source` is set only when the value came from the example.
- **`components/ExampleForm.tsx`, `useExampleForm(screen, refill)`.** One hook per form. It returns:
  - the values
  - `set` (typing in a field drops that field's tag)
  - `tag(field, label)`: a blue Carbon Tag "Example" plus a toggletip "Example source: <label>" that names the source
  - `note(field)`: "Not set in the example: enter a value." for fields in `needs_value`
  - `resetButton`, which re-applies only the example values
  
  Outside example mode it returns the refill values with no tags, no note and no button.
- **`NumberField`.** Two optional props: `adornment`, after the unit, and `note`, under the input. When they are absent the DOM is unchanged.
- **S-04.** The six PS fields start from the last advice, otherwise from the example: m_inv 0.2, n = 2, r = 0. The storage fields stay empty. "Reset to example values" sits before "Run advice".
- **S-08.** The M2 fields start from the last M2 RunRecord (K149), otherwise from the example: m_inv 0.2, m_line 0.2.
- **S-06.** An info line saying the limits come from the guided Project file as Doc 3 §3.7 study settings. The limits are design data, so they get no "Example" tag, and editing them works as before.

## Checked

- S-04 and S-08 run without typing on the Fake default profile: PS FEASIBLE, M2 shows its Status. On S-08, typing in a field removes its tag, and Reset puts the value and the tag back. After an M2 run, returning to S-08 refills from the RunRecord, with no tags.
- A normal example D2 shows empty forms, no tags and no Reset button. Its S-08 screenshot is unchanged against `before/`.
- At 640 px the tag and its icon wrap inside the form panel with no sideways scroll. In the toggletip screenshot, the popover covers the next tag; this is the same behaviour as the glossary toggletip.

## Not done yet

- The info banner, guidance and Next links come at EX-5.
- S-09 – S-14 come at EX-3 and EX-4.
- Accept on S-04 is not blocked. The guidance text will say not to Accept (EX-5, D-92 K230).
