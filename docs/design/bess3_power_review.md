# BESS-3 review (analysis BA, B2 power part, S-20 table, 2026-11-12)

Decisions: Doc 9 D-109 K319 – K323 (user 2026-11-12: `BATTERY_BANK_INVALID` for start_hour and an empty bank list; the rest are agent decisions within ADR-015).

What changed
- Server:
  - `AnalysisType.BA`. `APP_TYPES` = {CB, BA}; `ENGINE_TYPES` excludes them. BA depends on M1 FEASIBLE. Allowed Status: the always-allowed set plus FEASIBLE.
  - `WarningCode.BATTERY_POWER_SHORT`.
  - `services/battery/power.py` (Eq. 12.6 – 12.8) and `services/battery/service.py` (`parameter_issues`, `compute`).
  - Pipeline step 5 looks the service up in the app-analysis map {CB, BA} (ADR-015 Q5). The CB behaviour is unchanged.
  - OpenAPI and TS types regenerated.
- Client:
  - S-20 `/battery/`: start hour prefilled 0, Run gated on a current M1, Status banner, fixed caveat, per-bank table.
  - The Further analyses link to S-20 appears only when a bank exists.
  - New BA banner headline.
  - Payload types and the outcome map are in `components/battery.ts`.
- Docs:
  - Doc 4 component 18 and its decision row.
  - Doc 9 D-109.
  - Seam-6 exceptions narrowed: FR-76, FR-77, FR-116 and FR-119 are now tested.
- Tests:
  - `tests/project_file/test_battery_service.py` (V3/V4 and the not-evaluated reasons).
  - `tests/api/test_battery.py` (contract, input rules, RealEngine SHORT case, M2 unchanged).
  - E2E `test_fr_119_s20_hidden_without_bank` and `test_fr_76_fr_116_run_shows_caveat`.
  - `BA` added to the implemented paths of the OpenAPI test.

Checks
- Golden comparison: 159 responses, only `openapi` differs. Every response for a Project without banks is byte-identical (FR-121), CB included after the pipeline refactor.
- FR-77: an M2 run on the same M1 gives the same result before and after a BA run with a SHORT bank (API test on RealEngine).
- BA makes no engine call in this round: `diagnostics = {computed_by: "app", engine_calls: 0}`, engine fields null.
- Shape errors in `parameters.banks` (e.g. a missing module) use the same bracket path form as the rule issues (`banks[0].module`). This was found and fixed during the round.

Limits
- Autonomy (B3), the depletion chart and the report section come in BESS-4. `start_hour` is validated and stored but not used yet.
- A bank edit does not hide an earlier BA result: it stays visible while the snapshot hash matches (D-106 K304). The table shows the banks the run used, from the payload.
- No screenshots taken. 200 % zoom is checked in BESS-5.
- The RealEngine M3c `zip(strict=True)` defect seen in BESS-0 was still open here (engine untouched); fixed in stage 1 by D-112 (2026-11-12).
