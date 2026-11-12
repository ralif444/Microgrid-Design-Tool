# EX-4 review: S-13 and the S-14 example disturbances

Date 2026-11-05. Scope: Doc 12 X9 FR-100 on S-13 and FR-103 on S-14 (Doc 9 D-92, D-96). Screenshots are in `docs/design/ex-4-2026-11-05/`. `before/` was taken at `117f840`, `after/` includes this change. All shots were taken after M1 on the Fake Engine, at 1440 px and 640 px.

## What changed

- **S-13 needs no code change.** D-92 K231 leaves τ_in and the damping threshold empty, which is the screen's normal state, so the settings file has no S-13 entry. The E2E test shows Run M4a works in example mode without typing anything.
- **S-14 has a new "Example disturbance" select**, shown only in example mode.
  - It offers DR-01 load step, TS-02 inverter outage and DR-02 P* step (Doc 13 §5, D-92 K232), plus "Your own values".
  - The first preset fills the form on arrival. Choosing another refills the disturbance fields and the simulation end.
  - One "Example" tag beside the select names the source of the chosen preset.
  - Any edit switches the select to "Your own values" and removes the tag. "Reset to example values" brings back DR-01.
- **S-14 settling criteria stay empty.** The fieldset shows "Not set in the example: enter a value." (D-92 K231), and the TS-02 request carries no `settling`.
- **`useExampleForm` now shows Reset on a screen that has presets but no fields.**

## Checked

- E2E checks the values each preset fills in. The TS-02 request body is `{kind: INVERTER_OUTAGE, element_id: INV2, start_time_s: 1, duration_s: null}` with `simulation_end_s` 5.
- A normal D2 shows no preset select and an empty form; its `s14-normal-d2` screenshot matches `before/`.
- **Fixed during this step.** In the first after-shot, the "not set" note in the settling fieldset took the second grid column, so the page grew to 987 px at a 640 px viewport. The note's `grid-column: 2` now applies only inside `NumberField`. S-09 – S-12 were re-shot afterwards and their layout is unchanged.

## Known limits

- The DR-01 and DR-02 presets are read as permanent (`duration_s` null). The user confirmed this in D-92 K232; recheck it when validation case DR-01 is ported.
- The labels "Disturbance" and "Example disturbance" overlap, so in example mode tests use `exact=True`.
