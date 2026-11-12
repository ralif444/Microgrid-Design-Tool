# 12 — Post-proposal extensions

> Doc 12 of the doc set (added 2026-11-01, after the seminar proposal). Inputs: final seminar-proposal manuscript (`Seminar.pdf`, 28-10-2026, wins on any conflict), Docs 02, 03, 06, 07, and the extension decisions of the 2026-10-31/11-01 design sessions. This document is kept separate from Docs 01–11 until those are aligned with the manuscript; it is merged into them when stage 1.5 is planned. Equations are allowed in design documents (user decision 2026-11-01, cancelling the no-equation rule DR-08); author-derived formulas are marked "diturunkan dalam penelitian ini" when they move into the skripsi. Equation numbers (12.x) are local to this document.

## Ringkasan

Dokumen ini memuat sepuluh fitur tambahan yang disepakati setelah seminar proposal. Semua fitur wajib tetap berada di dalam asumsi A1–A6 dan batasan naskah: fitur hanya boleh berupa perubahan antarmuka dan alur kerja, keluaran turunan dari model yang sama, atau mode baru yang menyusun ulang M1–M4, tanpa persamaan, variabel keadaan, atau asumsi baru. Tiga fitur berprioritas Should, yaitu panel indikator keabsahan, daftar periksa asumsi A1–A6 pada laporan, dan katalog komponen yang diisi pengguna dari datasheet; tujuh lainnya berprioritas Could. Bagian yang hanya menyentuh antarmuka mulai dikerjakan pada Tahap 1.2 dengan Fake Engine, sedangkan bagian yang memerlukan mesin nyata dikerjakan setelah gerbang 1.4. Tidak ada fitur tambahan yang boleh menunda gerbang Must atau Should dari naskah. Faktor partisipasi dan metrik stabilitas per titik sapuan tidak termasuk di sini karena sudah dijanjikan naskah; keduanya masuk daftar penyelarasan inti. Aplikasi tidak membawa data vendor bawaan, sehingga katalog tidak menjadi sumber rujukan skripsi. Putaran UX dan analitik (2026-11-03, X0–X7) menambah delapan fitur antarmuka murni: hasil terakhir yang bertahan saat berpindah layar, fondasi grafik, kartu KPI, grafik analitik, *crosshair*, panel inspektur, tooltip glosarium, dan unduhan SVG; semuanya hanya menampilkan payload yang sudah ada. Diagram segaris otomatis (X8, FR-94 – FR-98) menggantikan diagram lingkaran di S-05 dan menambah tooltip, lapisan hasil di S-07 dan S-08, gambar laporan, serta unduhan SVG, tanpa simbol untuk komponen yang tidak dimodelkan. Mode contoh terpandu (X9, FR-99 – FR-104) mengisi formulir analisis dari contoh D2 beserta sumber setiap nilai, tanpa mengubah model atau file Project. Penentuan ukuran kabel dan proteksi beban lebih (X10, FR-105 – FR-115) bersifat eksperimental di balik *flag* `feature_cable_sizing`; perhitungannya dilakukan aplikasi, bukan mesin (ADR-014), memakai tabel yang dimuat pengguna, dan dua KONFLIK terhadap naskah (proteksi di luar cakupan; PUIL 2011 terhadap PUIL 2020) masih terbuka. Putaran baterai (BESS-0, 2026-11-12, FR-116 – FR-121, ADR-015) menghidupkan kembali B1 dan B2 serta memasukkan B3 ke v1 sebagai saran otonomi pengosongan per inverter: analisis `BA` dihitung aplikasi dari hasil M1, bank baterai berada di luar snapshot kanonik, pengisian ulang tidak dimodelkan, dan tidak ada putusan M1–M4 yang berubah.

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
| B2 | Battery power-adequacy advisory (app-side, analysis `BA`) | L2 | Could | Battery round (2026-11-12) | FR-75 – FR-77, FR-116, FR-118 – FR-121 |
| B3 | Per-inverter discharge autonomy over the 24-hour profile (app-side, analysis `BA`) | L3 | Could | Battery round (2026-11-12) | FR-117 – FR-121 |
| P11 | 24-hour profile run (independent of B3) | L3 | Could | after 1.4 | FR-78, FR-79 |
| P12 | Static N−1 inverter check | L1 (via M3c) | Could | 1.2 (Fake), real after 1.4 | FR-80 |
| P9 | Reactive-power sharing error | L2 | Could | after 1.4 | FR-81, FR-82 |
| P3 | RunRecord diff | L1 | Could | 1.2 | FR-83 |
| P7 | Limiting-constraint → M3a shortcut | L1 | Could | 1.2 | FR-84 |
| P2 | Example Projects | L1 | Could | 1.2 (fixtures), values checked after 1.4 | FR-85 |
| X0 | Latest result per analysis survives leaving a screen | L1 | Should | UX round (2026-11-03) | FR-93 |
| X1 | Shared chart foundation (scales, axes, data-table toggle, gallery) | L1 | Should | UX round | FR-86 |
| X2 | KPI strip per result | L1 | Should | UX round | FR-87 |
| X3 | Analytics charts per analysis | L1 | Should | UX round | FR-88 |
| X4 | Pointer and keyboard crosshair with exact values | L1 | Should | UX round | FR-89 |
| X5 | Inspector panel for Bus, Line, Inverter | L1 | Should | UX round | FR-90 |
| X6 | Glossary toggletips and the glossary on S-17 | L1 | Could | UX round | FR-91 |
| X7 | Chart download as SVG with caption metadata | L1 | Could | UX round | FR-92 |
| X8 | Automatic single-line diagram: symbols, tooltip, result overlay, report figure, SVG export | L1 | Could | SLD round (2026-11-03, after UX-2) | FR-94 – FR-98 |
| X9 | Guided example mode (design D2): prefilled analysis forms, guidance, example disturbances | L1 | Should (FR-104 Could) | Example round (2026-11-05, after UX-12) | FR-99 – FR-104 |
| X10 | Cable and overload-protection sizing (experimental, behind a feature flag) | L2 | Could | Cable round (2026-11-08, after gate 1.4) | FR-105 – FR-115 |

X0–X7 are the UX and analytics round of `docs/UX_ANALYTICS_GUIDELINES.md` (decisions Q1–Q7 there, Doc 9 D-72). The guideline calls them U0–U7; they are coded X here because U1–U4 already name the user groups (Doc 1 §6, Doc 11). All eight are presentation only: no payload, contract, API or Engine Port change, and the browser computes no engine number (it only selects, counts, sorts, filters and rounds for display).

B1, B2, B3 and P11 follow `docs/BESS_FEATURE_GUIDELINES.md` (decisions E1–E9 and BESS-0 confirmations in Doc 9 D-106; computation placement in ADR-015).

Deferred (not in v1): batch M4b over all inverter outages, CSV import/export, p.u. ↔ physical display toggle.

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
| FR-75 | (Reworded 2026-11-12, D-106) The app shall let the user attach at most one BatteryBank to each Inverter, stored in the optional Project-file field `battery_banks` **outside** the canonical snapshot used by M1–M4: module `catalog_ref` with copied values (energy, DC voltage limits, discharge power or C-rate), series and parallel counts (integers ≥ 1), and the optional ratios DC efficiency, depth of discharge and initial state of charge (each in (0, 1]). Editing a bank changes no M1–M4 hash and marks no result stale. | Could | **Contract:** m1_m2_hashes_unchanged_by_banks; second_bank_on_inverter_invalid (`BATTERY_BANK_INVALID` with the field path). | Q44; guideline §2.1, §4.1 (replaces Q47) |
| FR-76 | (Reworded 2026-11-12, D-106) The power advisory per bank shall be computed by the app-side battery service as analysis type `BA`, from the `depends_on` M1 payload (`inverter_results[].p_kw`), by Eq. (12.6)–(12.8): capability and its source (`discharge_power` or `c_rate`), DC-side power, margin and outcome OK, SHORT or NOT_EVALUATED with the reason (guideline §3.2). Not in the engine, not in the M2 payload. | Could | **Unit:** bank_power_field_vs_c_rate; power_margin_sign; negative_inverter_power_not_evaluated. Hand cases V3, V4. | Q45, Q46; guideline §3.2, ADR-015 |
| FR-77 | (Reworded 2026-11-12, D-106) No `BA` outcome shall change any M1–M4 result, verdict, `limiting_constraints` or margin. | Could | **Contract:** ba_status_feasible_with_short_bank; the M2 result of the same design is byte-identical with and without banks. | Q43 (b), Q11 policy |

**B2 rule.** For Inverter $i$ with a bank of $n_{s,i}$ modules in series and $n_{p,i}$ strings in parallel, module continuous discharge power $P_{mod}^{dis}$ (kW), module energy $E_{mod}$ (kWh) and C-rate $C$ (h⁻¹):

$$P_{bank,i} = \begin{cases} n_{s,i}\, n_{p,i}\, P_{mod}^{dis} & \text{if } P_{mod}^{dis} \text{ is given} \\ C\, n_{s,i}\, n_{p,i}\, E_{mod} & \text{otherwise} \end{cases} \tag{12.6}$$

$$P_{dc,i} = \frac{P_i}{\eta_{dc,i}}, \qquad \eta_{dc,i} \text{ required; when absent the check is not evaluated (Doc 9 D-59 K105)} \tag{12.7}$$

$$m_{bat,i} = P_{bank,i} - P_{dc,i}, \qquad \text{warning} \iff m_{bat,i} < 0 \tag{12.8}$$

with $P_i$ the inverter active power at the M1 operating point (kW, positive when delivering). Total bank power counts every module ($n_s n_p$), because a series string delivers the module current at $n_s$ times the module voltage. The check reads a power capability only; it adds no state, no SoC and no limit to the model (A2 unchanged). Diturunkan dalam penelitian ini.

*Correction to the session wording of Q45:* the capability uses $n_s n_p$ modules, not $n_p$ alone, because the catalogue field is a per-module power.

### 3.6 P11 — 24-hour profile run

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-78 | (Reworded 2026-11-12, D-106) M3b shall accept the axis kind `LOAD_PROFILE_HOUR` with the fixed grid 0, 1, …, 23 (the repo sweep contract uses axis kinds, guideline R2); for each hour every Load is scaled by Eq. (12.9), the same pattern as the λ scaling of M2 (manuscript Eq. 4.14). | Could | Given a Project with a 24-point profile, when M3b runs on `load_profile_hour`, then 24 points are returned, each with its own Status; given no profile, then `INPUT_INVALID` naming the profile. | Manuscript 4.2.2, Eq. 4.14 pattern; Q13, Q14, Q34 |
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

### 3.10 X0–X7 — UX and analytics round

Rules for all eight (guideline §1): values come only from payloads the engine already returns; a `null` is a gap or hollow marker and is listed as "—" with the payload reason, never zero and never interpolated; status is colour + icon + word, and chart series use a categorical palette that never reuses the status colours, told apart also by marker or dash; every element fed by a FAKE RunRecord carries the FAKE marking; no remote request; no term from the manuscript's out-of-scope list; the validity-indicator table stays unstyled (FR-62); existing accessible names, roles and test ids are unchanged.

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-93 | (X0) Each result screen and the inspector shall show the latest RunRecord of its analysis type whose `snapshot_hash` equals the current design (M3c: the `snapshot_hash` of its `depends_on` M1 reference, because an M3c hash also covers the scenarios, Doc 3 §6), read from the RunRecords already in the store (no new reducer state); with no such RunRecord the screen shows its empty state. | Should | Client: the selector returns the latest matching RunRecord and null after a design edit. **E2E:** after M1, leaving S-07 and coming back shows the same result; after a design edit S-07 shows the empty state. | Guideline §2, D-72 K151; audit #4 |
| FR-86 | (X1) Every chart shall be hand-written inline SVG (no chart library) inside a figure with title, axis titles with units, tick labels rounded for display, legend, a caption naming analysis, RunRecord id and engine kind, and a "Show data" toggle that renders the same values as a table; `role="img"` with a label stating what is plotted and the point count; no animation; static in print with fonts of at least 8 pt; every chart and state (normal, empty, gaps, FAKE, print) appears in `/dev/components`. | Should | Client: ticks, nice domain, nearest index and null splitting of the scale module. **E2E:** each figure is present with its name, and its "Show data" table has as many rows as the payload. | Guideline §3; Q3, Q4 |
| FR-87 | (X2) S-07, S-08, S-10, S-12, S-13 and S-14 shall show a KPI strip under the StatusBanner with the tiles of guideline §4, each a label, a value with unit and an optional status (icon + word), read straight from the payload. No tile needs arithmetic on physical quantities (so no "total generation"). | Should | Client: the KPI selector of each screen, including empty and `null` cases. **E2E:** a FAKE run shows the FAKE marking on the strip. | Guideline §4 |
| FR-88 | (X3) The result screens shall show the charts of guideline §5: S-07 bus voltage, inverter loading, power sharing (Advice), line loading; S-08 margins and loadability axis; S-09 tornado; S-10 metric vs axis value; S-11 grouped bars; S-12 status grid; S-13 eigenvalue plot and participation grid; S-14 time responses; S-16 static versions. Reference lines only where the user set the limit; not-evaluated items are listed, never drawn. The participation grid follows §8 (P8): state kinds per inverter, a numeric value in every cell, hidden with a note when `participation` is `null`; the M4b disturbance marker uses `parameters.disturbance.start_time_s` (Doc 3 §6.9). | Should | **E2E:** each chart is present with its name; a `null` value is listed as "—"; a FAKE run shows the FAKE caption on every chart; the S-16 print layout keeps charts within 718 px. | Guideline §5; Doc 3 §6 |
| FR-89 | (X4) Line and point charts shall offer a crosshair that snaps to the nearest real sample and lists every series at that x with units; the chart is focusable, ←/→ move, Home/End jump, Escape hides; hidden in print. | Should | **E2E:** arrow keys move the crosshair and it shows a value with unit; Escape hides it. | Guideline §3 |
| FR-90 | (X5) Selecting a Bus, Line or Inverter in a table row or in the network diagram shall open a side panel (not a modal) with identity, inputs from the Project, latest M1 values (X0; hidden with "No current power flow for this design" when none matches), M2 rows of that element, the sizing-check row if any, and "Edit in table" via `?focus=`; focus moves in on open and back on close; Escape closes. The diagram exposes `onSelect` with keyboard-operable nodes. | Should | **E2E:** the inspector opens from a table row and from the diagram, keeps focus, closes with Escape, and hides M1 values when the design is stale. | Guideline §6 |
| FR-91 | (X6) Domain terms on labels, table headers and KPI labels shall carry a "?" toggletip (click or Enter, closes on Escape or outside click, never hover only); S-17 About lists the glossary. Text is Indonesian (Doc 7 §9 #1) and comes from Doc 3 or the manuscript only, each entry naming its source; a term with no such definition is left out and listed as an open point. | Could | Client: every glossary entry has a source. **E2E:** a toggletip opens with Enter and closes with Escape. | Guideline §7; Doc 7 §9 |
| FR-92 | (X7) Each chart shall offer "Download SVG": the same SVG with a caption block (analysis, RunRecord id, result hash, engine kind, date) and fonts of at least 8 pt at A4 text width; a FAKE chart carries "FAKE ENGINE — not an engine result". | Could | **E2E:** the downloaded SVG contains the RunRecord id and the engine kind; a FAKE chart contains the FAKE caption. | Guideline §8 |

### 3.11 X8 — Automatic single-line diagram (SLD)

Source: `docs/SLD_FEATURE_GUIDELINES.md` v2 (§A wins over the rest of that file); layout and dependencies in ADR-013; Doc 9 D-75. FR-14 stays the core requirement (every Bus and Line drawn, an isolated Bus visibly unconnected, read-only); X8 adds what goes beyond it. The rules of §3.10 apply, plus: no symbol for anything the model does not have (no breaker, switch, transformer, grounding, instrument transformer, utility grid or battery); no IEEE clause or figure number in the app; tooltip, inspector and "View as table" read the same element rows from one model builder; diagram positions are computed, never stored (Doc 3 §3.2).

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-94 | (X8) S-05 shall show an automatically laid-out single-line diagram of the open Project instead of the circle diagram: busbars, Inverters above and Loads below their Bus, Lines as orthogonal conductors, a system block (nominal kV and Hz), a legend; the same topology gives the same picture; isolated Buses sit in a "Not connected" row; a Bus, Line, Load or Inverter with a stage-1 validation issue is marked (outline + icon + word). | Could | Client: every Bus, Line, Load and Inverter appears once with values copied verbatim; identical coordinates for shuffled input; no overlapping node boxes; a meshed loop lays out. **E2E:** the FR-14 test passes unchanged. | Guideline §3, §4, §5 |
| FR-95 | (X8) Hover and keyboard focus on a diagram element shall open a tooltip with the element rows of guideline §6 (design data, then results and checks only when a current run exists, FR-93); a missing optional value shows "—" with its reason, never 0; Escape closes it. | Could | Client: tooltip rows equal the inspector rows of the same element. **E2E:** focus opens the tooltip with a unit on every value; Escape closes it. | Guideline §6, §A7 |
| FR-96 | (X8) On S-07 and S-08 the diagram shall carry a results overlay (toggle "Show results", on by default): M1 labels of guideline §5.1 from the current FEASIBLE M1, and on S-08 violated, limiting and near-limit elements (icon + word) chosen by the S-08 rules (`margin < 0`, `nearLimit`, limiting per Doc 12 §9 #17); with no current run the overlay is hidden and the reason is shown. | Could | **E2E:** after M1 a Bus label shows its voltage in p.u.; after a design edit the overlay is hidden; on the m2-infeasible profile a violated element shows the word "Violated". | Guideline §5, §A5, §A6 |
| FR-97 | (X8) S-16 shall include the diagram as a static figure "Single-line diagram of the analysed design" with the overlay of the reported M1 RunRecord and a caption with its RunRecord id and short snapshot hash; print keeps text at 8 pt or more; "Download SVG" uses the shared exporter of FR-92 with its caption block. | Could | **E2E:** the report figure caption names the RunRecord id; the downloaded SVG contains it and the engine kind, and the FAKE caption for a FAKE run. | Guideline §7, §A9 |
| FR-98 | (X8) The diagram shall be keyboard and screen-reader operable: a group named "Single-line diagram", each element a focusable button with a full name (for example "Inverter INV1 at bus B1, rated 70 kVA"), Enter or Space selects (opens the inspector, FR-90, and highlights the table row), and a "View as table" toggle lists every element with the tooltip fields. | Could | **E2E:** Tab reaches every element; Enter on a Bus opens the inspector; "View as table" has one row per element. | Guideline §8, §A4 |

---

### 3.12 X9 — Example mode (guided example D2)

Source: `docs/EXAMPLE_MODE_PRD.md` (its §3 hard rules bind); values and decisions confirmed by the user at EX-0 in Doc 9 D-92. Presentation and workflow only: no equation, state, assumption, payload field, Project-file field, RunRecord field, API or Engine Port change (§1). Rules: every prefilled value names its source (Doc 13 §4/§5, Doc 3 §3.7, or an author's study setting confirmed in D-92); a value without a source stays empty with "Not set in the example: enter a value"; guidance text quotes no result value; the FAKE marking stays; example settings are prefill only and never enter the canonical snapshot, the Project file or a RunRecord beyond the parameters actually sent; precedence per field: typed value > refill from the last RunRecord of that analysis (D-71 K149 pattern) > example value > empty; the example never accepts SizingAdvice and never runs anything without a click.

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-99 | (X9) S-01 shall offer "Open guided example (D2)", which opens `guided-d2.mgproj.json` as a new unsaved copy and enters example mode; the header shows a Tag "Example mode" and a "Leave example mode" button. Leaving, opening another Project, creating a new one or opening a file ends example mode and keeps the Project, its data and its RunRecords. | Should | **E2E:** open, header tag visible; leave, tag gone, Project kept. | PRD §5.1 |
| FR-100 | (X9) In example mode every screen with an analysis form shall prefill from `guided-d2.example.json` with the precedence above; each prefilled field shows an "Example" tag whose toggletip names its source; a field without a confirmed value stays empty with the note; "Reset to example values" re-applies the example layer only. | Should | Client: precedence helper; every settings entry has a source; type guard (valid, unknown keys ignored, bad value dropped, missing file hides the S-01 action). **E2E:** on the Fake default profile, S-04, S-07, S-08 and S-09 – S-14 each show a result after pressing Run with no typing, except fields left empty in D-92. | PRD §5.2, §5.3, §6 |
| FR-101 | (X9) Example settings shall never reach the canonical snapshot, the Project file or a RunRecord beyond the parameters actually sent; outside example mode no screen prefills. | Should | Client: the snapshot hash of the guided Project equals the hash of the same design entered by hand. **E2E:** a normal new Project shows empty forms. | PRD §3 rule 4 |
| FR-102 | (X9) Each example screen shall show the info banner, a "What this step shows" disclosure and, after a run, a "Next: <step>" link in pipeline order (Doc 7 §3; further analyses M3a → M3b → M3c → M3d → M4a → M4b → Report); the guidance text contains no result numbers; S-16 shows "Produced in example mode from the guided example D2" while example mode is on. | Should | Client: guidance strings contain no digits except section and equation numbers in the source line. **E2E:** the Next links lead through the pipeline to S-16. | PRD §5.2, §7 |
| FR-103 | (X9) S-14 shall offer the example disturbances DR-01, TS-02 and DR-02 of Doc 13 §5 as presets; choosing one refills the disturbance fields. | Should | **E2E:** choosing TS-02 fills INVERTER_OUTAGE on INV2 and Run gives a result. | PRD §6, Doc 13 §5 |
| FR-104 | (X9) S-02 shall offer "Run the whole example" in example mode: PS → M1 → M2 → M3a → M3b → M3c → M3d → M4a → M4b (first preset) in order with each screen's current values, one normal synchronous request at a time (ADR-007), a progress list (status word + icon), stop at the first result that is not FEASIBLE naming the step, skip steps with an unset required field ("skipped: not set in the example"), then open the Report. | Could | **E2E** (Fake): all steps run in order and the Report opens; on profile `m2-infeasible` it stops at M2 and names it. | PRD §8 |

### 3.13 X10 — Cable and overload-protection sizing (experimental)

Source: `docs/CABLE_BREAKER_FEATURE_GUIDELINES.md` (the guideline; its §0 guardrails bind, its equations CB.1 – CB.5 and its [DERIVED] / [DESIGN CHOICE] labels are cited, not repeated here); ids and decisions in Doc 9 D-100. **KONFLIK:** the manuscript lists protection as out of scope, so X10 waits for supervisor approval before it enters the thesis (Doc 9 K-07); until then it is built behind `Settings.feature_cable_sizing` (env `MGAPP_FEATURE_CABLE_SIZING`), off by default. Technical baseline PUIL 2011 (SNI 0225:2011), with the PUIL 2020 legal-edition KONFLIK in Doc 9 K-08. Level L2: an app-side Python service (`backend/src/mgapp/services/cable_sizing/`) computes the result from the M2 line currents and the inverter ratings; it never calls the Engine Port and adds no equation, state or assumption to the engine model (§1). One-shot advice only: nothing is written back into the design. It is not a protection or coordination study: no short-circuit, breaking-capacity, selectivity, earthing, neutral or PE checks. The app ships no standard table values and no vendor data; the user transcribes the tables into `cable_tables.json` (guideline §4), and tests use a fictitious table file.

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-105 | (X10) With `feature_cable_sizing` off (the default), a CB request shall return `UNAVAILABLE / NOT_APPLICABLE` and S-19 shall be hidden; every other screen, payload and contract behaves as without X10. | Could | **Contract:** flag_off_returns_not_applicable. **E2E:** screen_hidden_when_flag_off. | Guideline §0 |
| FR-106 | (X10) The Project shall hold one set of installation settings (`CableSizingSettings`: method B1, A1, C or D_DUCT; conductor; insulation; ambient temperature; soil resistivity for D; grouping count and arrangement; cable construction) with per-element overrides, as design data for this feature only, outside the canonical snapshot used by M1–M4. Loaded conductors are always 3 (balanced three-phase, A6). Direct burial is not offered (`DIRECT_BURIAL_NOT_SUPPORTED`). | Could | **Contract:** the M1–M4 snapshot hash is unchanged by settings edits. | Guideline §2.2, D5, D9 |
| FR-107 | (X10) The server shall load and validate the user-filled table file `cable_tables.json` (schema of guideline §4): an empty rated-current series or a missing ampacity table for the selected method gives `INPUT_INVALID` with `CABLE_TABLES_INCOMPLETE`; `double_entry_checked: false` gives `INPUT_INVALID` with `CABLE_TABLES_UNCHECKED`; the SHA-256 of the canonical table file (Doc 3 §7 rules) is stored as `table_set_hash` in the RunRecord parameters. | Could | **Unit:** unchecked and incomplete tables give their codes; table_hash_changes_on_edit. **Contract:** unchecked_tables_input_invalid. | Guideline §4 |
| FR-108 | (X10) Method `IEC60364_OVERLOAD_PUIL2011` shall size every Line ($I_B$ = M2 `sizing_check.per_line[].required_current_a`, base design only) and every Inverter output feeder ($I_B$ = rated current, guideline D2) by guideline §3.1 – §3.3: device class by the configurable 63 A threshold (D6), $I_n$ the smallest series value ≥ $I_B$, $I_2 = k_2 I_n$ with $k_2$ and its source from the table file, then the smallest size meeting (CB.1) and (CB.2) with $I_Z$ from (CB.3); no interpolation, next more severe tabulated value, blank cell = gap; per-element outcome SIZED, NO_DEVICE_FITS, NO_SIZE_FITS, OUT_OF_TABLE or TABLE_GAP. | Could | **Unit:** lookup_next_more_severe_value; blank_cell_is_gap_not_zero; cb1_cb2_both_reported; mcb_to_mccb_switch_above_63a; no_device_fits; no_size_fits. Hand cases H1–H5 exact (size and $I_n$; $I_Z$ to 0.01 A). | Guideline §3.1 – §3.3 |
| FR-109 | (X10) Each sized element shall report the margins $I_n - I_B$, $I_Z - I_n$ and $1.45 I_Z - I_2$, and each Line the resistance check (CB.4), (CB.5) with warning `LINE_R_MISMATCH` above the 10 % threshold; Inverter feeders get no R check. | Could | **Unit:** r_correction_cu_al. Hand case H6. | Guideline §3.4, §3.5, D3 |
| FR-110 | (X10) A method registry shall map `method_id` to an implementation (`validate`, `size`); every result names its `method_id`; v1 registers one method. | Could | **Unit:** the registry returns the v1 method by id. | Guideline §5.1, D13 |
| FR-111 | (X10) `POST /api/analyses/CB` shall run through the existing pipeline (stage-1 validation, canonicalise and hash, dependency check, RunRecord) with `depends_on` an M2 RunRecordRef (FEASIBLE or INFEASIBLE, three-part check of Doc 3 §5.4); missing or stale gives `UNAVAILABLE / DEPENDENCY_NOT_MET`. The service computes the result itself: engine fields null, `diagnostics.computed_by` = `"app"`. Allowed Status FEASIBLE, INPUT_INVALID, UNAVAILABLE; a per-element outcome does not change the request status. Payload and warnings per guideline §5.3, with `FEATURE_EXPERIMENTAL` on every result while approval is pending. | Could | **Contract:** depends_on_m2_missing_or_stale; engine_fields_null; per_element_outcome_does_not_change_status. | Guideline §5.2, §5.3 |
| FR-112 | (X10) S-19 "Cable and breaker sizing" (`/cable-sizing/`, under Further analyses, enabled only with a valid M2) shall show the settings panel, Run, the status banner, the fixed islanded caveat of guideline §0 above the results table (one row per element with $I_B$, device class and $I_n$, size, $I_Z$, both conditions as icon + word, outcome, R warning), and an expandable row with the factors, the table and page of each factor and the catalogue match; outcomes use Carbon support colours with icon and word; glossary toggletips for KHA / $I_Z$, $I_B$, $I_n$, $I_2$, $k_θ$, $k_ρ$, $k_g$. | Could | **E2E:** run_shows_caveat. | Guideline §6 |
| FR-113 | (X10) After a current CB run the single-line diagram shall draw a breaker symbol on each sized Line and Inverter feeder, with no extra label; the hover card shows $I_n$, class, size and $I_Z$; no symbol for unsized elements. | Could | **E2E:** sld_shows_breaker_symbols_after_run. | Guideline §6, D12 |
| FR-114 | (X10) S-16 shall include the section "Cable and overload sizing (experimental)": the results table, method id, table-set id with `table_set_hash`, the caveat and the KONFLIK note on the PUIL edition. | Could | **E2E:** the report section names the method id and the table-set hash. | Guideline §6, D12 |
| FR-115 | (X10) The Catalogue shall gain the entry kind `BREAKER` {standard, class, in_a, curve, poles, provenance}; each element lists the nearest catalogue cable at or above the chosen size with the same conductor, insulation and cores (datasheet ampacity and conditions shown as a check only) and a breaker of the same standard and $I_n$ if one exists. The UL-based breaker CSV is never used for $I_n$ steps. | Could | **Catalogue file:** BREAKER entry roundtrip. **Unit:** catalogue match picks the nearest larger cable. | Guideline §6, D11 |

### 3.14 B3 and the battery adequacy analysis BA

Source: `docs/BESS_FEATURE_GUIDELINES.md` (its §0 guardrails bind; [DERIVED] and [DESIGN CHOICE] labels are cited, not repeated); decisions in Doc 9 D-106; computation placement in ADR-015. Level L3 for B3 (a composition of 24 existing M1 runs), L2 for B2. Advice only: no state variable, no coupling between hours inside the model, no charging, no SoC-based droop. Fixed caveat on screen and in the report: "Discharge only: recharging is not modelled. The battery is not part of the network model (assumption A2). These results are advice and do not change the feasibility verdict." No feature flag; S-20 is listed only when the Project has at least one bank. Tests use the fictitious file `tests/fixtures/FAKE_battery_TEST_ONLY.json` (D-106 closes D-62 for the build).

| ID | Requirement | Priority | Acceptance criteria | Source |
|---|---|---|---|---|
| FR-116 | `POST /api/analyses/BA` shall run through the existing pipeline (stage-1 validation of the snapshot and of `parameters` {banks, start_hour 0–23}, canonicalise and hash, dependency check, RunRecord) with `depends_on` an M1 RunRecordRef, status FEASIBLE, three-part check of Doc 3 §5.4; missing or stale gives `UNAVAILABLE / DEPENDENCY_NOT_MET`. Allowed Status FEASIBLE, INPUT_INVALID, UNAVAILABLE; a per-bank outcome does not change the request status. RunRecord per ADR-015 (`diagnostics.computed_by = "app"`, `diagnostics.engine_calls`). | Could | **Contract:** ba_depends_on_m1_missing_or_stale; ba_status_feasible_with_short_bank. | Guideline §4.2; ADR-015 |
| FR-117 | When the snapshot has a 24-point LoadProfile, the service shall compute per bank the discharge autonomy of Eq. (12.14)–(12.18) from one M1 request per hour through the Engine Port (loads scaled by Eq. 12.9), in start-hour order with wrap past midnight, stopping at the first hour that is not FEASIBLE; outcomes DEPLETED (autonomy in hours and the clock hour), NOT_DEPLETED (cumulative energy and end SoC) or NOT_EVALUATED with the reason (guideline §3.3). | Could | **Unit:** usable_energy_formula; depletion_interpolates_within_hour; not_depleted_reports_end_soc; profile_wraps_past_midnight. **Contract:** ba_calls_engine_24_times_with_scaled_loads; ba_stops_at_first_non_feasible_hour; ba_without_profile_power_only. Hand cases V5, V6. | Guideline §3.3 |
| FR-118 | An empty DC efficiency, depth of discharge or initial state of charge shall give NOT_EVALUATED for the part that needs it, with the field named; the server applies no default (D-59 K105). An initial SoC at or below $1 - D$ gives NOT_EVALUATED. | Could | **Unit:** missing_eta_dod_soc_not_evaluated; initial_soc_at_limit_not_evaluated. | Guideline §2.2, §3.2, §3.3 |
| FR-119 | S-20 "Battery adequacy" (`/battery/`, under Further analyses) shall be listed only when the Project has at least one bank, with Run enabled only with a valid M1; S-05 shall offer the BatteryBank sub-form per Inverter (guideline §5). Not-evaluated cells show the reason, never 0 or blank; outcomes use Carbon support colours with icon and word (no red, no "Violated"). | Could | **E2E:** s20_hidden_without_bank; run_shows_caveat. | Guideline §5 |
| FR-120 | S-20 shall show the depletion chart "State of charge per inverter over the profile day" on the shared chart foundation (FR-86, FR-89, FR-92), and S-16 the advisory section "Battery adequacy (advice, discharge only)" with the table, the chart, the caveat and the RunRecord id; the A2 row of the A1–A6 checklist notes "battery not modelled; see the advisory section". | Could | **E2E:** depletion_chart_show_data_row_count; report_section_names_run_record. | Guideline §5 |
| FR-121 | A Project without banks shall produce byte-identical API responses and hashes before and after the battery round. | Could | **Golden:** no_bank_project_responses_byte_identical. | Guideline §4.3 |

**B3 rule.** Symbols: $E_{mod}$ module energy (kWh); $n_{s,i}, n_{p,i}$ series and parallel counts; $\eta_{dc,i}$ DC conversion efficiency; $D_i$ depth of discharge; $SoC_{0,i}$ initial state of charge (ratios); $h_0$ start hour; $\Delta t = 1$ h; $P_i(h)$ active power of Inverter $i$ (kW) from the M1 run at hour $h$ with loads scaled by Eq. (12.9).

$$E_{bank,i} = n_{s,i}\, n_{p,i}\, E_{mod} \qquad [\text{kWh}] \tag{12.14}$$

$$E_{use,i} = \eta_{dc,i}\, E_{bank,i}\,\bigl(SoC_{0,i} - (1 - D_i)\bigr) \qquad [\text{kWh, AC side}] \tag{12.15}$$

$$E_{cum,i}(j) = \sum_{k=0}^{j} P_i(h_k)\,\Delta t, \qquad h_k = (h_0 + k) \bmod 24, \quad j = 0,\dots,23 \tag{12.16}$$

$$SoC_i(j) = SoC_{0,i} - \frac{E_{cum,i}(j)}{\eta_{dc,i}\, E_{bank,i}} \tag{12.17}$$

$$j^* = \min\{\, j : E_{cum,i}(j) > E_{use,i} \,\}, \qquad t_{aut,i} = j^* + \frac{E_{use,i} - E_{cum,i}(j^*-1)}{P_i(h_{j^*})} \qquad [\text{h}],\quad E_{cum,i}(-1) = 0 \tag{12.18}$$

Each profile value is the average power over its hour (manuscript Eq. 4.4 reading); the profile wraps past midnight; the horizon is 24 hours. $SoC_i(j)$ is a post-processed sum and is never fed back into any M1 run, so the hours stay uncoupled inside the model and no state is added. Diturunkan dalam penelitian ini.

## 4. Contract changes (merge into Doc 3 at stage 1.5)

| Item | Change |
|---|---|
| Catalogue document | New file type, own `schema_version`; entries of kind INVERTER, CONDUCTOR, BATTERY_MODULE with provenance (FR-64 – FR-68, FR-73). |
| `catalog_ref` | Optional object on Inverter and Line (and on BatteryBank module): entry id, provenance, catalogue schema version, `modified` flag (FR-69). Part of the canonical snapshot. |
| BatteryBank | (2026-11-12, D-106) Optional Project-file field `battery_banks` (omitted when empty; `schema_version` stays 1), 0..1 bank per Inverter, outside the canonical snapshot: {inverter_id, module {catalog_ref, energy_kwh, voltage_min_v, voltage_max_v, discharge_power_kw or null, c_rate_per_h or null}, series_count, parallel_count, dc_efficiency_ratio, depth_of_discharge_ratio, initial_soc_ratio (each or null)} (FR-75, guideline §4.1). New unit suffix `_per_h` (1/h). Stage-1 IssueCode `BATTERY_BANK_INVALID` with the field path. |
| Catalogue kind BATTERY_MODULE | {energy_kwh, nominal_voltage_v, voltage_min_v, voltage_max_v, discharge_power_kw, c_rate_per_h, recommended_dod_ratio}, all optional, with provenance (FR-73). |
| Analysis type `BA` (2026-11-12) | `depends_on` an M1 RunRecordRef (FEASIBLE); `parameters` {banks, start_hour}; payload `banks[]` {inverter_id, bank, power, autonomy with curve[]}, `hours[]`, `caveat_text` (guideline §4.2); WarningCode `BATTERY_POWER_SHORT`; ADR-015. Replaces the M2 group `battery_check` (FR-76 reworded): the M2 payload is unchanged. |
| M1 payload | New group `sharing`: per Inverter {p_deviation_kw, q_deviation_kvar, q_droop_not_rating_proportional} (FR-81). |
| M3 metrics | Add `MAX_Q_SHARING_ERROR` (FR-82). |
| M3b axis kind | Add axis kind `LOAD_PROFILE_HOUR`, fixed grid 0–23 (FR-78 reworded 2026-11-12). |
| X10 cable sizing (FR-105 – FR-115) | analysis_type `CB` with `depends_on` an M2 RunRecordRef; Project field `CableSizingSettings` outside the canonical snapshot (FR-106); the `cable_tables.json` schema with `table_set_hash` in the RunRecord parameters (FR-107); stage-1 codes `CABLE_TABLES_INCOMPLETE`, `CABLE_TABLES_UNCHECKED`, `CABLE_SETTINGS_INVALID` (D-102 K281); dependency on M2 FEASIBLE or INFEASIBLE, engine fields null, `diagnostics.computed_by = "app"` (ADR-014); warning codes `LINE_R_MISMATCH`, `FEATURE_EXPERIMENTAL`, `DIRECT_BURIAL_NOT_SUPPORTED`; Catalogue kind `BREAKER` (FR-115). |
| Indicators | Payload groups for r_τ, κ, r_in, ε_X with `evaluated` flag and reason (FR-61); threshold version in MetaInfo (FR-62). Align with the core indicator contract (§8). |

## 5. UI changes (merge into Doc 7)

| Screen | Change |
|---|---|
| S-18 Catalogue (new, `/catalogue/`) | Open, save, add, edit entries; provenance form; grid-forming guard; information-only marker. |
| S-05 Network editor | "Choose from catalogue" on Inverter and Line rows; "modified from catalogue" marker; current-limit confirmation; BatteryBank sub-form per Inverter (Could). |
| S-04 Sizing advice | Catalogue hints (FR-72), module hint (FR-74). |
| S-07, S-13, S-14, S-16 | Validity-indicator panel (FR-61, FR-62). |
| S-08 | Shortcut per limiting-constraint row (FR-84). (The BatteryCheck panel moved to S-20, D-106.) |
| S-10 | Hour mode (FR-79). |
| S-11 | "Generate N−1 scenarios" action (FR-80). |
| S-15 | Compare two RunRecords (FR-83). |
| S-16 | A1–A6 checklist (FR-63); advisory section "Battery adequacy (advice, discharge only)" (FR-120). |
| S-01 | Example Projects (FR-85). |
| S-07, S-08, S-10, S-12, S-13, S-14 | KPI strip (FR-87). |
| S-07 – S-14, S-16 | Analytics charts (FR-86, FR-88), crosshair on line and point charts (FR-89), Download SVG (FR-92); every result screen reads its latest matching RunRecord (FR-93). |
| S-05, S-07, S-08 | Inspector panel (FR-90); S-05 diagram `onSelect`. |
| S-05, S-07, S-08, S-16 | Single-line diagram replaces the circle diagram (FR-94); tooltip (FR-95); results overlay on S-07 and S-08 (FR-96); report figure and Download SVG (FR-97); keyboard access and "View as table" (FR-98). |
| `/dev/sld` | Every SLD symbol and state of guideline §5 (FR-94). |
| All screens, S-17 About (built in this round) | Glossary toggletips; glossary list on S-17 (FR-91). |
| `/dev/components` | Every chart and state (FR-86). |
| S-01, header, S-04, S-06, S-08 – S-14, S-16 | Example mode (X9): "Open guided example (D2)" on S-01 and the header Tag "Example mode" with "Leave example mode" (FR-99); info banner, "What this step shows", "Example" tags, "Reset to example values", "Next:" link (FR-100, FR-102); S-06 notice that the study limits come from the Project file; S-14 example disturbances (FR-103); S-16 example-mode line (FR-102). |
| S-02 | "Run the whole example" (FR-104, Could, built last). |
| S-19 Cable and breaker sizing (new, `/cable-sizing/`, flag only) | Settings, Run, caveat, results table with expandable factor rows (FR-112). |
| S-05, S-07, S-08 (SLD), S-16, S-18 | Breaker symbols after a current CB run (FR-113); report section (FR-114); Catalogue kind `BREAKER` (FR-115). |
| S-20 Battery adequacy (new, `/battery/`, only with a bank) | Start hour, Run (valid M1), status banner, fixed caveat, per-bank table (power and autonomy), depletion chart (FR-119, FR-120). |
| S-05, S-18, S-04, SLD | BatteryBank sub-form per Inverter (FR-75, FR-119); Catalogue kind "Battery module" (FR-73); module hint (FR-74); inverter hover card and Inspector row "Battery bank: n_s × n_p of <module>", no battery symbol (§9 #15). |

## 6. API changes (merge into Doc 6)

| # | Method | Path | Purpose |
|---|---|---|---|
| 16 | POST | `/api/catalogs/import` | Check a Catalogue file's content: `schema_version`, forward migration, rejection, entry validation (provenance, grid-forming guard). HTTP 200 with a FileCheckResult wrapper; no RunRecord. |

Catalogue export is a client-side download, like Project export. No other endpoint is added: P12 reuses M3c, P11 reuses M3b, P3 and P7 are client-side. X10 adds no path: it is the analysis type `CB` on the existing `POST /api/analyses/{type}` route, with engine fields null (FR-111). The battery round adds no path: analysis type `BA` on the same route (FR-116, ADR-015).

## 7. Test additions (merge into Doc 8)

| FR | Level | Test |
|---|---|---|
| FR-61, FR-62 | API + E2E | indicators_not_evaluated_have_reason; uncalibrated_label_no_colour |
| FR-64 – FR-72 | Catalogue file + E2E | catalogue_roundtrip; newer_version_refused; gfm_guard_refuses_use; copy_keeps_hash_on_catalogue_edit; current_limit_needs_confirmation; ps_values_unchanged_by_hints |
| FR-73 – FR-77, FR-116 – FR-121 | Unit + Contract (API, Fake) + Golden + Catalogue file + E2E; hand cases V1–V6 on REAL (BESS-5) | guideline §7 (replaces battery_check_per_bank and bank_edit_marks_m1_stale) |
| FR-78, FR-79 | API (Fake) | hour_axis_24_points; no_profile_input_invalid; lambda_above_one_warns |
| FR-80 | API (Fake) + E2E | n_minus_1_builds_scenarios; single_inverter_disabled |
| FR-81, FR-82 | API (Fake) | sharing_group_present; metric_not_a_constraint |
| FR-83 – FR-85 | E2E | diff_lists_paths; shortcut_prefills_m3a; example_opens_as_copy |
| FR-94 – FR-98 | Client + E2E | sld_model_verbatim; sld_layout_deterministic_no_overlap_meshed; tooltip_rows_equal_inspector; overlay_hidden_when_stale; violated_word_on_m2_infeasible; report_sld_caption; sld_svg_caption; sld_keyboard_and_table |
| FR-86 – FR-93 | Client + E2E | scale_ticks_domain_nearest_nulls; kpi_selectors_empty_and_null; latest_matching_run; figure_show_data_row_count; crosshair_arrow_keys; inspector_focus_and_stale; fake_caption_every_chart; glossary_entries_have_source; toggletip_enter_escape; svg_download_caption; report_charts_within_718px |
| FR-99 – FR-104 | Client + E2E; API (REAL) at EX-7 | example_settings_guard; initial_value_precedence; every_example_entry_has_source; guidance_no_result_numbers; guided_snapshot_hash_equals_hand_entry; example_click_through; leave_example_mode; normal_project_forms_empty; m4b_example_presets; run_whole_example |
| FR-105 – FR-115 | Unit + Contract (API, Fake M2) + E2E | lookup_next_more_severe_value; blank_cell_is_gap_not_zero; cb1_cb2_both_reported; mcb_to_mccb_switch_above_63a; no_device_fits; no_size_fits; r_correction_cu_al; table_hash_changes_on_edit; flag_off_returns_not_applicable; depends_on_m2_missing_or_stale; unchecked_tables_input_invalid; engine_fields_null; per_element_outcome_does_not_change_status; screen_hidden_when_flag_off; run_shows_caveat; sld_shows_breaker_symbols_after_run; hand cases H1–H6 (guideline §7) |

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
| 4 | B3 in v1 as a per-inverter discharge-autonomy advisory (user 2026-11-12, replaces D-59 K106); no supervisor gate, one-line mention to the supervisor. | DECIDED (user 2026-11-12, D-106) |
| 5 | Example catalogue entries: none shipped (D-59 K107). | DECIDED (user 2026-11-02) |
| 6 | X0: read the latest matching RunRecord, no new reducer state (D-72 K151). | DECIDED (user 2026-11-03) |
| 7 | Participation grid orientation: the payload is `factors[mode][state]` (Doc 3 §6.8); the grid draws states as rows and modes as columns. | DECIDED (from Doc 3, 2026-11-03) |
| 8 | M4b disturbance start: `parameters.disturbance.start_time_s` (Doc 3 §6.9). | DECIDED (from Doc 3, 2026-11-03) |
| 9 | Glossary terms with no Doc 3 or manuscript definition: none at UX-10; every term of guideline §7 has a source (D-89). "loading ratio" and the kW, kvar, kVA units are close readings of Eq. (4.10) and subbab 4.2.1, for the owner to confirm. | DECIDED (UX-10, 2026-11-04) |
| 10 | S-17 About is built in this round, as the home of the glossary (D-72 K151). | DECIDED (user 2026-11-03) |
| 11 | X8: `elkjs` as an exception to D-72 K150, scoped to the SLD (ADR-013). | DECIDED (user 2026-11-03) |
| 12 | X8: symbols against IEEE Std 315 / 315A and the thesis wording; until checked the thesis says "single-line diagram conventions". | OPEN (owner, guideline §12 #1) |
| 13 | X8: inverter loading shown as a ratio, the contract unit (`loading_ratio`, Doc 3 §6.2; R2 of the guideline). | DECIDED (from Doc 3, 2026-11-03) |
| 14 | X8: no drag-to-rearrange in v1; positions computed, never stored (Doc 3 §3.2, Doc 7 §9 #4 read-only first). | DECIDED (from Doc 3 and Doc 7, 2026-11-03) |
| 15 | X8: no battery symbol; the design has no battery entity until B2 lands (§3.5, after 1.4). | DECIDED (from §3.5 and the guideline rule "no symbol for anything the model doesn't have", 2026-11-03) |
| 16 | X8: SVG export only, no PNG (FR-92 asks for SVG; guideline §12 #6 default). | DECIDED (from FR-92, 2026-11-03) |
| 17 | X8: source of "Limiting" on S-08. Guideline §A6 says the smallest `normalised_margin` of `constraint_margins`, because `M2Payload` has no `limiting_constraints`. But the M2 *result* carries `limiting_constraints` (Doc 3 §5: non-empty when INFEASIBLE, may list near-limit items when FEASIBLE), and S-08 already shows it as the "Limiting constraints" table. Proposal: "Limiting" = an element in `result.limiting_constraints`; "Violated" = `margin < 0` in `constraint_margins`; "Near limit" = `nearLimit()`. | DECIDED (user approved the SLD-0 draft with this proposal, 2026-11-03) |
| 18 | X8 priority: Could (FR-14 is Should; the guideline does not set X8's priority). | DECIDED (user approved the SLD-0 draft, 2026-11-03) |
| 19 | X9: guided example D2 only, no guided D1 (EX-D1). | DECIDED (user 2026-11-05, D-92 K227) |
| 20 | X9: "Run the whole example" is built, last, only if time allows (EX-D2). | DECIDED (user 2026-11-05, D-92 K228) |
| 21 | X9: guidance text in English, the UI language (EX-D5); glossary toggletips stay Indonesian (FR-91). | DECIDED (user 2026-11-05, D-92 K229) |
| 22 | X9: values with no source yet stay empty until the user gives one with a reason: M3a `step_relative`, M3b `step_count`, M3d `axis_y` and both step counts. M4a damping threshold stays empty; M4b settling criteria stay empty and are revisited after one REAL run (EX-D4). | OPEN (owner, D-92 K231) |
| 23 | X9: the M3c reference is the first scenario (Doc 3 §6.6 default; S-11 has no reference field), so "D2 base" is stored first in the guided Project. | DECIDED (from Doc 3, D-92 K234) |
| 24 | X10: protection is out of the manuscript scope; X10 enters the thesis only with supervisor approval and stays behind the feature flag until then. | KONFLIK (supervisor approval pending, D-100 K258, Doc 9 K-07) |
| 25 | X10: technical baseline PUIL 2011 (the edition the user holds) while Permen ESDM 7/2021 lists PUIL 2020 as mandatory; migrate when PUIL 2020 is obtained. | KONFLIK (open, D-100 K259, Doc 9 K-08) |
| 26 | X10: form of (CB.3) assumed from PUIL 523.2 and A.52.2; confirm the wording against 523.2 before it enters Bab III. | OPEN (owner, D-100 K260) |
| 27 | X10: MCB/MCCB threshold 63 A, configurable (guideline D6). | DECIDED (user 2026-11-08, D-100 K261) |
| 28 | X10: table lookup without interpolation, next more severe tabulated value, blank cell = gap (guideline §3.2), and the 10 % R threshold at the maximum conductor temperature (§3.5) are design choices without a standard behind them. | DESIGN CHOICE (guideline, D-100 K262, K263) |
| 29 | X10: worst-scenario $I_B$ deferred, because M3c returns no per-line currents (a contract change); direct burial and parallel conductors not in v1. | DECIDED (guideline D1, D9, §3.3) |
| 30 | X10: no table values in the repo; the filled table file stays out of the public repo (`data/private/`, git-ignored) because PUIL is copyrighted. | DECIDED (guideline §0) |
| 31 | X10: verification by hand cases H1–H6 (exact match) and validation of the $I_B$ input chain against PSIM line currents; no ETAP or other cable-sizing software comparison. | DECIDED (user 2026-11-08, D-100 K266) |
| 32 | X10: no ADR written at X10-0; ADR-014 is reserved for the app-side computation placement if the user asks for one. | OPEN (user) |
| 33 | Battery: BatteryBank outside the canonical snapshot (guideline §2.1). | DECIDED (user 2026-11-12, D-106) |
| 34 | Battery: no default for DC efficiency, depth of discharge or initial SoC; empty → NOT_EVALUATED (guideline §2.2, D-59 K105). The DoD = 1.0 fallback of the design session is dropped. | DECIDED (user 2026-11-12, D-106) |
| 35 | Battery: `battery_banks` is an optional Project-file field, omitted when empty, `schema_version` stays 1 (an older app refuses a file with banks as an unknown field). | DECIDED (user 2026-11-12, D-106) |
| 36 | Battery: build and tests on the fictitious TEST ONLY module, DC-window and profile data; real data for the thesis cases only if the user supplies them with sources (closes D-62 for the build). | DECIDED (user 2026-11-12, D-106) |
| 37 | Battery: the ADR-015 points Q1–Q6 (engine identity, overall time budget, FAKE marking, service exception, app-analysis map, OpenAPI): every recommendation taken. | DECIDED (user 2026-11-12, D-106 K309) |
| 38 | Battery: glossary toggletips for DoD, SoC, autonomy and C-rate need a source each (FR-91); a term without one is left out. | OPEN (owner, BESS-4) |
| 39 | Battery future work (guideline §9, Bab 5 saran): SoC-based droop as a quasi-static sequential run (new assumption, coupled hours: scope change), charging operating points, DC-side dynamics in M4, minimum autonomy over all start hours, lifetime and cost. | DECIDED (out of v1, user 2026-11-12) |

## Log

| Date | Change |
|---|---|
| 2026-11-01 | Created from the post-seminar design session (decisions Q1–Q48). |
| 2026-11-01 | DR-08 cancelled by the user: formulas added (Eq. 12.3–12.13, indicator definitions referenced to the manuscript); B2 capability corrected to count $n_s n_p$ modules; standard conductor tables postponed; separate M4 sweep cap dropped in favour of manuscript SWEEP_CAP 1 000. |
| 2026-11-02 | Q-22 settled (Doc 9 D-59): Could features with Eq. 12.x after the Should ones; B2 requires η_dc (Eq. 12.7); B3 out of v1; no example catalogue entries. |
| 2026-11-03 | UX and analytics round added (Doc 9 D-72): X0–X7 with FR-86 – FR-93 (§2, §3.10, §5, §7, §9 points 6–10). |
| 2026-11-03 | SLD round added (Doc 9 D-75, ADR-013, user-confirmed at SLD-0): X8 with FR-94 – FR-98 (§2, §3.11, §5, §7, §9 points 11–18). |
| 2026-11-05 | Example round added (Doc 9 D-92, user-confirmed at EX-0): X9 with FR-99 – FR-104 (§2, §3.12, §5, §7, §9 points 19–23). |
| 2026-11-09 | Cable round X10-0 drafted (Doc 9 D-100, user-confirmed 2026-11-09): X10 with FR-105 – FR-115 (§2, §3.13, §4, §5, §6, §7, §9 points 24–32). |
| 2026-11-09 | Ringkasan mentions X9 (example mode) and X10 (cable sizing, experimental, ADR-014, KONFLIK K-07 and K-08 open). |
| 2026-11-12 | Battery round BESS-0 (Doc 9 D-106, ADR-015 accepted; `docs/BESS_FEATURE_GUIDELINES.md`): FR-75 – FR-78 reworded, B3 added (§2, §3.14, Eq. 12.14–12.18), FR-116 – FR-121; §4, §5, §6, §7 rows; §9 #4 reworded, points 33–39; Ringkasan sentence. |
| 2026-11-13 | P11 built in round BESS-6 (Doc 9 D-113): axis kind `LOAD_PROFILE_HOUR` with fixed fields, M3b only, warning from both adapters, S-10 hour mode. |
