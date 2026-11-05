# EX-7 review: regression, REAL end to end, demo script

Date 2026-11-05. Scope: `docs/EXAMPLE_MODE_PRD.md` §10 EX-7 and §11 "API (REAL)". Screenshot in `docs/design/ex-7-2026-11-05/`: S-16 after **Run the whole example** on the Real Engine (mgengine 0.4.0), Chrome, 1440 px. No UI change in this step, so there is no before/after pair.

## What changed

- `tests/project_file/test_guided_example.py`: `test_fr_104_guided_example_end_to_end_on_the_real_engine`.
  - It runs every step on the Real Engine through HTTP, in the S-02 order, with the example values: PS, M1, M2, M3a, M3b, M3c with the three Project scenarios, M3d, M4a, and M4b with each preset DR-01, TS-02 and DR-02.
  - It checks that M1 on the guided Project gives the D2 hand check of D-64 (D-63 K124): 49.87736 Hz, INV1 15.4113 kW, INV2 9.6321 kW.
  - It checks that INPUT_INVALID comes only from M3a, M3b and M3d, whose required fields the example leaves empty (D-92 K231), and that every other step is FEASIBLE.
- `docs/demo_script.md` now starts from **Open guided example (D2)**.
  - The short route uses **Run the whole example**, and step by step follows the Next links.
  - S-06 now shows the limits that are already set, and the M2 margins are pre-filled.
  - Leaving example mode and the plain D2 example are listed under Optional.

## Checked

- REAL through the API: the M1 values above, the M2 frequency lower-limit margin of 0.127 Hz, and M4a STABLE with ζ_min 0.0973. These equal the 2026-11-03 rehearsal (D-70).
- REAL in the UI (Chrome): **Run the whole example** opened the Report after 1.7 s. The Report showed "Produced in example mode from the guided example D2.", the badge read Engine REAL, no "FAKE" text appeared, and it showed λ_c 2.034 and λ_s 20.456.
- Regression: the full check, the test suites, and E2E on Chromium and on Chrome (numbers in the gate log).

## Not yet

- The dominant mode of 11.72 Hz in the demo script was not re-read in this step. It is the same design, so the value from the D-70 rehearsal still stands.
- The demo has not been rehearsed again in full by a person; only the REAL steps above were run.
