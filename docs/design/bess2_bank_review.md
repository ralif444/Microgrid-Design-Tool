# BESS-2 review (BatteryBank: Project-file field, S-05 sub-form, stage-1 rules, 2026-11-12)

Decisions: Doc 9 D-108 K315 – K318 (user 2026-11-12, all four recommendations).

What changed
- Server: `domain/battery.py` (BatteryBank, BankModule); `services/battery/banks.py` (`bank_issues`); `ProjectFile.battery_banks` (optional, default empty); `ValidateRequest.battery_banks` (optional); IssueCode `BATTERY_BANK_INVALID`. OpenAPI and TS types regenerated.
- Client: store `batteryBanks` with `bankSet` / `bankRemoved`, cascade on Inverter removal; `toProjectFile` writes `battery_banks` only when non-empty; `useValidation` sends banks only when some exist; S-05 "Battery bank" form on the Inverters tab; SLD/Inspector row.
- Tests: `tests/project_file/test_battery_banks.py`, `frontend/store/battery.test.ts`, `frontend/components/sld/battery.test.ts`, second E2E in `tests/e2e/test_battery.py`; `series_count`, `parallel_count` added to the unitless list of the OpenAPI unit check.

Checks
- Golden comparison: 159 responses, only `openapi` differs; validate, import and every analysis response for Projects without banks are byte-identical (FR-121).
- Banks never enter the snapshot: `snapshot_hash` is equal with and without banks (contract test), the store test checks the design object is untouched.
- A defect found during the round and fixed before the gate: a fresh `[]` default in `useValidation` restarted the debounce on every render, so the live report never arrived (caught by the indicator E2E). The default is now one shared array.

Limits
- No screenshots taken.
- The bank form shows bank issues in the Network issues list, not inline next to the field.
