# SLD-1: single-line diagram model (2026-11-03)

Step SLD-1 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8; Doc 9 D-75, D-76). This step adds no UI and changes no contract, so there are no before/after screenshots: every screen is unchanged.

## Changes
- `frontend/components/sld/buildSldModel.ts` is a pure function. It takes the Project and, optionally, the current M1, the current M2 (payload plus `result.limiting_constraints`), the validation issues and `MARGIN_WARN`. It returns the system block, Buses, Inverters, Loads and Lines, the isolated Buses, and a topology key.
- Each element has:
  - a full accessible name;
  - the always-visible labels of guideline §5.1;
  - the tooltip sections of guideline §6: Design data, Results, Checks, Issues;
  - an M2 mark.
- The tooltip, the inspector and "View as table" will all read these rows (§A7).
- Values are copied and only rounded with `num`. There is no arithmetic on physical quantities. R and X appear only when the server has written them.
- When there is no current run, Results reads "No current power-flow result" and Checks reads "No current constraint check". An element the run does not cover reads "Not in this power-flow result".
- An unset P or Q setpoint shows "0" with the note "not set" (Doc 3: absent = 0). An unset τ shows "—" with "not set, needed for stability analyses".
- The M2 marks follow the S-08 rules (Doc 12 §9 #17), in this order:
  1. "violated" when `margin < 0`;
  2. "limiting" when the element is in `result.limiting_constraints`;
  3. "near" when `nearLimit()` holds.

  `nearLimit` and `KIND_WORDS` are imported from `M2Results`, not re-implemented.

## Critique
1. **The S-07 Inspector still builds its own rows.** Switching it to the model is part of SLD-4, which absorbs UX-4. Until then the two can word a row differently. For example, the inspector shows `rated_kva` while the model shows "Rating".
2. **The topology key includes Inverter and Load bus ids.** Moving a Load to another Bus re-runs the layout. The guideline wants this, because the attached symbols change place.
3. **Lines with a missing or self-referencing Bus stay in the model** and do not count toward connectivity. How they are drawn is decided in SLD-2 (layout).

## Tests
- Client `components/sld/buildSldModel.test.ts`, 7 tests on example D2:
  - every element once, sorted, verbatim with units;
  - no results without M1, and no derived R;
  - M1 labels, plus an element not covered by the run;
  - Load reactive spec as entered, and unset values with a reason;
  - isolated Bus; topology key unchanged by a value edit; identical model for shuffled input;
  - M2 marks and not-evaluated rows;
  - issues attached by entity and id.
- FR-94 and FR-95 left the seam-6 exceptions (the seam test forces it once a test names them). Their E2E criteria follow in SLD-4 and SLD-7.
- Results:
  - check passed
  - engine 53, Python 441, client 52
  - E2E 34 on Chromium and 34 on Chrome
