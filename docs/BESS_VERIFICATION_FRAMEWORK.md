# BESS_VERIFICATION_FRAMEWORK — Hand cases V1–V6 for the battery adequacy advisories

> Companion to `BESS_FEATURE_GUIDELINES.md`. Date: 2026-11-12.
> Numbers below were recomputed on 2026-11-19 for the catalogue D2 (D-116): inverter powers from the Real Engine, everything else from an independent arithmetic script. The 2026-11-12 values on the prototype D2 are in git history (commit `9d14e6e`). They are a worked example and a fixture draft. **Before they enter the thesis, the author recomputes every expected value by hand from his own REAL M1 RunRecords** (§4).

## Ringkasan

Dokumen ini menetapkan cara memverifikasi fitur baterai. Rumus fitur ini bersifat aljabar, sehingga verifikasinya berupa perhitungan manual pada rancangan acuan D2 dengan enam kasus: dua untuk petunjuk susunan modul, dua untuk kecukupan daya, dan dua untuk otonomi pengosongan. Daya inverter yang menjadi masukan berasal dari aliran daya M1, yang divalidasi terpisah terhadap PSIM; fitur baterai tidak menambah kasus PSIM dan tidak memakai Simulink. Modul baterai, jendela tegangan DC, dan profil beban pada kasus uji bersifat fiktif dan hanya berfungsi sebagai data uji, bukan data rancangan maupun sumber rujukan.

## 1. What is verified, and by what

| Chain | Content | Method |
|---|---|---|
| Input chain | Inverter active powers $P_i$ at each load level, from M1. | Already covered by the core plan: M1 against the analytical two-inverter solution and against PSIM (steady cases SS-02 on D2). Nothing new here. A quick sanity check is included in §3.0. |
| Rule chain | Eq. (12.3)–(12.8) and (12.14)–(12.18): counts, bank power, margin, usable energy, cumulative energy, depletion time. | Hand calculation, cases V1–V6. The rules are deterministic algebra, so an exact match is the verification. |
| Not verified | Battery behaviour itself (voltage sag, SoC-dependent limits, ageing). | Out of scope: the tool does not model it, so there is nothing to compare. State this in Bab 3 and Bab 4. |

Why no Simulink or PSIM case: a simulated battery would add behaviour the tool does not claim, so any difference would measure the excluded model, not an error in the tool. If SoC-based droop is ever built (guideline §9), this changes: that feature needs a time-domain comparison, with battery capacity scaled down so the state of charge moves within seconds, plus a hand calculation of the hour loop for two inverters over three hours. Not prepared now.

## 2. Test data (fictitious, TEST ONLY)

None of this is a design value or a thesis source. File name in the repo: `tests/fixtures/FAKE_battery_TEST_ONLY.json`.

The register (D-62) postponed these features until real D2 battery, DC-window and profile data exist, because values may not be invented. The fictitious set below tests the algebra only, like the fictitious table file of the cable round. If the thesis should show cases on real data, the author supplies a module datasheet, an inverter DC window and a daily profile with their sources, and the same six cases are recomputed on them; the method of §3 and §4 does not change. Candidate real data with sources (a 754–936 V LFP rack, the TRUMPF DC window, Indonesian load-profile anchors) are collected in `docs/CASE_DATA_SOURCES.md` §1 (2026-11-19, not applied).

| Item | Values |
|---|---|
| Design | D2 as in `frontend/public/examples/d2.mgproj.json` (catalogue design, Doc 13 §4, D-116): 0.44 kV, 50 Hz; INV1 75 kVA at B1, INV2 50 kVA at B3, equal per-unit droop; load L1 27.17 kW, 10.87 kvar at B2. |
| Module MOD-T1 | $E_{mod}$ = 5 kWh; $V_{mod}^{min}$ = 44.8 V; $V_{mod}^{max}$ = 57.6 V; continuous discharge power 2.5 kW; recommended DoD 0.8. |
| Module MOD-T2 | As MOD-T1, but no discharge power; C-rate 0.2 h⁻¹. |
| DC window W-A | 350–800 V. |
| DC window W-B | 400–440 V. |
| Profile PF-T (kW per hour) | hours 0–5: 10.868; hours 6–17: 16.302; hours 18–21: 27.17; hours 22–23: 10.868 (0.4, 0.6, 1.0, 0.4 × the D2 load). Daily energy 391.248 kWh; peak 27.17 kW = table total, so no $\lambda_h > 1$ warning. |
| Load scale (12.9) | $\lambda_h$ = 0.4, 0.6, 1.0, 0.4 for the four blocks. |
| Common settings | $\eta_{dc}$ = 0.95; DoD = 0.8; initial SoC = 1.0; start hour 0; PS autonomy 4 h. |

## 3. Cases

### 3.0 Input: M1 inverter powers on D2

| Load scale $\lambda$ | Load (kW) | Losses (kW) | $P_{INV1}$ (kW) | $P_{INV2}$ (kW) | Frequency (Hz) |
|---|---|---|---|---|---|
| 0.4 | 10.868 | 0.017346 | 6.531208 | 4.354139 | 49.956459 |
| 0.6 | 16.302 | 0.039222 | 9.804733 | 6.536489 | 49.934635 |
| 1.0 | 27.17 | 0.110029 | 16.368018 | 10.912012 | 49.890880 |

Sanity checks by hand: with equal setpoints, zero power references and equal per-unit droop, sharing follows the ratings, $P_{INV1}/P_{INV2} = k_{P,2}/k_{P,1} = 0.01/0.006667 = 1.5$ (observed 1.500000 at all three levels), and $P_{INV1} + P_{INV2}$ = load + losses (27.280029 at $\lambda$ = 1). The frequency is $50 - k_{P,1} P_{INV1}$ = 50 − 16.368018/150 = 49.890880 Hz.

### 3.1 V1 — B1, fit

Given: PF-T, autonomy 4 h, $\eta_{dc}$ 0.95, DoD 0.8, module MOD-T1, window W-A.

| Step | Calculation | Result |
|---|---|---|
| PS, Eq. 4.4 | worst 4-hour window = hours 18–21 = 4 × 27.17 | $E_{ac}$ = 108.68 kWh |
| PS, Eq. 4.13 | 108.68 / 0.95; then / 0.8 | $E_{dc}$ = 114.4 kWh; $E_{nom}$ = 143.0 kWh |
| (12.3) | $n \ge 350/44.8 = 7.81$; $n \le 800/57.6 = 13.89$ | $\mathcal{N}_s$ = {8, …, 13} → fit; hint uses $n_s$ = 8 |
| (12.4) | ⌈143.0 / 5⌉ | $N_{mod}$ = 29 |
| (12.5) | ⌈29 / 8⌉; 8 × 4 | $n_p$ = 4; $N_{inst}$ = 32 |
| shown | 32 × 5; 160 − 143.0 | installed 160 kWh; extra 17.0 kWh |

### 3.2 V2 — B1, no fit

Given: as V1 but window W-B.

| Step | Calculation | Result |
|---|---|---|
| (12.3) | $n \ge 400/44.8 = 8.93$; $n \le 440/57.6 = 7.64$ | $\mathcal{N}_s = \emptyset$ → **no-fit** |
| (12.4) | unchanged | $N_{mod}$ = 29 (shown); no $n_p$ |

Also check: with the window missing, the verdict is "unknown"; PS values are byte-identical in V1 and V2.

### 3.3 V3 — B2, bank sufficient (power field)

Given: INV1, bank MOD-T1, 8 in series × 2 in parallel, $\eta_{dc}$ 0.95, M1 at $\lambda$ = 1.

| Step | Calculation | Result |
|---|---|---|
| (12.6) | 8 × 2 × 2.5 | $P_{bank}$ = 40 kW, source "discharge_power" |
| (12.7) | 16.368018 / 0.95 | $P_{dc}$ = 17.2295 kW |
| (12.8) | 40 − 17.2295 | $m_{bat}$ = +22.7705 kW → **OK** |

### 3.4 V4 — B2, bank short (C-rate fallback)

Given: INV2, bank MOD-T2, 8 in series × 1 in parallel, $\eta_{dc}$ 0.95, M1 at $\lambda$ = 1.

| Step | Calculation | Result |
|---|---|---|
| (12.6) | 0.2 × 8 × 1 × 5 | $P_{bank}$ = 8 kW, source "c_rate" |
| (12.7) | 10.912012 / 0.95 | $P_{dc}$ = 11.4863 kW |
| (12.8) | 8 − 11.4863 | $m_{bat}$ = −3.4863 kW → **SHORT** |

Also check: the M2 verdict and margins of the same design are unchanged by this outcome.

### 3.5 V5 — B3, bank depletes within 24 h

Given: INV2, bank MOD-T1, 8 × 2, $\eta_{dc}$ 0.95, DoD 0.8, initial SoC 1.0, start hour 0, profile PF-T.

| Step | Calculation | Result |
|---|---|---|
| (12.14) | 8 × 2 × 5 | $E_{bank}$ = 80 kWh |
| (12.15) | 0.95 × 80 × (1.0 − 0.2) | $E_{use}$ = 60.8 kWh |
| (12.16), hours 0–5 | 6 × 4.354139 | $E_{cum}(5)$ = 26.1248 kWh |
| (12.16), hours 6–10 | 26.1248 + 5 × 6.536489 | $E_{cum}(10)$ = 58.8073 kWh |
| (12.16), hour 11 | 58.8073 + 6.536489 = 65.3438 > 60.8 | $j^*$ = 11 |
| (12.18) | 11 + (60.8 − 58.8073) / 6.536489 | $t_{aut}$ = 11.3049 h → **DEPLETED**, during clock hour 11 |
| (12.17) check | SoC at $j$ = 10: 1 − 58.8073 / (0.95 × 80) | 0.2262, still above the limit 0.2 |

### 3.6 V6 — B3, bank not depleted

Given: INV1, bank MOD-T1, 8 × 8, other settings as V5.

| Step | Calculation | Result |
|---|---|---|
| (12.14) | 8 × 8 × 5 | $E_{bank}$ = 320 kWh |
| (12.15) | 0.95 × 320 × 0.8 | $E_{use}$ = 243.2 kWh |
| (12.16), full day | 6 × 6.531208 + 12 × 9.804733 + 4 × 16.368018 + 2 × 6.531208 | $E_{cum}(23)$ = 235.3785 kWh < 243.2 |
| outcome | no $j^*$ within 24 h | **NOT_DEPLETED** |
| (12.17) | 1 − 235.3785 / (0.95 × 320) | end SoC = 0.2257 (limit 0.2) |

### 3.7 Edge checks (unit tests, no hand table needed)

| Check | Expected |
|---|---|
| V5 with start hour 18 | the profile wraps past midnight; the first four hours use $\lambda$ = 1.0 |
| V5 with $\eta_{dc}$ empty | power and autonomy both NOT_EVALUATED, field named |
| V5 with DoD empty | power evaluated, autonomy NOT_EVALUATED, field named |
| V5 with initial SoC 0.2 | NOT_EVALUATED: at the discharge limit |
| Project without a profile | power part evaluated, autonomy NOT_EVALUATED: no daily load profile |
| Project without banks | every existing API response byte-identical to the baseline |

## 4. Procedure

1. Run M1 on D2 with the Real Engine at $\lambda$ = 0.4, 0.6 and 1.0 (a `LOAD_SCALE` sweep does not return inverter powers, so use three M1 runs on scaled loads). Export the three RunRecords; note engine version and commit.
2. Fill a calculation sheet by hand (spreadsheet or paper) with the tables of §3, taking $P_i$ from those RunRecords. Do this **before** running the feature. If the powers differ from §3.0, the sheet's numbers win and the fixture file is updated to them.
3. Run the feature on the same inputs. Export the `BA` RunRecord.
4. Compare, case by case. [DESIGN CHOICE] tolerance: counts, verdicts, outcomes and the depletion hour exact; kW, kWh, hours and SoC within 1 × 10⁻⁶ of the hand value computed at full precision (the four-decimal values above are for reading).
5. Record per case: hand value, tool value, difference, pass or fail, RunRecord id and hash.
6. Keep the cases as regression fixtures; they run in every later gate.

A failed case is reported as it is. The expected value is not adjusted to the tool.

## 5. Where it goes in the skripsi (to be decided with the outline)

| Part | Content |
|---|---|
| Bab 3 (or its lampiran) | Eq. (12.3)–(12.8), (12.14)–(12.18), each marked "diturunkan dalam penelitian ini"; the statement that the battery is not modelled and recharging is not considered; the not-evaluated rules. |
| Bab 4 (or its lampiran) | The comparison table of step 5 for V1–V6; one depletion-curve figure; the sentence that the input chain is covered by the M1 validation and that no battery simulation was used, with the reason of §1. |
| Bab 5 saran | The future-work list of guideline §9. |

Claim wording allowed: the tool checks the power adequacy and the discharge autonomy of a battery bank chosen by the user. Not allowed: that the tool models, sizes optimally, or simulates a battery energy storage system.

## Log

| Date | Change |
|---|---|
| 2026-11-12 | Drafted; inverter powers from `mgengine` 0.4.0 at `9d14e6e`, other values from an independent script. |
| 2026-11-12 | BESS-5: the cases run as regression fixtures (`tests/fixtures/FAKE_battery_TEST_ONLY.json`, `tests/api/test_battery_cases.py`, D-111); all pass on the Real Engine; values unchanged; comparison table in `docs/design/bess5_verification_review.md`. |
| 2026-11-19 | Recomputed on the catalogue D2 (D-116): PF-T scaled to the new load total (same λ blocks), §3.0 powers and all V1–V6 hand values updated; V5 now depletes during hour 11; fixture and tests follow. |
