# 12 — Post-proposal extensions

> Doc 12 of the doc set (added 2026-11-01, after the seminar proposal). Inputs: final seminar-proposal manuscript (`Seminar.pdf`, 28-10-2026, wins on any conflict), Docs 02, 03, 06, 07, and the extension decisions of the 2026-10-31/11-01 design sessions. This document is kept separate from Docs 01–11 until those are aligned with the manuscript; it is merged into them when stage 1.5 is planned. Equations are allowed in design documents (user decision 2026-11-01, cancelling the no-equation rule DR-08); author-derived formulas are marked "diturunkan dalam penelitian ini" when they move into the skripsi. Equation numbers (12.x) are local to this document.

## Ringkasan

Dokumen ini memuat sepuluh fitur tambahan yang disepakati setelah seminar proposal. Semua fitur wajib tetap berada di dalam asumsi A1–A6 dan batasan naskah: fitur hanya boleh berupa perubahan antarmuka dan alur kerja, keluaran turunan dari model yang sama, atau mode baru yang menyusun ulang M1–M4, tanpa persamaan, variabel keadaan, atau asumsi baru. Tiga fitur berprioritas Should, yaitu panel indikator keabsahan, daftar periksa asumsi A1–A6 pada laporan, dan katalog komponen yang diisi pengguna dari datasheet; tujuh lainnya berprioritas Could. Bagian yang hanya menyentuh antarmuka mulai dikerjakan pada Tahap 1.2 dengan Fake Engine, sedangkan bagian yang memerlukan mesin nyata dikerjakan setelah gerbang 1.4. Tidak ada fitur tambahan yang boleh menunda gerbang Must atau Should dari naskah. Faktor partisipasi dan metrik stabilitas per titik sapuan tidak termasuk di sini karena sudah dijanjikan naskah; keduanya masuk daftar penyelarasan inti. Aplikasi tidak membawa data vendor bawaan, sehingga katalog tidak menjadi sumber rujukan skripsi.

---

## 1. Admission rule and conventions

| Item | Rule |
|---|---|
| Admission test | An extension is admitted only if it is (L1) UI/workflow over existing contracts, (L2) a derived output computed from quantities the model already produces, or (L3) a new mode composed of existing analyses (M1–M4). It adds no equation, state variable or assumption to the engine model. |
| Priority | Should / Could, on top of the manuscript baseline (60 FR: 38 Must, 21 Should, 1 Could). No extension may delay a Must or Should gate of the manuscript. |
| Phasing | L1 parts from stage 1.2 on the Fake Engine; L2/L3 parts after gate 1.4 (Real Engine adapter installed). |
| IDs | New requirements continue the FR numbering: FR-61 onward. Screen S-18 is new. One endpoint is new (§6). |
| Not extensions | P8 participation factors (manuscript Eq. 4.21) and P10 stability metrics per sweep point (manuscript 4.2.9, 4.3.4) are core alignment items (§8). |
| Manuscript constants used here | TIME_BUDGET 30 s, SWEEP_CAP 1 000 points, MARGIN_WARN normalised margin 0.05 (manuscript 4.1.3; replaced by measurements at work packages 1.4.3 and 1.7.1). |

## 2. Extension list

| Code | Extension | Level | Priority | First stage | FR |
|---|---|---|---|---|---|
| P1 | Validity-indicator panel | L1 | Should | 1.2 (Fake) | FR-61, FR-62 |
| P6 | A1–A6 checklist in the report | L1 | Should | 1.2 (Fake) | FR-63 |
| K | User-filled component catalogue (GFM inverter, conductor) | L1 | Should | 1.2 | FR-64 – FR-72 |
| B1 | Battery-module catalogue entries and PS module hint | L1 | Could | 1.2 | FR-73, FR-74 |
| B2 | Battery power-adequacy advisory (BatteryCheck) | L2 | Could | after 1.4 | FR-75 – FR-77 |
| P11 | 24-hour profile run | L3 | Could | after 1.4 | FR-78, FR-79 |
| P12 | Static N−1 inverter check | L1 (via M3c) | Could | 1.2 (Fake), real after 1.4 | FR-80 |
| P9 | Reactive-power sharing error | L2 | Could | after 1.4 | FR-81, FR-82 |
| P3 | RunRecord diff | L1 | Could | 1.2 | FR-83 |
| P7 | Limiting-constraint → M3a shortcut | L1 | Could | 1.2 | FR-84 |
| P2 | Example Projects | L1 | Could | 1.2 (fixtures), values checked after 1.4 | FR-85 |

Deferred (not in v1): B3 per-inverter 24-h energy adequacy (only with supervisor approval, because it sits close to the excluded "detailed battery/dispatch"), batch M4b over all inverter outages, CSV import/export, p.u. ↔ physical display toggle.

---

## 3. Functional requirements

### 3.1 P1 — Validity-indicator panel

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-61 | Result screens of M1, M4a and M4b and the report shall show a panel with the four validity indicators r_τ, κ, r_in and ε_X, each with the assumption it checks (A1, A1, A2, A4) and its value. | Should | **E2E:** given a Fake result carrying all four indicators, the panel lists four rows with assumption and value; an indicator that is not evaluated (e.g. r_in without τ_in, r_τ and κ without line resistance) shows "not evaluated" with the reason, never a blank or zero. | Manuscript 4.2.7, Tabel 4.5 |
| FR-61a | Indicator definitions are those of the manuscript, not new ones: $\varepsilon_X = |\omega_s-\omega^*|/\omega^*$ (Eq. 4.1) and $T_\ell = X_\ell/(\omega^* R_\ell)$ with $r_\tau$, $\kappa$, $r_{in}$ exactly as in Eq. 4.23 (copy from the PDF when merging into Doc 3; the text extraction of Eq. 4.23 is garbled). The panel only displays engine output. | Should | Contract test: panel values equal the engine payload without client-side recomputation. | Manuscript Eq. 4.1, 4.23 |
| FR-62 | Until thresholds are calibrated (stage 1.6), the panel shall show raw values with the label "threshold not yet calibrated" and no pass/warn colour; after calibration it shall show a three-level colour role plus icon and word, with the threshold version. | Should | Given a MetaInfo with no threshold version, then no colour role is applied and the label is present; given a threshold version, then each row carries a level word and the version id. | Manuscript 4.2.7 |

### 3.2 P6 — A1–A6 checklist in the report

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-63 | The report shall contain a checklist of A1–A6 stating for each assumption how it is handled: by construction (A2, A5, A6), checked by an indicator (A1 via r_τ and κ, A2 via r_in, A4 via ε_X), or user-set and explored by sweep (A3), with the indicator values of the cited runs. | Should | **E2E:** given a report with M1 and M4a results, six rows are shown, each with its handling category; indicator rows carry the value and RunRecord hash of the run they come from. | Manuscript Tabel 1.1, 4.2.7 |

### 3.3 K — Component catalogue

Scope of catalogue entries: GFM inverter and conductor (Should); battery module (Could, §3.4). PV, PV inverters (grid-following), diesel, transformers and protection devices are not catalogued because the model does not represent them. The application ships no vendor data and no example entries; the Catalogue starts empty (Doc 9 D-59 K107). Conductor tables from an official standard are postponed (not in this version of the extension).

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-64 | The app shall create, edit, save and open a Catalogue as one JSON file with its own `schema_version`, independent of any Project. | Should | Given a Catalogue with entries, when saved and reopened, then the documents are equal; a newer or unmigratable version is refused without changing the open Catalogue (same rules as FR-56/FR-57). | Session decision Q30 |
| FR-65 | Every catalogue entry shall carry provenance: manufacturer and model as entered by the user, datasheet title or document id, revision or date, and page/section for each value used by the model. | Should | Given an entry without provenance for a value the model uses, when it is selected for a Project, then the selection is refused with a message naming the missing field. | Session decision Q29 |
| FR-66 | An inverter entry shall be selectable as an Inverter only if it declares grid-forming capability with a datasheet reference and gives its droop setting ranges; otherwise it may be stored as information only. | Should | Given an entry without the grid-forming declaration, when "Use in Project" is requested, then it is refused with the reason; the entry stays in the Catalogue. | Session decision Q31 |
| FR-67 | Inverter entry fields used by the model: rating (kVA), nominal line voltage (kV) and frequency (Hz), droop setting ranges; optional inner-loop time constant or bandwidth (feeds τ_in for r_in, FR-71). Fields stored and shown but not used by the model, each labelled "not used by the model (A2)": overload capability, current limit, output filter data, efficiency, DC input window (used only by B1, FR-74). | Should | Given an inverter entry, when shown, then every unused field carries the A2 label and no unused field appears in an AnalysisRequest. | Manuscript A2; Q31 |
| FR-68 | Conductor entry fields: resistance and reactance per length (Ω/km) at stated conditions, current-carrying capacity (A) with its reference installation conditions; shunt capacitance stored but labelled "not used by the model (A4)". | Should | Given a conductor entry, when used for a Line, then r and x fill the Line fields and the capacitance is not sent. | Manuscript A4 |
| FR-69 | Selecting an entry for an Inverter or Line shall copy its values into the Project together with a `catalog_ref` (entry id, provenance, catalogue `schema_version`); later catalogue changes shall not change the Project. Editing a copied value shall mark the element "modified from catalogue". | Should | Given a Line filled from an entry, when the catalogue entry is edited, then the Project snapshot hash is unchanged; when the user edits r in the Project, then the element shows the modified marker and `catalog_ref` is kept. | Q29; FR-48 hash rule |
| FR-70 | A conductor's current-carrying capacity shall pre-fill the Line current limit only after explicit user confirmation, labelled "datasheet reference conditions"; without confirmation the limit stays empty and M2 reports it "not evaluated". | Should | Given a Line filled from an entry and no confirmation, when M2 runs, then the line-current check is "not evaluated"; after confirmation the limit is present with the label. | Manuscript 4.2.4 (thermal limit is user-set); Q36 |
| FR-71 | An inverter entry's optional inner-loop time constant shall pre-fill the optional τ_in parameter of M4a, editable, with its provenance shown. | Should | Given an entry with τ_in, when M4a is prepared, then τ_in is pre-filled and r_in becomes evaluable; given none, then r_in stays "not evaluated". | Manuscript 4.2.7; Q37 |
| FR-72 | After a PS result, the sizing screen shall list catalogue inverter entries with rating at least the suggested unit rating as a hint; the PS numbers themselves shall not change and no automatic rounding to catalogue ratings shall occur. | Should | Given a SizingAdvice and a catalogue with three inverter entries of which two meet the unit rating, then two are listed as hints and the SizingAdvice values are byte-identical to before. | Manuscript 4.2.2; Q35 |

### 3.4 B1 — Battery-module entries and PS hint

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-73 | The Catalogue shall accept battery-module entries: nominal energy (kWh), nominal and min/max DC voltage (V), continuous discharge power (kW) and/or C-rate, optional recommended depth of discharge, each with provenance. | Could | Given a module entry missing both continuous discharge power and C-rate, when saved, then it is stored with a warning that B2 cannot use it. | Q43 |
| FR-74 | When PS returns a storage energy, the sizing screen shall show, per selected module entry, the admissible series counts, the module count and the parallel count of Eq. (12.3)–(12.5), with a fit/no-fit/unknown verdict for the DC window of the selected inverter entry; PS numbers shall not change. | Could | Given a PS energy and one module entry, then the hint shows whole counts and a verdict; an empty series range gives "no-fit"; a missing DC window gives "unknown"; SizingAdvice is unchanged. | Q43, Q35 |

**B1 hint rule.** With $E_{nom}$ the PS nominal storage energy (kWh, manuscript Eq. 4.13), $E_{mod}$ the module energy (kWh), $V_{mod}^{min}, V_{mod}^{max}$ the module DC voltage limits (V) and $V_{dc}^{min}, V_{dc}^{max}$ the inverter DC input window (V):

$$n_s \in \mathcal{N}_s = \left\{\, n \in \mathbb{Z}_{\ge 1} \;:\; n\,V_{mod}^{min} \ge V_{dc}^{min},\; n\,V_{mod}^{max} \le V_{dc}^{max} \right\} \tag{12.3}$$

$$N_{mod} = \left\lceil \frac{E_{nom}}{E_{mod}} \right\rceil \tag{12.4}$$

$$n_p = \left\lceil \frac{N_{mod}}{n_s} \right\rceil, \qquad N_{inst} = n_s\, n_p \tag{12.5}$$

The verdict is "fit" when $\mathcal{N}_s \neq \emptyset$ (the hint uses its smallest element unless the user picks another), "no-fit" when empty, "unknown" when either window is missing. $N_{inst} \ge N_{mod}$; the extra energy is shown. Diturunkan dalam penelitian ini.

### 3.5 B2 — Battery power-adequacy advisory

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-75 | The app shall let the user attach at most one BatteryBank to each Inverter: a catalogue module reference plus series and parallel counts, optional DC conversion efficiency. BatteryBank is design data. | Could | Given an Inverter, when a second bank is attached, then it is refused; editing a bank marks the M1 result stale (Q47: the M1 hash covers the whole design snapshot). | Q44, Q47 |
| FR-76 | The M2 result shall carry an advisory `battery_check` per Inverter with a bank, computed in the engine by Eq. (12.6)–(12.8): bank capability, DC-side power, margin and a warning flag, with the capability source (power field or C-rate) and the efficiency assumption recorded. | Could | Given a canned M2 result with two banks, one below the inverter power, then `battery_check` has two entries, one flagged, each naming its Inverter and capability source. | Q45, Q46 |
| FR-77 | `battery_check` shall never change the M2 verdict, `limiting_constraints` or margins; it is advisory like SizingCheck. | Could | Given an M2 `FEASIBLE` result with a flagged bank, then status stays `FEASIBLE` and the flag appears only in `battery_check` and in the report's advisory section. | Q43 (b), Q11 policy |

**B2 rule.** For Inverter $i$ with a bank of $n_{s,i}$ modules in series and $n_{p,i}$ strings in parallel, module continuous discharge power $P_{mod}^{dis}$ (kW), module energy $E_{mod}$ (kWh) and C-rate $C$ (h⁻¹):

$$P_{bank,i} = \begin{cases} n_{s,i}\, n_{p,i}\, P_{mod}^{dis} & \text{if } P_{mod}^{dis} \text{ is given} \\ C\, n_{s,i}\, n_{p,i}\, E_{mod} & \text{otherwise} \end{cases} \tag{12.6}$$

$$P_{dc,i} = \frac{P_i}{\eta_{dc,i}}, \qquad \eta_{dc,i} \text{ required; when absent the check is not evaluated (Doc 9 D-59 K105)} \tag{12.7}$$

$$m_{bat,i} = P_{bank,i} - P_{dc,i}, \qquad \text{warning} \iff m_{bat,i} < 0 \tag{12.8}$$

with $P_i$ the inverter active power at the M1 operating point (kW, positive when delivering). Total bank power counts every module ($n_s n_p$), because a series string delivers the module current at $n_s$ times the module voltage. The check reads a power capability only; it adds no state, no SoC and no limit to the model (A2 unchanged). Diturunkan dalam penelitian ini.

*Correction to the session wording of Q45:* the capability uses $n_s n_p$ modules, not $n_p$ alone, because the catalogue field is a per-module power.

### 3.6 P11 — 24-hour profile run

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-78 | M3b shall accept the special parameter path `load_profile_hour` with range 0–23 and 24 steps; for each hour every Load is scaled by Eq. (12.9), the same pattern as the λ scaling of M2 (manuscript Eq. 4.14). | Could | Given a Project with a 24-point profile, when M3b runs on `load_profile_hour`, then 24 points are returned, each with its own Status; given no profile, then `INPUT_INVALID` naming the profile. | Manuscript 4.2.2, Eq. 4.14 pattern; Q13, Q14, Q34 |
| FR-79 | The P11 result view shall label the axis "hour", report the worst hour per key metric and the first hour that is not `FEASIBLE`, and warn when any $\lambda_h > 1$ (profile peak above table total), as PS does. | Could | **E2E:** given a canned 24-point result, the worst hour per metric and the first infeasible hour are shown; $\lambda_h > 1$ shows the warning. | Manuscript 4.2.2 |

**P11 rule.** With $P_h$ the profile active power at hour $h$ (kW) and $P_k^0, Q_k^0$ the table values of Load $k$:

$$\lambda_h = \frac{P_h}{\sum_k P_k^0}, \qquad P_k(h) = \lambda_h P_k^0, \quad Q_k(h) = \lambda_h Q_k^0, \qquad h = 0,\dots,23 \tag{12.9}$$

Each hour is an independent M1 (and M2) run; there is no coupling between hours and no storage state, consistent with A1 and with the exclusion of dispatch. $\sum_k P_k^0 > 0$ is guaranteed by stage-1 validation. Diturunkan dalam penelitian ini.

### 3.7 P12 — Static N−1 inverter check

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-80 | The app shall generate, for a design with two or more Inverters, one Scenario per Inverter with that Inverter removed, and send them with the base design as one M3c request; with one Inverter the action is disabled with the message "N−1 needs at least two inverters". The scenario count is bounded by SCENARIO_CAP. | Could | Given three Inverters, then the M3c request carries four snapshots (base plus three) and the result lists a Status per removed Inverter; no engine contract change is required. | Manuscript 4.2.2 (N−1 option of PS); Q15 |

### 3.8 P9 — Reactive-power sharing error

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-81 | The M1 payload shall add a `sharing` group per Inverter by Eq. (12.10)–(12.12): Q and P deviations from rating-proportional sharing, normalised errors, and the flag of Eq. (12.13). | Could | Given a canned M1 result, then `sharing` has one entry per Inverter with deviations (kvar, kW), normalised errors (p.u. of rating) and the flag. | Q10 |
| FR-82 | `MAX_Q_SHARING_ERROR` ($e_Q^{max}$, Eq. 12.12) shall be added to the output-metric enum of M3a/M3b/M3c; it shall not be a design constraint and shall not affect M2. | Could | Given an M3b request with this metric, then each point carries it; DesignConstraints has no field for it. | Q11 |

**P9 rule.** With $Q_i, P_i$ the outputs of Inverter $i$ at the M1 operating point and $S_{r,i}$ its rating (kVA), over the set $\mathcal{G}$ of Inverters:

$$Q_i^{ideal} = \frac{S_{r,i}}{\sum_{j\in\mathcal{G}} S_{r,j}} \sum_{j\in\mathcal{G}} Q_j, \qquad \Delta Q_i = Q_i - Q_i^{ideal} \tag{12.10}$$

$$P_i^{ideal} = \frac{S_{r,i}}{\sum_{j\in\mathcal{G}} S_{r,j}} \sum_{j\in\mathcal{G}} P_j, \qquad \Delta P_i = P_i - P_i^{ideal} \tag{12.11}$$

$$e_{Q,i} = \frac{|\Delta Q_i|}{S_{r,i}}, \quad e_{P,i} = \frac{|\Delta P_i|}{S_{r,i}}, \qquad e_Q^{max} = \max_{i\in\mathcal{G}} e_{Q,i} \tag{12.12}$$

$$\text{flag}_i \iff \frac{\left|\, n_{q,i} S_{r,i} - \overline{n_q S_r} \,\right|}{\overline{n_q S_r}} > 10^{-6}, \qquad \overline{n_q S_r} = \frac{1}{|\mathcal{G}|}\sum_{j\in\mathcal{G}} n_{q,j} S_{r,j} \tag{12.13}$$

$\Delta P_i$ is close to zero in steady state when $m_{p,i} S_{r,i}$ is equal across inverters and the setpoints match (common $\omega$, manuscript Eq. 4.5), so it serves as a consistency check; $\Delta Q_i$ is non-zero in general because the local voltages differ through the line impedances, which is the known weakness of Q–V droop. With one inverter all deviations are zero by definition. The flag tolerance $10^{-6}$ is a numerical-equality tolerance, not an engineering threshold. Diturunkan dalam penelitian ini.

### 3.9 P3, P7, P2

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-83 | Run history shall compare two RunRecords: input-snapshot differences listed by JSON path, and key-metric differences with units; computed in the client, no endpoint. | Could | **E2E:** given two RunRecords differing in one Line resistance, the diff lists that path and the changed metrics. | Q18; ADR-010 |
| FR-84 | Each limiting-constraint row in M2 shall offer "Most influential parameters", which opens M3a pre-filled with all Inverter ratings and droop gains plus R and X of the limiting Line (when the constraint is on a Line), and the metric matching the constraint kind (voltage → MIN/MAX_BUS_VOLTAGE, frequency → SYSTEM_FREQUENCY, loading → MAX_INVERTER_LOADING, current → MAX_LINE_CURRENT); the user may edit before running. | Could | **E2E:** clicking the shortcut on a line-current row opens S-09 with those parameters and MAX_LINE_CURRENT selected; nothing runs until the user presses Run. | Q17 |
| FR-85 | The Start screen shall offer read-only example Projects: reference designs D1, D2, D2S, D2H and the two-inverter manual-calculation case; opening one creates a new unsaved Project copy. The same files serve as regression fixtures. | Could | Given the example list, when D2 is opened, then a new Project with D2 data exists and the example file is unchanged. | Manuscript Tabel 4.13, Tabel 4.8; Q19 |

---

## 4. Contract changes (merge into Doc 3 at stage 1.5)

| Item | Change |
|---|---|
| Catalogue document | New file type, own `schema_version`; entries of kind INVERTER, CONDUCTOR, BATTERY_MODULE with provenance (FR-64 – FR-68, FR-73). |
| `catalog_ref` | Optional object on Inverter and Line (and on BatteryBank module): entry id, provenance, catalogue schema version, `modified` flag (FR-69). Part of the canonical snapshot. |
| BatteryBank | New optional design entity, 0..1 per Inverter: module `catalog_ref` with copied values, series count, parallel count, optional DC efficiency (FR-75). |
| M2 payload | New optional group `battery_check`: per Inverter {capability_kw, capability_source, dc_side_power_kw, margin_kw, warning, assumptions} (FR-76); `not_evaluated` reason when η_dc is absent (D-59 K105). |
| M1 payload | New group `sharing`: per Inverter {p_deviation_kw, q_deviation_kvar, q_droop_not_rating_proportional} (FR-81). |
| M3 metrics | Add `MAX_Q_SHARING_ERROR` (FR-82). |
| M3b parameter path | Add special path `load_profile_hour` (FR-78). |
| Indicators | Payload groups for r_τ, κ, r_in, ε_X with `evaluated` flag and reason (FR-61); threshold version in MetaInfo (FR-62). Align with the core indicator contract (§8). |

## 5. UI changes (merge into Doc 7)

| Screen | Change |
|---|---|
| S-18 Catalogue (new, `/catalogue/`) | Open, save, add, edit entries; provenance form; grid-forming guard; information-only marker. |
| S-05 Network editor | "Choose from catalogue" on Inverter and Line rows; "modified from catalogue" marker; current-limit confirmation; BatteryBank sub-form per Inverter (Could). |
| S-04 Sizing advice | Catalogue hints (FR-72), module hint (FR-74). |
| S-07, S-13, S-14, S-16 | Validity-indicator panel (FR-61, FR-62). |
| S-08 | Shortcut per limiting-constraint row (FR-84); BatteryCheck advisory panel (FR-76). |
| S-10 | Hour mode (FR-79). |
| S-11 | "Generate N−1 scenarios" action (FR-80). |
| S-15 | Compare two RunRecords (FR-83). |
| S-16 | A1–A6 checklist (FR-63); advisory section lists BatteryCheck. |
| S-01 | Example Projects (FR-85). |

## 6. API changes (merge into Doc 6)

| # | Method | Path | Purpose |
|---|---|---|---|
| 16 | POST | `/api/catalogs/import` | Check a Catalogue file's content: `schema_version`, forward migration, rejection, entry validation (provenance, grid-forming guard). HTTP 200 with a FileCheckResult wrapper; no RunRecord. |

Catalogue export is a client-side download, like Project export. No other endpoint is added: P12 reuses M3c, P11 reuses M3b, P3 and P7 are client-side.

## 7. Test additions (merge into Doc 8)

| FR | Level | Test |
|---|---|---|
| FR-61, FR-62 | API + E2E | indicators_not_evaluated_have_reason; uncalibrated_label_no_colour |
| FR-64 – FR-72 | Catalogue file + E2E | catalogue_roundtrip; newer_version_refused; gfm_guard_refuses_use; copy_keeps_hash_on_catalogue_edit; current_limit_needs_confirmation; ps_values_unchanged_by_hints |
| FR-75 – FR-77 | API (Fake) | battery_check_per_bank; c_rate_fallback_named; verdict_unaffected_by_battery_flag; bank_edit_marks_m1_stale |
| FR-78, FR-79 | API (Fake) | hour_sweep_24_points; no_profile_input_invalid |
| FR-80 | API (Fake) + E2E | n_minus_1_builds_scenarios; single_inverter_disabled |
| FR-81, FR-82 | API (Fake) | sharing_group_present; metric_not_a_constraint |
| FR-83 – FR-85 | E2E | diff_lists_paths; shortcut_prefills_m3a; example_opens_as_copy |

## 8. Core alignment items moved out of this document

| Item | Why it is core | Decisions kept |
|---|---|---|
| P8 participation factors in M4a | Manuscript Eq. 4.21; reported only when the eigenvector matrix is well conditioned. | Full mode × state matrix; UI heatmap grouped by state kind (δ, P_f, Q_f) per inverter, with a numeric table for accessibility (Q16, Q25). |
| P10 stability metrics per sweep point | Manuscript 4.2.9 (1 824 points with M4a at every admissible point) and 4.3.4 (contract gap). | Scalar metrics ζ_min and Re λ_dom per point plus optional `include_eigenvalues` for a root-locus plot (Q12). No separate cap: the manuscript sets SWEEP_CAP = 1 000 to fit its largest 2-D sweep (891 points) with M4a at every admissible point, so a smaller M4 cap would contradict the parametric study. TIME_BUDGET (30 s) is re-measured at work package 1.4.3; if an M4-coupled sweep overruns it, the result is `UNAVAILABLE / TIMEOUT` as specified, and the measured value replaces the initial one. |

## 9. Open points

| # | Item | Tag |
|---|---|---|
| 1 | Conductor tables from an official standard: postponed by the user (2026-11-01). | POSTPONED |
| 2 | Eq. (12.3)–(12.13) are author-derived; they enter the skripsi marked "diturunkan dalam penelitian ini" and are verified by hand calculation on D2 before use. Their features (B1, B2, P11, P9) follow the Should extensions (D-59 K104). | DECIDED (user 2026-11-02) |
| 3 | Cancelling DR-08 deviates from the manuscript's documentation requirement (Tabel A.3, "no equations in application design documents"); record the change in the alignment list and in the skripsi methodology. | KONFLIK (user-decided) |
| 4 | B3 energy adequacy: out of v1 (D-59 K106). | DECIDED (user 2026-11-02) |
| 5 | Example catalogue entries: none shipped (D-59 K107). | DECIDED (user 2026-11-02) |

## Log

| Date | Change |
|---|---|
| 2026-11-01 | Created from the post-seminar design session (decisions Q1–Q48). |
| 2026-11-01 | DR-08 cancelled by the user: formulas added (Eq. 12.3–12.13, indicator definitions referenced to the manuscript); B2 capability corrected to count $n_s n_p$ modules; standard conductor tables postponed; separate M4 sweep cap dropped in favour of manuscript SWEEP_CAP 1 000. |
| 2026-11-02 | Q-22 settled (Doc 9 D-59): Could features with Eq. 12.x after the Should ones; B2 requires η_dc (Eq. 12.7); B3 out of v1; no example catalogue entries. |
