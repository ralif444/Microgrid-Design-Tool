# BESS_VERIFICATION_FRAMEWORK — Hand cases V1–V6 for the battery adequacy advisories

> Companion to `BESS_FEATURE_GUIDELINES.md`. Date: 2026-11-12.
> Numbers below were computed on 2026-11-12 with `mgengine` 0.4.0 at repo commit `9d14e6e` (inverter powers) and an independent arithmetic script (everything else). They are a worked example and a fixture draft. **Before they enter the thesis, the author recomputes every expected value by hand from his own REAL M1 RunRecords** (§4).

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

The register (D-62) postponed these features until real D2 battery, DC-window and profile data exist, because values may not be invented. The fictitious set below tests the algebra only, like the fictitious table file of the cable round. If the thesis should show cases on real data, the author supplies a module datasheet, an inverter DC window and a daily profile with their sources, and the same six cases are recomputed on them; the method of §3 and §4 does not change.

| Item | Values |
|---|---|
| Design | D2 as in `frontend/public/examples/d2.mgproj.json`: 0.44 kV, 50 Hz; INV1 70 kVA at B1, INV2 45 kVA at B3; load L1 25 kW, 10 kvar at B2. |
| Module MOD-T1 | $E_{mod}$ = 5 kWh; $V_{mod}^{min}$ = 44.8 V; $V_{mod}^{max}$ = 57.6 V; continuous discharge power 2.5 kW; recommended DoD 0.8. |
| Module MOD-T2 | As MOD-T1, but no discharge power; C-rate 0.2 h⁻¹. |
| DC window W-A | 350–800 V. |
| DC window W-B | 400–440 V. |
| Profile PF-T (kW per hour) | hours 0–5: 10; hours 6–17: 15; hours 18–21: 25; hours 22–23: 10. Daily energy 360 kWh; peak 25 kW = table total, so no $\lambda_h > 1$ warning. |
| Load scale (12.9) | $\lambda_h$ = 0.4, 0.6, 1.0, 0.4 for the four blocks. |
| Common settings | $\eta_{dc}$ = 0.95; DoD = 0.8; initial SoC = 1.0; start hour 0; PS autonomy 4 h. |

## 3. Cases

### 3.0 Input: M1 inverter powers on D2

| Load scale $\lambda$ | Load (kW) | Losses (kW) | $P_{INV1}$ (kW) | $P_{INV2}$ (kW) | Frequency (Hz) |
|---|---|---|---|---|---|
| 0.4 | 10 | 0.006818 | 6.158042 | 3.848776 | 49.950996 |
| 0.6 | 15 | 0.015428 | 9.240264 | 5.775165 | 49.926468 |
| 1.0 | 25 | 0.043353 | 15.411294 | 9.632059 | 49.877361 |

Sanity checks by hand: with equal setpoints and zero power references, droop sharing gives $P_{INV1}/P_{INV2} = m_{p,2}/m_{p,1} = 8/5 = 1.6$ (observed 1.600000 at all three levels), and $P_{INV1} + P_{INV2}$ = load + losses (25.043353 at $\lambda$ = 1). The $\lambda$ = 1 row equals the hand check already recorded in the gate log (49.87736 Hz, 15.4113 kW, 9.6321 kW).

### 3.1 V1 — B1, fit

Given: PF-T, autonomy 4 h, $\eta_{dc}$ 0.95, DoD 0.8, module MOD-T1, window W-A.

| Step | Calculation | Result |
|---|---|---|
| PS, Eq. 4.4 | worst 4-hour window = hours 18–21 = 4 × 25 | $E_{ac}$ = 100 kWh |
| PS, Eq. 4.13 | 100 / 0.95; then / 0.8 | $E_{dc}$ = 105.2632 kWh; $E_{nom}$ = 131.5789 kWh |
| (12.3) | $n \ge 350/44.8 = 7.81$; $n \le 800/57.6 = 13.89$ | $\mathcal{N}_s$ = {8, …, 13} → fit; hint uses $n_s$ = 8 |
| (12.4) | ⌈131.5789 / 5⌉ | $N_{mod}$ = 27 |
| (12.5) | ⌈27 / 8⌉; 8 × 4 | $n_p$ = 4; $N_{inst}$ = 32 |
| shown | 32 × 5; 160 − 131.5789 | installed 160 kWh; extra 28.4211 kWh |

### 3.2 V2 — B1, no fit

Given: as V1 but window W-B.

| Step | Calculation | Result |
|---|---|---|
| (12.3) | $n \ge 400/44.8 = 8.93$; $n \le 440/57.6 = 7.64$ | $\mathcal{N}_s = \emptyset$ → **no-fit** |
| (12.4) | unchanged | $N_{mod}$ = 27 (shown); no $n_p$ |

Also check: with the window missing, the verdict is "unknown"; PS values are byte-identical in V1 and V2.

### 3.3 V3 — B2, bank sufficient (power field)

Given: INV1, bank MOD-T1, 8 in series × 2 in parallel, $\eta_{dc}$ 0.95, M1 at $\lambda$ = 1.

| Step | Calculation | Result |
|---|---|---|
| (12.6) | 8 × 2 × 2.5 | $P_{bank}$ = 40 kW, source "discharge_power" |
| (12.7) | 15.411294 / 0.95 | $P_{dc}$ = 16.2224 kW |
| (12.8) | 40 − 16.2224 | $m_{bat}$ = +23.7776 kW → **OK** |

### 3.4 V4 — B2, bank short (C-rate fallback)

Given: INV2, bank MOD-T2, 8 in series × 1 in parallel, $\eta_{dc}$ 0.95, M1 at $\lambda$ = 1.

| Step | Calculation | Result |
|---|---|---|
| (12.6) | 0.2 × 8 × 1 × 5 | $P_{bank}$ = 8 kW, source "c_rate" |
| (12.7) | 9.632059 / 0.95 | $P_{dc}$ = 10.1390 kW |
| (12.8) | 8 − 10.1390 | $m_{bat}$ = −2.1390 kW → **SHORT** |

Also check: the M2 verdict and margins of the same design are unchanged by this outcome.

### 3.5 V5 — B3, bank depletes within 24 h

Given: INV2, bank MOD-T1, 8 × 2, $\eta_{dc}$ 0.95, DoD 0.8, initial SoC 1.0, start hour 0, profile PF-T.

| Step | Calculation | Result |
|---|---|---|
| (12.14) | 8 × 2 × 5 | $E_{bank}$ = 80 kWh |
| (12.15) | 0.95 × 80 × (1.0 − 0.2) | $E_{use}$ = 60.8 kWh |
| (12.16), hours 0–5 | 6 × 3.848776 | $E_{cum}(5)$ = 23.0927 kWh |
| (12.16), hours 6–11 | 23.0927 + 6 × 5.775165 | $E_{cum}(11)$ = 57.7436 kWh |
| (12.16), hour 12 | 57.7436 + 5.775165 = 63.5188 > 60.8 | $j^*$ = 12 |
| (12.18) | 12 + (60.8 − 57.7436) / 5.775165 | $t_{aut}$ = 12.5292 h → **DEPLETED**, during clock hour 12 |
| (12.17) check | SoC at $j$ = 11: 1 − 57.7436 / (0.95 × 80) | 0.2402, still above the limit 0.2 |

### 3.6 V6 — B3, bank not depleted

Given: INV1, bank MOD-T1, 8 × 8, other settings as V5.

| Step | Calculation | Result |
|---|---|---|
| (12.14) | 8 × 8 × 5 | $E_{bank}$ = 320 kWh |
| (12.15) | 0.95 × 320 × 0.8 | $E_{use}$ = 243.2 kWh |
| (12.16), full day | 6 × 6.158042 + 12 × 9.240264 + 4 × 15.411294 + 2 × 6.158042 | $E_{cum}(23)$ = 221.7927 kWh < 243.2 |
| outcome | no $j^*$ within 24 h | **NOT_DEPLETED** |
| (12.17) | 1 − 221.7927 / (0.95 × 320) | end SoC = 0.2704 (limit 0.2) |

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
