# EX-5 review: guidance banner, Next links, Report line

Date 2026-11-05. Scope: Doc 12 X9 FR-102 (Doc 9 D-92, D-97). Screenshots are in `docs/design/ex-5-2026-11-05/`. `before/` was taken at `1d9251d`, `after/` includes this change. Fake Engine, 1440 px and 640 px.

## What changed

- `guided-d2.example.json`: each screen S-03 – S-14 and S-16 has `guidance` {text, source}. The texts are those of `ex5_guidance_draft.md`, which the user approved as drafted (D-97 K249).
- `store/example.ts`: the guard keeps `guidance` per screen. It accepts the screens that carry guidance only, and it drops guidance that lacks text or source, with a console warning.
- `components/ExampleForm.tsx`:
  - `ExampleGuide` is the banner under the page head. It uses the house status-banner style in the info role.
    - Screens with a Run button say "Example mode: this screen is pre-filled from the guided example. Press Run." Screens without one say "this screen shows the guided example".
    - On the Fake Engine it adds the line from PRD §3 rule 3.
    - The guidance sits in a "What this step shows" disclosure, followed by its source.
  - `ExampleNext` gives the "Next: <step>" link. The order is the stepper, then M3a → M4b, then the Report.
    - Screens with a Run button show it after a FEASIBLE or INFEASIBLE run.
    - S-03, S-05 and S-06 always show it.
    - The Report has none.
  - Banner and Next link are hidden in print.
- S-16: in example mode the report meta carries "Produced in example mode from the guided example D2." This line prints.

## Checked

- Outside example mode no screen shows the banner or the Next link (E2E on a normal D2 Project).
- E2E click-through: from S-03, the Next links lead through every step to S-16. Runs need no typing except the NEEDS VALUE fields, which get test values: M3a step, M3b points, M3d points and Y axis. S-11 also needs its three scenarios ticked.
- Client: every guidance text has a source and no standalone number (D-97 K250). The rule catches "2.5 kW" and allows "INV1, D2S, M3a, N−1".
- Layout at 640 px: the banner wraps inside the page, with no sideways scroll.
- Print emulation of S-16: banner hidden, example line shown.

## Not yet

- FR-104 "Run the whole example" (EX-6, Could).
- The guidance has been read against the docs it cites, not against `Seminar.pdf` page by page.
