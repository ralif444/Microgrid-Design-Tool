# EX-6 review: Run the whole example

Date 2026-11-05. Scope: Doc 12 X9 FR-104 (Could; Doc 9 D-92 K228, D-98). Screenshots are in `docs/design/ex-6-2026-11-05/`. `before/` was taken at `32eff65`, `after/` includes this change. Fake Engine, 1440 px and 640 px.

## What changed

- `components/RunWholeExample.tsx` adds a section "Run the whole example" on S-02. It shows only in example mode.
  - One click runs PS → M1 → M2 → M3a → M3b → M3c → M3d → M4a → M4b, one normal request at a time. It then opens the Report.
  - A progress list shows each step with its Status word and icon, or "skipped: not set in the example", or "not run".
- `stepRequest` decides what each step sends: what that screen would start with (D-98 K254).
  - If the step has an earlier run that is not INPUT_INVALID, it sends that run's parameters. Otherwise it sends the example values.
  - M4b uses DR-01. M3c compares the Project's three scenarios, with D2 base as the reference.
  - M3a, M3b and M3d are skipped while the example leaves a required field unset and there is no earlier run.
- The run stops at the first result that is not FEASIBLE, or at a transport error, and names the step in an alert. A FEASIBLE PS adds a PROPOSED advice; it is never accepted.

## Checked

- E2E on Fake `default`: the requests go out in the order PS, M1, M2, M3c, M4a, M4b. The Report then opens with the example line, and S-04 still offers Accept.
- E2E on Fake `m2-infeasible`: the run stops at M2 with "Stopped at Constraint check (M2)". M2 shows INFEASIBLE, M4b shows "not run", and the page stays on S-02.
- E2E: a normal Project has no "Run the whole example".
- Client: what each step sends, including the skips. An earlier run of a step wins over the example.

## Not yet

- On the REAL engine the M3c and M4b times are not measured; the run waits for each request in turn (EX-7).
- The progress list is lost when the Report opens; the RunRecords stay in Run history.
