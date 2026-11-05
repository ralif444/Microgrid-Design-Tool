# EX-3 review: prefill on S-09, S-10, S-11, S-12, and the S-10 per-point metric controls

Date 2026-11-05. Scope: Doc 12 X9 FR-100 on S-09 – S-12 (Doc 9 D-92, D-95). Screenshots are in `docs/design/ex-3-2026-11-05/`: `before/` was taken at `b5a53ce`, `after/` with this change. All screens were captured after M1 on the Fake Engine, at 1440 and 640 px.

## What changed

- **S-09 Sensitivity.**
  - Parameters and output metrics come from the example. Each fieldset shows an "Example" tag. A path that does not resolve on the open Project is dropped with a console warning (hook option `resolve`).
  - Step stays empty and shows "Not set in the example: enter a value." (D-92 K231).
  - The FR-84 shortcut prefill still overrides the example, because it runs after mount through `set`.
- **S-10 Sweep.**
  - The axis comes from the example: LOAD_SCALE, 1 to 4. The tag sits next to the axis select. Points stays empty with the note.
  - Changing the axis kind or range removes the tag. "Reset to example values" resets the axis and the metric checkboxes.
- **S-10, new for every Project (user decision at EX-3, D-95 K243).**
  - A "Per-point metrics, optional" fieldset with λ_c, ζ_min, Re λ_dom and indicators, plus "Include the eigenvalues of each point" (Doc 3 §6.5).
  - A parameter is sent only when something is ticked. With nothing ticked, the request is the same as before; an E2E test checks the body is `{axis}` only.
  - The example ticks ZETA_MIN (D-92 K230). The eigenvalue list is not plotted, and the screen says so.
- **S-11 Scenarios.** An info line: the scenarios come from the guided Project file (Doc 13 §4), and the first one, D2 base, is the reference (Doc 3 §6.6).
- **S-12 Envelope.** The X axis comes from the example: LOAD_SCALE, 1 to 4. The X point count, the Y axis and the Y point count show the note.
- **`useAxis`.** Takes an optional `AxisExample`, returns `reset`, and shows the tag and the note. Without an example the axis looks as before.

## Checked

- E2E on the Fake default profile: S-09, S-10 and S-12 run once the not-set fields are typed (test values, not example values); S-11 shows its line. The M3b request carries `point_metrics: ["ZETA_MIN"]` and no `include_eigenvalues`.
- Normal D2: the sweep form starts on PARAMETER with nothing ticked, and no tags appear.
- At 640 px nothing scrolls sideways. In the first after-shot, the Y-axis "not set" note sat inline after the select; it is now a block.

## Known limits

- The toggletip buttons are named "Example source: <field label>". `get_by_label(<label>)` therefore also matches them in example mode, so tests use `exact=True`. This does not happen outside example mode.
- Already true before this change: on S-12, a PARAMETER axis with no parameter chosen shows unit "1".
