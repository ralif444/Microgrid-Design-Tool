# BESS_FEATURE_GUIDELINES — Battery adequacy advisories (v1)

> Standalone build guideline for Claude Code, same style as `docs/CABLE_BREAKER_FEATURE_GUIDELINES.md`. Date: 2026-11-12.
> Written against repo `ralif444/Microgrid-Design-Tool`, `main` at commit `9d14e6e` (2026-11-12), `mgengine` 0.4.0.
> Inputs: `docs/12_extensions.md` (§3.4 B1, §3.5 B2, §3.6 P11, §9), `docs/09_register.md` (D-59, D-62, D-102), ADR-014, user decisions of the design session of 2026-11-12 (§1 below).
> Companion file: `BESS_VERIFICATION_FRAMEWORK.md` (hand cases V1–V6 with expected values).
> Rules the author derived are marked **[DERIVED]**; design choices without a standard behind them are marked **[DESIGN CHOICE]**; points the user still has to confirm are marked **[CONFIRM]**.

## Ringkasan

Dokumen ini menetapkan cara membangun fitur baterai pada aplikasi tanpa mengubah model mesin. Fitur terdiri atas empat bagian: entri modul baterai pada katalog beserta petunjuk susunan seri dan paralel (B1), pemeriksaan kecukupan daya baterai per inverter (B2), pemeriksaan otonomi per inverter berupa kurva pengosongan selama 24 jam (B3), dan eksekusi profil 24 jam (P11). Seluruh keluaran bersifat saran: tidak ada variabel keadaan baru, tidak ada kopling antarjam di dalam model, dan putusan M2 tidak berubah. Perhitungan dilakukan oleh layanan di sisi aplikasi; mesin `mgengine` tidak disentuh sehingga validasi PSIM tetap mengacu pada satu versi mesin. Pengisian ulang tidak dimodelkan, sehingga hasil B3 dibaca sebagai otonomi pengosongan, bukan kecukupan energi sistem. Kendali *droop* berbasis SoC, pengisian, dinamika sisi DC, umur pakai, dan biaya berada di luar cakupan dan dicatat sebagai saran.

## 0. Status and guardrails

| Item | Rule |
|---|---|
| Thesis scope | Inside A1–A6 and the manuscript's out-of-scope list. No KONFLIK: the features are derived outputs (Doc 12 §1, level L2) and a composition of existing M1 runs (level L3). The supervisor is informed in one line; no approval gate. |
| What it is | Advisory checks on a battery bank that the user attaches to an inverter: can the bank deliver the power the inverter supplies (B2), and how long does it carry the daily profile from a stated starting state of charge (B3). |
| What it is not | Not a battery model. No SoC state inside M1–M4, no charging, no SoC-based droop, no DC-link or battery dynamics, no dispatch, no lifetime or cost. The inverter stays an ideal voltage source (A2). |
| Fixed caveat (screen and report) | "Discharge only: recharging is not modelled. The battery is not part of the network model (assumption A2). These results are advice and do not change the feasibility verdict." |
| Verdict rule | Nothing in this feature changes the M2 verdict, `limiting_constraints`, margins, or any M1–M4 payload or hash. |
| Where it runs | An app-side Python service, `backend/src/mgapp/services/battery/`. **The engine package `engine/src/mgengine/` is not edited in this round.** B3 obtains per-hour inverter powers by sending ordinary M1 requests through the Engine Port (§4.2). |
| Feature flag | None (user decision). The screen and panels appear only when the Project has at least one BatteryBank; a Project without one looks and behaves exactly as before. |
| Data policy | The app ships no vendor data and no example battery entries (D-59 K107). Tests use clearly fictitious modules with round numbers. |
| Schedule | PSIM stage 1.6 on the core is not blocked by this round and does not wait for it. |

## 1. Decisions applied (user, 2026-11-12)

| # | Decision |
|---|---|
| E1 | Build B1, B2, P11 and B3. B3 is taken back into v1; this replaces D-59 K106 ("B3 stays out of v1"). |
| E2 | B3 form: per inverter, cumulative energy over the 24-hour profile, shown as a depletion curve with the time of depletion. Not one system-wide number, because droop sharing gives each inverter a different power. |
| E3 | Framing: "autonomy", labelled discharge only. Never a pass/fail on the design. |
| E4 | Computed app-side, engine untouched. This replaces the wording of FR-76 ("computed in the engine", "M2 result shall carry"). |
| E5 | No feature flag. |
| E6 | Initial state of charge per bank is a user input (prefilled 100 %). |
| E7 | Verification by hand calculation, six cases on D2, kept as regression fixtures. No Simulink, no new PSIM case. |
| E8 | Out of the build, recorded as future work: SoC-based droop (with the quasi-static sequential design sketch of §9), charging operating points, DC-side dynamics in M4, lifetime and cost. |
| E9 | No KONFLIK entry. Doc 12 §9 #4 is reworded. |

## 2. Findings in the repo that shape the design

These were read from the code at commit `9d14e6e`. Each one changes something the earlier spec assumed.

| # | Finding | Consequence |
|---|---|---|
| R1 | `SweepPoint.key_metrics` (`backend/src/mgapp/domain/payloads.py`) and the engine's `mgengine.m3.KeyMetrics` carry no per-inverter power. | B3 cannot read inverter powers from a P11 (M3b) result. Adding them to the sweep point would need an engine change. So B3 sends its own 24 M1 requests through the Engine Port (§4.2). P11 is therefore **not** a prerequisite of B3. |
| R2 | The repo sweep contract uses axis **kinds** (`PARAMETER`, `SCALE_FACTOR`, `LOAD_SCALE`; `validation._axis_ok`, `convert.on_axis`), not "special parameter paths". | P11 is implemented as a new axis kind (§3.4), in the adapter and validation only. FR-78 is reworded. |
| R3 | `Model` is `extra="forbid"` and `ProjectFile` lists its top-level fields. | A BatteryBank needs an explicit schema decision (§2.1). |
| R4 | D-59 K105: B2 requires η_dc; the default η_dc = 1 was dropped "because it would add an assumption". | The same rule is applied to depth of discharge (§2.2). |
| R5 | `frontend/public/examples/d2.mgproj.json` and the guided example have `load_profile: null`. | The B1 and B3 hand cases need a profile. They use a fictitious test profile (verification framework §2); it is not thesis data. |
| R6 | CB precedent: `AnalysisType.CB` runs through the pipeline with an app-side service (ADR-014), `diagnostics.computed_by = "app"`. | The battery analysis follows the same pattern, with one difference recorded in a new ADR (§4.2). |
| R7 | Next free ids at this commit: FR-116, D-106, ADR-015, S-20. | Used below; the user confirms them at round BESS-0, as for X10-0. |
| R8 | D-62 (user 2026-11-02): B1, B2 and P11 were postponed "until the user supplies D2 battery, DC-window and profile data, because D2 has none and values may not be invented". | The build is unblocked with fictitious TEST ONLY fixtures, the same way the cable round used a fictitious table file: they test the algebra and are never presented as design data. **[CONFIRM]** whether the thesis cases use these fictitious values (stated as such) or real datasheet and profile values the user supplies; D-62 is closed either way at BESS-0. |

### 2.1 [CONFIRM] BatteryBank sits outside the canonical snapshot

Doc 12 FR-75 says that editing a bank marks the M1 result stale, because the bank would be part of the hashed design snapshot (session decision Q47). Recommended change: keep BatteryBank **outside** the canonical snapshot used by M1–M4, exactly like `CableSizingSettings` (FR-106).

Reasons: the bank is not seen by the model (A2), so an M1 result cannot become wrong when a bank changes; snapshot hashes of the reference designs stay identical with or without banks, which keeps the PSIM input sheets and existing regression vectors valid; the battery RunRecord still hashes the banks, because they are sent in `parameters`.

Storage: a new optional top-level Project-file field `battery_banks` (list, default empty), next to `sizing_advice` and `scenarios`. Whether this needs a `schema_version` step is decided at BESS-0 against Doc 3 §8; stop and ask.

### 2.2 [CONFIRM] No silent default for depth of discharge

In the design session the fallback "DoD = 1.0 recorded as an assumption" was accepted. That conflicts with D-59 K105 and with the repo rule against invented parameters. Recommended rule, consistent with K105: `depth_of_discharge_ratio` and `dc_efficiency_ratio` are explicit fields of the bank; when one is empty, the check that needs it is **not evaluated**, with the reason. The form may prefill DoD from the catalogue entry's recommended value (with its provenance) and prefills the initial SoC with 1.0; both are visible, editable and stored, so nothing is assumed silently.

## 3. Rules and equations

Equation numbers continue Doc 12 (12.x). (12.3)–(12.9) are unchanged and cited, not repeated.

### 3.1 B1 — module entries and series/parallel hint (unchanged rule)

Doc 12 §3.4, Eq. (12.3)–(12.5), FR-73, FR-74. $E_{nom}$ is the PS nominal storage energy (manuscript Eq. 4.13); PS gives it only when the profile, `autonomy_h`, `dc_efficiency_ratio` and `depth_of_discharge_ratio` are present (`mgengine.ps.storage_energy`, stage NOMINAL). In any other stage the hint is "not evaluated: PS has no nominal energy". PS numbers never change.

### 3.2 B2 — power adequacy (rule unchanged, placement changed)

Doc 12 §3.5, Eq. (12.6)–(12.8). $P_i$ is `inverter_results[].p_kw` of the M1 result in `depends_on`. Additions:

| Case | Outcome |
|---|---|
| $\eta_{dc,i}$ empty | `NOT_EVALUATED`, reason "DC efficiency not set" (K105). |
| module has neither continuous discharge power nor C-rate | `NOT_EVALUATED`, reason "module has no power capability" (FR-73). |
| $P_i < 0$ (inverter absorbs power) | `NOT_EVALUATED`, reason "inverter absorbs power; charging is not modelled". [DESIGN CHOICE] |
| otherwise | `OK` when $m_{bat,i} \ge 0$, `SHORT` when $m_{bat,i} < 0$. |

### 3.3 B3 — discharge autonomy per inverter [DERIVED]

Symbols: $E_{mod}$ module energy (kWh); $n_{s,i}, n_{p,i}$ series and parallel counts; $\eta_{dc,i}$ DC conversion efficiency (ratio); $D_i$ depth of discharge (ratio); $SoC_{0,i}$ initial state of charge (ratio); $h_0$ start hour (0–23); $\Delta t = 1$ h; $P_i(h)$ active power of Inverter $i$ (kW) from the M1 run at hour $h$, whose loads are scaled by $\lambda_h$ of Eq. (12.9).

$$E_{bank,i} = n_{s,i}\, n_{p,i}\, E_{mod} \qquad [\text{kWh}] \tag{12.14}$$

$$E_{use,i} = \eta_{dc,i}\, E_{bank,i}\,\bigl(SoC_{0,i} - (1 - D_i)\bigr) \qquad [\text{kWh, AC side}] \tag{12.15}$$

$$E_{cum,i}(j) = \sum_{k=0}^{j} P_i(h_k)\,\Delta t, \qquad h_k = (h_0 + k) \bmod 24, \quad j = 0,\dots,23 \tag{12.16}$$

$$SoC_i(j) = SoC_{0,i} - \frac{E_{cum,i}(j)}{\eta_{dc,i}\, E_{bank,i}} \tag{12.17}$$

$$j^* = \min\{\, j : E_{cum,i}(j) > E_{use,i} \,\}, \qquad t_{aut,i} = j^* + \frac{E_{use,i} - E_{cum,i}(j^*-1)}{P_i(h_{j^*})} \qquad [\text{h}],\quad E_{cum,i}(-1) = 0 \tag{12.18}$$

Reading: each profile value is the average power over its hour, the same reading PS uses when it sums profile values into energy (manuscript Eq. 4.4). The profile wraps past midnight, as in Eq. 4.4. The horizon is 24 hours.

| Case | Outcome |
|---|---|
| no 24-point load profile in the Project | whole B3 part `NOT_EVALUATED`, reason "no daily load profile". |
| $\eta_{dc,i}$, $D_i$ or $SoC_{0,i}$ empty | bank `NOT_EVALUATED` with the missing field named (§2.2). |
| $SoC_{0,i} \le 1 - D_i$ | `NOT_EVALUATED`, reason "initial state of charge is at or below the discharge limit". |
| an hour whose M1 is not FEASIBLE | all banks `NOT_EVALUATED` from that hour on; the hour and its M1 status code are named. Hours before it keep their values. |
| $P_i(h) < 0$ at any hour | that bank `NOT_EVALUATED`, reason as in §3.2. |
| no $j^*$ within 24 h | `NOT_DEPLETED`; report $E_{cum,i}(23)$ and the end state of charge $SoC_i(23)$. |
| otherwise | `DEPLETED`; report $t_{aut,i}$, the clock hour $h_{j^*}$ and the curve up to $j^*$. |

$SoC_i(j)$ is a post-processed sum. It is never fed back into any M1 run: each hour's M1 uses the same design and only the load scale of Eq. (12.9). So the hours stay uncoupled inside the model, and no state is added to it. This is the line between this feature and the excluded "detailed battery / dispatch".

Deferred [DESIGN CHOICE]: the minimum autonomy over all 24 start hours (a 24-fold reuse of the same 24 M1 results). Not in v1.

### 3.4 P11 — 24-hour profile run (rule unchanged, contract form changed)

Doc 12 §3.6, Eq. (12.9), FR-78, FR-79. Contract form in this repo (R2): a new M3b axis kind `LOAD_PROFILE_HOUR` with the fixed grid 0, 1, …, 23; at grid value $h$ the snapshot is the base design with every Load scaled by $\lambda_h$ (reuse the `LOAD_SCALE` branch of `convert.on_axis`). Touches `convert.grid`, `convert.on_axis`, `validation._axis_ok`, the Fake Engine payloads, S-10. No engine change. P11 is independent of B3 (R1) and is built last; it can be dropped without affecting B1–B3.

## 4. Contracts

### 4.1 Catalogue and BatteryBank

```
CatalogEntry.kind += "BATTERY_MODULE"
BatteryModuleValues {                     # all optional on the wire, like the other kinds
  energy_kwh, nominal_voltage_v, voltage_min_v, voltage_max_v,
  discharge_power_kw, c_rate_per_h, recommended_dod_ratio
}
BatteryBank {                             # Project-file field battery_banks[], 0..1 per inverter
  inverter_id,
  module: {catalog_ref, energy_kwh, voltage_min_v, voltage_max_v,
           discharge_power_kw | null, c_rate_per_h | null},   # values copied, as FR-69
  series_count (int >= 1), parallel_count (int >= 1),
  dc_efficiency_ratio | null (0 < x <= 1),
  depth_of_discharge_ratio | null (0 < x <= 1),
  initial_soc_ratio | null (0 < x <= 1)
}
```

Unit suffixes follow Doc 3 (`_v`, `_kwh`, `_kw`, `_ratio`); confirm `_per_h` against Doc 3 §1 at BESS-0. A second bank on one inverter, an unknown `inverter_id`, or a count below 1 is a stage-1 issue (new IssueCode `BATTERY_BANK_INVALID` with the field path, mirroring `CABLE_SETTINGS_INVALID`).

### 4.2 Analysis type `BA` (battery adequacy, app-side)

`POST /api/analyses/BA` through the existing pipeline (stage-1 validation, canonicalise and hash, dependency check, RunRecord), following ADR-014.

| Field | Rule |
|---|---|
| `depends_on` | An **M1** RunRecordRef, status FEASIBLE, with the three-part check of Doc 3 §5.4 (the existing M1 branch of `check_dependency`). Missing or stale → `UNAVAILABLE / DEPENDENCY_NOT_MET`. |
| `parameters` | `{banks: BatteryBank[], start_hour: int 0–23}`. The banks are sent here, not in `project_snapshot` (§2.1), so the RunRecord hashes them. |
| Power part (B2) | Computed from the `depends_on` M1 payload. No engine call. |
| Autonomy part (B3) | When the snapshot has a load profile: 24 M1 requests through the Engine Port (the execution guard), one per hour, each on the base snapshot with loads scaled by Eq. (12.9), same `solver_config` as the BA request. Stop at the first hour that is not FEASIBLE. |
| Allowed Status | FEASIBLE (request completed; per-bank outcomes in the payload), INPUT_INVALID, UNAVAILABLE. A `SHORT` or `DEPLETED` bank does not change the request status. |
| New ADR | **ADR-015** records the one difference from ADR-014: this app-side service calls the Engine Port. To settle there: engine identity in the RunRecord (recommended: recorded, because engine results are used, with `diagnostics.computed_by = "app"` and `diagnostics.engine_calls`); one overall TIME_BUDGET for the 24 calls (recommended: checked between calls, overrun → `UNAVAILABLE / TIMEOUT`); the FAKE marking when the Fake Engine served the calls. |

Payload:

```
banks[]: {
  inverter_id,
  bank: {series_count, parallel_count, module_count, energy_kwh},
  power: {outcome (OK | SHORT | NOT_EVALUATED), reason | null,
          capability_kw, capability_source ("discharge_power" | "c_rate"),
          inverter_p_kw, dc_side_power_kw, margin_kw},
  autonomy: {outcome (DEPLETED | NOT_DEPLETED | NOT_EVALUATED), reason | null,
             usable_energy_kwh, start_hour, autonomy_h | null, depletion_clock_hour | null,
             end_soc_ratio | null,
             curve[]: {step, clock_hour, inverter_p_kw, cumulative_energy_kwh, soc_ratio}}
}
hours[]: {clock_hour, lambda, m1_status, m1_status_code, system_frequency_hz | null}
caveat_text
```

Warnings: `BATTERY_POWER_SHORT` (per bank), `PROFILE_PEAK_ABOVE_LOADS` (existing code, when any $\lambda_h > 1$).

### 4.3 What must not change

`PsPayload`, `M1Payload`, `M2Payload`, `M3*`, `M4*`, the canonical snapshot and its hash, `engine/src/mgengine/**`, `tests/fixtures/canonical_vectors.json`. A golden comparison of the existing API responses before and after the round (as in the 2026-11-11 audit) must be byte-identical for a Project without banks.

## 5. UI

| Item | Spec |
|---|---|
| S-18 Catalogue | Entry kind "Battery module" with the fields of §4.1 and provenance; warning when both discharge power and C-rate are empty (FR-73). |
| S-04 Sizing advice | Module hint of FR-74 per selected module entry: admissible series range, module count, parallel count, installed energy, extra energy, verdict fit / no-fit / unknown / not evaluated. |
| S-05 Network editor | BatteryBank sub-form per Inverter: choose a module from the Catalogue, series and parallel counts, DC efficiency, depth of discharge (prefilled from the entry when it has one), initial SoC (prefilled 1.0). At most one bank per inverter. Editing a bank does not mark M1 stale (§2.1). |
| S-20 Battery adequacy (new, `/battery/`, under Further analyses) | Listed only when the Project has at least one bank; Run enabled only with a valid M1. Start-hour field (prefilled 0). Status banner, the fixed caveat, then one row per bank: power outcome with capability, DC-side power and margin; autonomy outcome with usable energy, autonomy in hours and the depletion clock hour, or the end SoC. Not-evaluated cells show the reason, never 0 or blank. |
| Depletion chart | "State of charge per inverter over the profile day": hand-written SVG on the shared chart foundation (FR-86), one series per bank told apart by marker and dash, a reference line at $1 - D_i$ per bank, crosshair (FR-89), "Show data", Download SVG (FR-92). x axis "hours from start"; y axis "state of charge (ratio)". |
| Status styling | Carbon support colours with icon and word: OK and NOT_DEPLETED neutral/green, SHORT and DEPLETED orange, NOT_EVALUATED grey. These are advisories: no red, no "Violated", no "Infeasible". |
| S-16 Report | Advisory section "Battery adequacy (advice, discharge only)": the table, the chart as a static figure, the caveat, RunRecord id. In the A1–A6 checklist the A2 row gains "battery not modelled; see the advisory section". |
| SLD | No battery symbol in v1 (Doc 12 §9 #15 stays: the model has no battery). The inverter hover card and Inspector gain one row "Battery bank: n_s × n_p of <module>" when a bank exists. |
| Glossary | Indonesian toggletips for: kedalaman pengosongan (DoD), keadaan muatan (SoC), otonomi, laju-C. Each needs a source (FR-91); a term without one is left out and listed as an open point. |
| Guided example | Unchanged. No bank and no profile are added to D2 or the guided example. |

## 6. Requirements (Doc 12 amendments, applied at round BESS-0)

| ID | Change |
|---|---|
| FR-73, FR-74 | Unchanged. |
| FR-75 | Reworded: at most one BatteryBank per Inverter, stored in the Project-file field `battery_banks`, **outside** the canonical snapshot; editing a bank changes no M1–M4 hash (§2.1). Fields per §4.1. |
| FR-76 | Reworded: the advisory is computed by the app-side battery service as analysis type `BA`, from the `depends_on` M1 payload, by Eq. (12.6)–(12.8); not in the engine, not in the M2 payload. |
| FR-77 | Reworded: no `BA` outcome changes any M1–M4 result, verdict or margin. |
| FR-78 | Reworded: M3b axis kind `LOAD_PROFILE_HOUR` (§3.4) instead of a special parameter path. |
| FR-79 | Unchanged. |
| FR-116 (new) | `POST /api/analyses/BA` through the pipeline; `depends_on` M1 FEASIBLE; allowed Status FEASIBLE, INPUT_INVALID, UNAVAILABLE; RunRecord per ADR-015. |
| FR-117 (new) | B3 autonomy per bank by Eq. (12.14)–(12.18), from 24 M1 requests through the Engine Port, with the outcomes and reasons of §3.3. |
| FR-118 (new) | Not-evaluated rules of §3.2 and §3.3: an empty $\eta_{dc}$, DoD or initial SoC gives `NOT_EVALUATED` with the field named; no default is applied. |
| FR-119 (new) | S-20 and the bank sub-form on S-05 (§5); S-20 is listed only when a bank exists. |
| FR-120 (new) | Depletion chart on S-20 and the report advisory section with the fixed caveat (§5). |
| FR-121 (new) | A Project without banks produces byte-identical API responses and hashes before and after this round (§4.3). |

Other Doc 12 edits: §2 list (B2 "app-side, analysis `BA`"; B3 added, level L3, Could; P11 note "independent of B3"); the "Deferred" line loses B3; §4 contract rows per §4 here; §5 UI rows per §5 here; §6 "analysis type `BA` on the existing route, no new path"; §9 #4 → "B3 in v1 as a per-inverter discharge-autonomy advisory (user 2026-11-12, replaces D-59 K106); no supervisor gate, one-line mention"; new open points for §2.1, §2.2 and the future-work list of §9 here; Log row; Ringkasan sentence. Doc 9: new decision row (E1–E9, R1–R7) and the K106 supersession. Doc 3 §9 #6: BatteryBank and the profile-hour axis no longer "postponed (D-62)". Doc 7: S-20, the gating row "valid M1 and at least one bank". Doc 11 rows.

## 7. Tests

| Level | Test |
|---|---|
| Unit (service) | ns_range_fit_and_empty; module_count_ceil; bank_power_field_vs_c_rate; power_margin_sign; usable_energy_formula; depletion_interpolates_within_hour; not_depleted_reports_end_soc; profile_wraps_past_midnight; missing_eta_dod_soc_not_evaluated; initial_soc_at_limit_not_evaluated; negative_inverter_power_not_evaluated |
| Contract (API, Fake Engine) | ba_depends_on_m1_missing_or_stale; ba_without_profile_power_only; ba_calls_engine_24_times_with_scaled_loads; ba_stops_at_first_non_feasible_hour; ba_status_feasible_with_short_bank; second_bank_on_inverter_invalid; m1_m2_hashes_unchanged_by_banks |
| Golden | no_bank_project_responses_byte_identical (§4.3) |
| Catalogue file | battery_module_roundtrip; module_without_power_capability_warns |
| P11 | hour_axis_24_points; no_profile_input_invalid; lambda_above_one_warns |
| Hand cases | V1–V6 of `BESS_VERIFICATION_FRAMEWORK.md` on the Real Engine, as regression fixtures with the fictitious module and profile files (`tests/fixtures/FAKE_battery_TEST_ONLY.json`). |
| E2E | s20_hidden_without_bank; run_shows_caveat; depletion_chart_show_data_row_count; report_section_names_run_record |

Test data is fictitious and named so. No real datasheet value enters the repo.

## 8. Rounds (one gate_log entry each)

| Round | Content | Engine needed |
|---|---|---|
| BESS-0 | Docs only: Doc 12 amendments of §6, Doc 9 decision row, ADR-015, Doc 3 / Doc 6 / Doc 7 / Doc 11 rows; settle the [CONFIRM] points §2.1 and §2.2 and the ids of R7 with the user; seam-6 exceptions for the new FRs. | — |
| BESS-1 | B1: catalogue kind `BATTERY_MODULE`, S-18 form, FR-74 hint on S-04. | Fake |
| BESS-2 | BatteryBank: Project-file field, S-05 sub-form, stage-1 rules. | Fake |
| BESS-3 | Service `services/battery/` power part, analysis `BA` (power only), S-20 table. | Fake, then Real |
| BESS-4 | Autonomy part: 24 M1 calls, Eq. (12.14)–(12.18), depletion chart, report section. | Fake, then Real |
| BESS-5 | Hand cases V1–V6 on the Real Engine, golden comparison, E2E, 200 % zoom check. | Real |
| BESS-6 (optional) | P11: axis kind `LOAD_PROFILE_HOUR`, S-10 hour mode. | Fake, then Real |

## 9. Future work (not built; for Bab 5 saran)

- **SoC-based droop**, as a quasi-static sequential run: within one hour the state of charge is nearly constant, so it only sets the P–ω droop gain of each inverter; M1 keeps its equations and receives different gain values; the hours are run in order, each hour's inverter power updating the state of charge for the next. This needs a new assumption (battery as an ideal energy reservoir with constant efficiency, state of charge constant within the hour) and couples the hours, so it is a scope change. The droop law must be taken from a verified source; the two candidate equations in the literature notes are marked UNVERIFIED-EQ and must not be used as they stand.
- Charging operating points (needs a modelled source such as PV).
- DC-link and battery dynamics in the small-signal and transient models (breaks A2).
- Minimum autonomy over all start hours; per-bank energy adequacy across several days.
- Lifetime, degradation and cost.

## 10. Before you start coding (checklist)

- [ ] §2.1 confirmed: banks outside the canonical snapshot.
- [ ] §2.2 confirmed: no default DoD; empty field → not evaluated.
- [ ] §2 R8 confirmed: fictitious test data, or real module, DC-window and profile data supplied by the user (closes D-62).
- [ ] Ids FR-116 – FR-121, D-106, ADR-015, S-20 confirmed or replaced.
- [ ] `schema_version` question for `battery_banks` settled against Doc 3 §8.
- [ ] Golden baseline of the current API responses saved before the first code change.
- [ ] Hand values of V1–V6 recomputed by the user from his own REAL M1 RunRecords (verification framework §4).

## 11. Prompt for Claude Code

```
Read docs/BESS_FEATURE_GUIDELINES.md and docs/BESS_VERIFICATION_FRAMEWORK.md fully, then
docs 03, 06, 07, 09 (D-59, D-62, D-102) and 12 (§1, §3.4 – §3.6, §9) and ADR-014.
Build the battery adequacy advisories exactly as specified, in rounds BESS-0 … BESS-5
(BESS-6 only if I ask), one gate_log entry per round.

Hard rules:
- Do not edit engine/src/mgengine/. If a step seems to need an engine change, stop and ask.
- No M1–M4 payload, canonical snapshot or hash may change. Save a golden baseline of the API
  responses first and compare after every round for a Project without banks.
- Advisory only: no outcome here changes a verdict, a margin or a limiting constraint.
- No default for DC efficiency, depth of discharge or initial state of charge on the server;
  an empty field gives NOT_EVALUATED with the reason.
- No vendor data and no real datasheet values in the repo or in tests; fixtures are
  fictitious, with TEST_ONLY in the file name.
- Start with BESS-0 (docs only) and put the [CONFIRM] points of §2.1, §2.2 and §2 R8, the ids of
  §2 R7 and the schema_version question to me before writing code.
- Unit and contract tests first (TDD), on the Fake Engine; hand cases V1–V6 on the Real Engine
  in BESS-5. Expected values come from the verification framework and from my own hand
  calculation, never from the code under test.
Stop and ask if any rule here conflicts with docs 03, 06, 07, 09 or 12.
```

## Log

| Date | Change |
|---|---|
| 2026-11-12 | Drafted from the design session of 2026-11-12 (decisions E1–E9) and a read of the repo at `9d14e6e` (findings R1–R7). Per-inverter power source changed from a P11 result to direct M1 requests (R1); BatteryBank moved outside the canonical snapshot and the DoD default dropped, both awaiting confirmation (§2.1, §2.2). |
| 2026-11-12 | BESS-0: §2.1, §2.2 and R8 confirmed by the user as recommended (Doc 9 D-106 K304, K305, K307); `schema_version` question settled: `battery_banks` optional, omitted when empty, version stays 1 (K306); ids FR-116 – FR-121, D-106, ADR-015 (proposed), S-20 used as in R7. |
