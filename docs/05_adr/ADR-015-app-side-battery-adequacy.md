# ADR-015 — App-side battery adequacy analysis (BA) that calls the Engine Port

- Status: **Accepted**, option A and the Q1–Q6 recommendations approved by the user 2026-11-12 ("Terima semua" at the BESS-0 gate; Doc 9 D-106 K309).
- Drivers:
  - `docs/BESS_FEATURE_GUIDELINES.md` §0 ("Where it runs"), §2 R1, R6, §4.2
  - Doc 9 D-106 (decisions E1–E9 of 2026-11-12, confirmations of BESS-0)
  - Doc 12 B2, B3, FR-76, FR-116, FR-117
  - ADR-014 (app-side branch for CB) and its review trigger "a second app-side analysis is proposed"
  - Doc 4 §1 and §4 (every engine calculation goes through the Engine Port; the execution guard is the only caller), ADR-008
  - Doc 3 §5.4 (dependency check), §7 (RunRecord engine fields)

## Context
- **What BA needs.** B2 (power adequacy) reads the inverter powers of the `depends_on` M1 payload; it needs no engine call. B3 (discharge autonomy) needs the per-inverter active power at each of the 24 profile hours. A sweep point carries no per-inverter power (guideline R1), so the only source without an engine change is one M1 per hour, each on the base snapshot with every Load scaled by $\lambda_h$ of Eq. (12.9).
- **What ADR-014 settled.** CB is computed in the app after pipeline steps 1–4, with engine fields null, because it never calls the engine. BA differs in one point: its autonomy part uses engine results, so the record cannot claim that no engine was involved.
- **Engine untouched.** `engine/src/mgengine/` is not edited (guideline §0); the PSIM validation keeps referring to one engine version.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Pipeline branch for BA that calls the execution guard.** Analysis type `BA` on `POST /api/analyses/BA`; steps 1–4 as for every analysis (dependency: M1 FEASIBLE); step 5 runs the battery service, which sends up to 24 M1 requests through the execution guard and post-processes them. One RunRecord. | No engine change; one route family; verify and re-run work unchanged; the engine boundary stays the guard. | A service that calls the guard is new; needs an overall time budget and an engine-identity rule. | **Accepted** |
| B. New engine analysis (B3 inside `mgengine`) | One engine call. | Edits the engine (forbidden in this round, guideline §0); new engine version to validate against PSIM. | Rejected |
| C. Browser sends 24 M1 requests and computes B3 | No server change for B3. | The browser would compute engine-derived numbers (forbidden since D-72); 24 RunRecords and no single record of the advice. | Rejected |
| D. Read inverter powers from a P11 (M3b) result | Reuses the sweep. | Sweep points carry no per-inverter power (R1); adding it changes the engine and the M3 payload. | Rejected |

## Decision
1. **Option A.** `AnalysisType.BA` joins the enum and the committed OpenAPI. No feature flag (E5).
2. **Steps for BA:** stage-1 validation of the snapshot as for M1, plus `parameters.banks` (`BATTERY_BANK_INVALID` with the field path: unknown `inverter_id`, a second bank on one Inverter, a count below 1, a ratio outside (0, 1]) and `parameters.start_hour` (integer 0–23); size limits (none specific); canonicalise and hash the snapshot (banks are not in the snapshot, D-106); dependency check on an **M1** RunRecordRef, status FEASIBLE, three conditions of Doc 3 §5.4; then the battery service.
3. **Power part (B2):** from the `depends_on` M1 payload (`inverter_results[].p_kw`), Eq. (12.6)–(12.8); no engine call.
4. **Autonomy part (B3):** when the snapshot has a 24-point LoadProfile, one M1 request per hour in start-hour order through the execution guard, on the base snapshot with loads scaled by Eq. (12.9) and the BA request's `solver_config`; stop at the first hour whose M1 is not FEASIBLE. The hour requests produce no RunRecords of their own; their status per hour is listed in the payload `hours[]`. Without a profile the autonomy part is NOT_EVALUATED and no engine call is made.
5. **Result:** Status FEASIBLE when the request completed (per-bank outcomes in the payload, guideline §4.2); `ALLOWED_STATUS[BA]` = {FEASIBLE, INPUT_INVALID, UNAVAILABLE}. Warnings `BATTERY_POWER_SHORT` per short bank and `PROFILE_PEAK_ABOVE_LOADS` when any $\lambda_h > 1$.
6. **RunRecord:** `parameters` = {banks, start_hour}, so the banks are hashed. `diagnostics.computed_by = "app"` and `diagnostics.engine_calls` = number of M1 requests sent (0 to 24).

## Points decided with the ADR (user 2026-11-12: every recommendation taken)
| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Engine identity in the BA RunRecord | (a) the guard's identity when `engine_calls` > 0, null when 0. (b) always null, as CB. | (a): the autonomy numbers come from engine results, so the record names the engine that produced them. |
| Q2 | Time budget for up to 24 calls | (a) one overall TIME_BUDGET (30 s, Doc 12 §1) for the whole BA request, checked between calls; overrun → `UNAVAILABLE / TIMEOUT`. Each call also keeps the guard's own budget. (b) only the per-call budget. | (a): one request, one budget, as the user sees it. |
| Q3 | Marking a result served by the Fake Engine | (a) `ENGINE_KIND_FAKE` warning on the BA result when any call went to the Fake Engine, as the guard does. (b) none. | (a): Fake Engine results are never reported as engine results (CLAUDE.md). |
| Q4 | Exception inside the battery service | (a) `UNAVAILABLE / ENGINE_ERROR` with a message that the app service failed, `computed_by = "app"` (as ADR-014 Q5). (b) new StatusCode. | (a). |
| Q5 | ADR-014 review trigger ("generalise into a small app-analysis registry") | (a) step 5 looks up a small map {CB: cable sizing service, BA: battery service} instead of two `if` branches; the CB flag check stays where it is. (b) a second `if` branch. | (a), as the trigger asks; no behaviour change for CB (golden comparison). |
| Q6 | Committed OpenAPI and TS types | Include `BA`, `BATTERY_BANK_INVALID`, `BATTERY_POWER_SHORT` and the BA payload. | Include. |

## Consequences
- Doc 4 gains component 18 (battery service) and a decision row; the import rule "the battery service never imports `mgengine` or an adapter; it reaches the engine only through the execution guard".
- Re-run of a BA RunRecord repeats the hour calls; REPRODUCED needs the same engine version and commit for the autonomy part.
- A BA request may take up to 24 engine calls; on the Real Engine one D2 M1 is far below a second, so the overall budget is not expected to bind (to be measured at BESS-4).

## Review triggers
- An engine change adds per-inverter powers to sweep points: reconsider option D (P11 would then feed B3).
- SoC-based droop is taken into scope (guideline §9): the hours become coupled and this ADR no longer holds.
