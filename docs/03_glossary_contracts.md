# 03 — Domain Glossary and Data Contracts

> Doc 3 of the doc set. Source of truth for names (EN + ID), entity fields, validation rules and the Engine Port schema. **Aligned with the final seminar-proposal manuscript (`Seminar.pdf`, 28-10-2026) on 2026-11-01** (alignment items A1–A20 in Doc 14); the manuscript wins on any conflict. Equations are allowed (user decision 2026-11-01, cancelling the former no-equation guardrail); manuscript equations are cited by number, not re-derived. Reference only: the prototype (`App/`) was used for vocabulary orientation; no name here is "decided by the prototype". Post-proposal extensions (Doc 12) are not merged here yet.

## Ringkasan

Dokumen ini adalah kamus istilah dan kontrak data untuk seluruh aplikasi. Setiap istilah diberi padanan bahasa Indonesia dan definisi satu baris, sehingga dokumen lain memakai nama yang sama. Setiap entitas (proyek, bus, saluran, beban, profil beban, inverter, batasan desain, saran kapasitas, pemeriksaan kapasitas, skenario) dijelaskan per bidang beserta satuan dan aturan validasinya. Dokumen ini juga menetapkan bentuk permintaan dan hasil pada Engine Port, enam nilai status beserta himpunan status yang diizinkan per jenis analisis, serta bentuk masukan dan keluaran tiap analisis sesuai naskah final, termasuk parameter saran kapasitas awal, margin pembebanan, kelas kestabilan, dan indikator keabsahan. Batasan desain tidak memiliki nilai bawaan, dan batasan yang kosong dilaporkan sebagai tidak dievaluasi. Bentuk RunRecord, aturan hash, dan berkas proyek berversi juga dicantumkan. Pilihan yang belum pasti ditandai [ASSUMPTION] dan dikumpulkan di Dokumen 9.

---

## 1. Naming and unit conventions

| Topic | Convention |
|---|---|
| Language | Technical text in English; each glossary term has an Indonesian equivalent (§2). |
| Entity names | PascalCase, exact spelling from the fixed vocabulary (Project, Bus, Line, Load, LoadProfile, Inverter, DesignConstraints, SizingAdvice, SizingCheck, Scenario, AnalysisRequest, AnalysisResult, RunRecord, Status). |
| Field identifiers | `snake_case`; **unit suffix in the name** wherever the field has a unit (`_kw`, `_kvar`, `_kva`, `_kv`, `_ohm`, `_a`, `_hz`, `_deg`, `_s`, `_kwh`, `_h`). A unitless ratio ends in `_ratio`. |
| Enum values | `UPPER_SNAKE_CASE` strings. |
| Ids | Strings matching `^[A-Za-z0-9_-]{1,32}$`, unique within their entity list; references by id, never by position. [ASSUMPTION] pattern and length. |
| Timestamps | UTC, ISO 8601 with `Z` suffix. |
| Contract units | Engineering units (manuscript 4.2.1d): kV line-to-line, kW, kvar, kVA, Ω/km, A, Hz, Hz/kW, kV/kvar, s, kWh, degrees; power = three-phase total. **One exception:** the DesignConstraints voltage band and voltage LimitingConstraints are in p.u. of `nominal_voltage_kv`. |
| Engine units | The engine uses SI per phase internally (V phase RMS, W, VAR, rad/s, rad). Conversion is the **Real Engine adapter's job** and happens only at recorded points (√3, 2π) (manuscript 4.2.1d, Tabel D.1 rule 7). Droop conversion: $m_p\,[\mathrm{rad/(s\cdot W)}] = 2\pi\cdot 10^{-3}\cdot$ `frequency_droop_hz_per_kw`; $n_q\,[\mathrm{V/VAR}] = $ `voltage_droop_kv_per_kvar` $/\sqrt3$ (phase voltage against three-phase Q). Confirmed against `mgengine` 0.3.0 (Doc 9 D-54 K74). |
| Balanced three-phase | The network is balanced three-phase (A6). |
| Single voltage level | One nominal voltage for the whole Project; no transformers (manuscript 1.5). |
| Hidden conversions | **None** in the app. The app stores and displays the value in the declared unit. |
| Numbers | JSON numbers, finite only (no NaN, no Infinity). |

---

## 2. Glossary

| EN term | Istilah (ID) | Definition (one line, plain) | Used in |
|---|---|---|---|
| Project | Proyek | One design: network, loads, constraints, advice, scenarios and run records, saved as one file. | all |
| Bus | Bus (simpul) | A connection point where lines, loads and inverters attach. | §3.2 |
| Line | Saluran | A connection between two buses, with resistance and reactance per km and a length. | §3.3 |
| Load | Beban | Constant-PQ demand at one bus, given as active power and either reactive power or power factor. | §3.4 |
| LoadProfile | Profil beban | Optional 24-value daily active-power curve (kW per hour) used for storage-energy advice. | §3.5 |
| Inverter | Inverter | A grid-forming converter at a bus with rating, droop settings, setpoints and power-filter time constants. | §3.6 |
| DesignConstraints | Batasan desain | Limits a design is judged against; no defaults; an empty limit is "not evaluated". | §3.7 |
| SizingAdvice | Saran kapasitas awal | PS output: advisory, pre-network sizing from load data; becomes design data only when accepted. | §3.8 |
| SizingCheck | Penentuan kapasitas awal | M2 output: preliminary sizing from the network operating point. | §3.9 |
| Scenario | Skenario | A named set of overrides on the base design, used to compare variants. | §3.10 |
| AnalysisRequest | Permintaan analisis | The single input shape sent through the Engine Port. | §5 |
| AnalysisResult | Hasil analisis | The single output shape returned through the Engine Port, always with a Status. | §5 |
| RunRecord | Catatan eksekusi | A record of one analysis execution: exact input, settings, versions and result. | §7 |
| Status | Status | The one verdict value of every analysis, with a machine code and a plain message. | §5 |
| Engine Port | Port mesin | The single boundary through which the app asks the engine to run an analysis. | §5 |
| Fake Engine | Mesin tiruan | Engine stand-in returning canned deterministic results for every status; built first. | §5 |
| Real Engine adapter | Adaptor mesin sebenarnya | Connects the real engine to the same Engine Port and converts units. | §5 |
| INPUT_INVALID | Masukan tidak valid | Rejected before calculation because the input breaks a stage-1 rule. | §4, §5 |
| SOLVER_FAILED | Solver gagal | No convergence or numerical failure (with a cause code). | §5 |
| PHYSICALLY_INADMISSIBLE | Tidak fisis | Converged, but the solution is not physical (e.g. bus voltage ≤ 0); never used downstream. | §5 |
| INFEASIBLE | Tidak layak | Valid operating point that violates design constraints; never returned by M1. | §5 |
| FEASIBLE | Layak / berhasil | Success; meaning per analysis type (§5.4). | §5 |
| UNAVAILABLE | Tidak tersedia | Not applicable, dependency failed, or time budget exceeded; a reason code says why. | §5 |
| PS | Saran kapasitas awal | Sizing advice from load data before a network exists (manuscript 4.2.2). | §6.1 |
| M1 | Aliran daya droop | Newton–Raphson droop power flow with frequency as a state and no slack bus (4.2.3). | §6.2 |
| M2 | Pemeriksaan batasan | Constraint check, preliminary sizing and loadability margins λ_c, λ_s (4.2.4). | §6.3 |
| M3a–M3d | Sensitivitas, sapuan, skenario, selubung | Local sensitivity, 1-D sweep, scenario comparison, 2-D envelope (4.2.5). | §6.4–6.7 |
| M4a | Stabilitas sinyal kecil | Eigenvalues, damping, dominant modes, participation, stability class on the reduced-order model (4.2.6). | §6.8 |
| M4b | Stabilitas transien | Time simulation of a catalogued disturbance with a transient class (4.2.6). | §6.9 |
| validity indicator | indikator keabsahan | r_τ, κ (A1), r_in (A2), ε_X (A4); thresholds calibrated at stage 1.6 (4.2.7). | §6.2, §6.8 |
| λ_c, λ_s | margin pembebanan | Largest load scale with all points FEASIBLE (λ_c) or admissible (λ_s) (Eq. 4.15). | §6.3 |
| operating point | titik operasi | Steady-state voltages, angles, frequency and flows. "Valid" = M1 FEASIBLE + same snapshot hash + matching result hash (§5.4). | §5.4 |
| limiting constraint | batasan pembatas | The violated check with the smallest normalised margin, or, if none is violated, the non-balance check with the smallest normalised margin (Eq. 4.18). | §5.3 |
| margin | margin | Distance of a quantity from its limit in its own unit; negative = violated. | §5.3 |
| not evaluated | tidak dievaluasi | A check whose limit is empty; never counted as satisfied. | §3.7 |
| canonical snapshot | snapshot kanonik | Design data in a fixed normalised JSON form, used as engine input and for hashing. | §7 |
| snapshot hash / result hash | hash snapshot / hash hasil | SHA-256 over the canonical snapshot / over {status, payload}. | §7 |
| solver config | konfigurasi solver | Tolerance, maximum iterations and initial guess sent with a request. | §5.1 |
| RunRecordRef | rujukan RunRecord | The M1 record parts a dependent analysis carries as `depends_on`. | §5.1 |
| warning | peringatan | Non-blocking notice attached to a result (e.g. ENGINE_KIND_FAKE). | §5.2 |
| schema_version / migration | versi skema / migrasi | Integer file-layout version; forward-only conversion of older files. | §7, §8 |
| FileCheckResult | hasil pemeriksaan berkas | Answer of a file check; not a Status (Doc 6). | §8 |

---

## 3. Entities

"Required = Y" means present and non-null. All numbers finite.

### 3.1 Project

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | id pattern | |
| name | string | — | Y | 1–100 chars | Not in the canonical snapshot. |
| description | string | — | N | ≤ 1000 chars | Not in the canonical snapshot. |
| created_at, modified_at | string (timestamp) | UTC | Y | ISO 8601; modified ≥ created | |
| nominal_voltage_kv | number | kV | Y | > 0 | Line-to-line; one level. |
| nominal_frequency_hz | number | Hz | Y | > 0 | Default 50, editable (manuscript Tabel 4.9). |

### 3.2 Bus

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | unique | |
| name | string | — | N | ≤ 100 chars | Label; not in the snapshot. |
| diagram_x, diagram_y | number | UI units | N | finite | Layout only; not in the snapshot. |

### 3.3 Line

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | unique | |
| from_bus_id, to_bus_id | string (id) | — | Y | existing Buses; different | |
| r_ohm_per_km | number | Ω/km | Y | > 0 | |
| x_ohm_per_km | number | Ω/km | Y | > 0 | |
| length_km | number | km | Y | > 0 | |
| current_limit_a | number | A | N | > 0 if given | Overrides DesignConstraints.line_current_limit_a for this Line. |

**Derived impedance:** $R = $ `r_ohm_per_km` · `length_km`, $X = $ `x_ohm_per_km` · `length_km`. The **server** computes `r_ohm`, `x_ohm` and writes them into the canonical snapshot, overwriting any client value (manuscript 4.3.5). No shunt admittance (A4).

### 3.4 Load

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | unique | |
| bus_id | string (id) | — | Y | existing Bus | Several Loads per Bus allowed. |
| p_kw | number | kW | Y | ≥ 0 | Three-phase. |
| q_kvar | number | kvar | exactly one of {q_kvar} or {power_factor + pf_direction} | ≥ 0 | Inductive Q as entered. |
| power_factor | number | — | with pf_direction | 0 < pf ≤ 1 | |
| pf_direction | enum | — | with power_factor | LAGGING, LEADING | Leading load expressed by LEADING, not negative q. |

Load model: constant PQ only in v1 (manuscript 4.2.1c).

### 3.5 LoadProfile

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | id pattern | At most one per Project. |
| values | array of {hour, p_kw} | — | Y | exactly 24 entries | System active power only; not used by M1 (M1 uses the Load table). |
| values[].hour | integer | h | Y | 0–23, each once | Local hour, no time zone. |
| values[].p_kw | number | kW | Y | ≥ 0 | |

### 3.6 Inverter

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | unique | |
| bus_id | string (id) | — | Y | existing Bus | |
| rated_kva | number | kVA | Y | > 0 | |
| frequency_droop_hz_per_kw | number | Hz/kW | Y | > 0 | P–ω droop; sign locked positive (manuscript 4.2.3). |
| voltage_droop_kv_per_kvar | number | kV/kvar | Y | > 0 | Q–V droop. |
| frequency_setpoint_hz | number | Hz | Y | > 0 | ω* as frequency. |
| voltage_setpoint_kv | number | kV | Y | > 0 | V* line-to-line. |
| p_setpoint_kw | number | kW | N | finite | P*; absent = 0. Needed for P* reference steps (M4b). |
| q_setpoint_kvar | number | kvar | N | finite | Q*; absent = 0. |
| tau_p_s | number | s | N (required for M4a/M4b) | > 0 | Active-power filter time constant; no default (A3, Tabel 4.10). |
| tau_q_s | number | s | N (required for M4a/M4b) | > 0 | Reactive-power filter time constant; no default. |

Storage is not a separate entity in v1; storage energy appears only in SizingAdvice and SizingCheck.

### 3.7 DesignConstraints

One per Project. **No numeric defaults** (manuscript 4.2.4: standards fixing limits for 50 Hz systems not reviewed). Every limit is optional; an empty limit makes its check "not evaluated", listed separately, never counted as satisfied.

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| voltage_min_pu, voltage_max_pu | number | p.u. of nominal | N | > 0; min < max when both given | Reference designs use 0.95–1.05 as a study setting. |
| frequency_min_hz, frequency_max_hz | number | Hz | N | > 0; min < max when both given | Reference designs use 49.75–50.25 Hz. |
| inverter_loading_limit_ratio | number | ratio of rated_kva (μ_max) | N | 0 < μ ≤ 1 | Reference designs use 1. |
| line_current_limit_a | number | A | N | > 0 | Project-wide; Line.current_limit_a overrides. Thermal limit is user-set (4.2.4). |
| balance_tolerance_kw | number | kW | N | > 0 | ε_bal of the power-balance consistency check (Eq. 4.10); absent = check not evaluated, like every other limit (Doc 9 D-54 K84). |

### 3.8 SizingAdvice

PS output stored in the Project; design data only after explicit accept.

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | unique | |
| created_at | string | UTC | Y | ISO 8601 | |
| input_hash | string | — | Y | 64 lowercase hex | SHA-256 over canonical JSON of {loads, load_profile, ps_parameters} (manuscript 4.2.2); a change marks the advice stale. |
| ps_parameters | object | — | Y | as §6.1 parameters | Stored so staleness and re-run are self-contained. |
| state | enum | — | Y | PROPOSED, ACCEPTED, EDITED, SKIPPED | |
| result | PS payload (§6.1) | — | Y | | Copy of the advice values. |
| edited_values | object | as §6.1 | N | only when EDITED | Original suggestion kept unchanged. |

### 3.9 SizingCheck

Part of the M2 payload (§6.3). How values are computed: manuscript Eq. 4.12–4.13.

| Field | Type | Unit | Required | Note |
|---|---|---|---|---|
| per_inverter | array of {inverter_id, s_kva, required_rating_kva, headroom_kva, rating_margin_short} | kVA; boolean | Y | $S_{req,i} = (S_i/1000)(1+m_{inv})$, $h_i = S_{r,i} - S_{req,i}$; `rating_margin_short` = $h_i < 0$ (warning only). |
| per_line | array of {line_id, current_a, required_current_a} | A | Y | $I_{req,\ell} = I_\ell (1 + m_{line})$. |
| storage | {e_ac_kwh, e_dc_kwh, e_nom_kwh, stage, basis} or null | kWh | N | Eq. 4.13 with $P_{demand}$ the M1 total load; computed only with t_aut_h; furthest stage whose parameters exist. |
| basis | string | — | Y | Plain text. |
| assumptions | array of string | — | Y | e.g. "η_dc absent: E_dc not computed". |

SizingAdvice comes from load data alone; SizingCheck comes from the network operating point. Terms locked: *saran kapasitas awal* (PS) vs *penentuan kapasitas awal* (M2).

### 3.10 Scenario

| Field | Type | Unit | Required | Validation rule | Note |
|---|---|---|---|---|---|
| id | string (id) | — | Y | unique | |
| name | string | — | Y | 1–100 chars | |
| description | string | — | N | ≤ 1000 chars | |
| overrides | array of {parameter_path, value} | per parameter | Y | each path resolves to a numeric field; value passes that field's rule; may be empty | No topology changes in v1. |

`parameter_path` form: `<collection>/<id>/<field>`, e.g. `inverters/INV1/rated_kva`.

---

## 4. Validation rules (stage 1, app side)

Stage 1 runs in the application service before any engine call and yields `INPUT_INVALID` listing **all** issues (FR-20). Physics judgements are engine-side and never checked here (FR-21). Each issue: `code`, `level`, `entity`, `id`, `field`, `message`.

| Code | Level | Rule | Message (plain) |
|---|---|---|---|
| NEGATIVE_POWER | field | Load p_kw/q_kvar or profile p_kw < 0 | "Power cannot be negative. Enter 0 or more." |
| EMPTY_REQUIRED | field | Required field missing, null or blank | "This field is required." |
| NOT_POSITIVE | field | A field that must be > 0 is ≤ 0 | "This value must be greater than 0." |
| PF_OUT_OF_RANGE | field | power_factor ≤ 0 or > 1 | "Power factor must be above 0 and at most 1." |
| PF_DIRECTION_MISSING | field | power_factor without pf_direction | "Choose lagging or leading." |
| LOAD_Q_AMBIGUOUS | entity | Both or neither of q_kvar / power_factor | "Enter either reactive power or power factor." |
| BAND_INVERTED | entity | A given min ≥ its given max | "The lower limit must be below the upper limit." |
| LOADING_LIMIT_RANGE | field | inverter_loading_limit_ratio ≤ 0 or > 1 | "Loading limit must be above 0 and at most 1." |
| DUPLICATE_ID | entity | Two items of a kind share an id | "This id is already used." |
| ID_FORMAT | field | Id breaks the pattern | "Use letters, digits, underscore and hyphen (max 32)." |
| DANGLING_BUS_REF | entity | Reference to a missing Bus | "This item points to a bus that does not exist." |
| SELF_LOOP_LINE | entity | from = to | "A line must connect two different buses." |
| DUPLICATE_LINE | topology | Two Lines between the same pair | "There is already a line between these buses." |
| ISOLATED_BUS | topology | Bus without a Line (network > 1 Bus) | "This bus is not connected." |
| DISCONNECTED_NETWORK | topology | Lines do not connect all Buses | "The network is split into separate parts." |
| NO_INVERTER | topology | Zero Inverters (M1 onward) | "Add at least one inverter." |
| NO_LOAD | topology | Zero Loads (PS and M1 onward) | "Add at least one load." |
| PROFILE_LENGTH / PROFILE_HOUR | entity | Not 24 values / hours not 0–23 once each | "A daily profile needs 24 hourly values, hours 0–23 once each." |
| PS_PARAMETER_INVALID | request | PS parameter rule broken (§6.1): m_inv < 0, n not an integer ≥ 1, r ∉ {0,1}, r = 1 with n = 1, t_aut_h not an integer 1–24, η or DoD outside (0, 1] | "Check the sizing-advice settings." |
| SIZING_MARGIN_INVALID | request | M2 m_inv or m_line missing or < 0 | "Enter the design margins (0 or more)." |
| TAU_MISSING_FOR_M4 | entity | M4a/M4b requested and an Inverter lacks tau_p_s or tau_q_s | "Enter the power-filter time constants for every inverter." |
| SENSITIVITY_STEP_INVALID | request | M3a: neither or both of step_relative / step_absolute, or ≤ 0 | "Give one step size: relative or absolute." |
| DISTURBANCE_INVALID | request | M4b disturbance incomplete or inconsistent with its kind | "Complete the disturbance definition." |
| SWEEP_RANGE_INVALID | field | Range min ≥ max or step count < 2 / not integer | "The sweep range or step count is not valid." |
| SCENARIO_PATH_INVALID | entity | Override path does not resolve | "This scenario changes something that does not exist." |
| SWEEP_CAP_EXCEEDED | request | M3b/M3d point count above SWEEP_CAP (initial 1 000) | "This sweep has too many points." |
| PARAMETER_CAP_EXCEEDED | request | M3a parameter count above cap [ASSUMPTION value] | "Too many parameters selected." |
| DURATION_CAP_EXCEEDED | request | M4b duration above cap [ASSUMPTION value] | "The simulation time is too long." |
| SCENARIO_COUNT_INVALID | request | M3c count < 2 or > SCENARIO_CAP | "Compare between 2 and the allowed number of scenarios." |
| DEPENDS_ON_NOT_ALLOWED | request | depends_on on PS or M1 | "This analysis does not use an earlier result." |
| MULTIPLE_INVERTERS_ON_BUS | request | Engine-side only (M4a, M4b): two Inverters on one Bus (D-53 K61, D-55 K91) | "Stability analysis allows at most one inverter per bus." |
| MALFORMED_REQUEST | request | Body does not match the schema (framework validation converted) | "The request could not be read." |

`SWEEP_CAP_EXCEEDED` is an `INPUT_INVALID` code checked after the issue collection and before any engine call; it is never an `UNAVAILABLE` reason (manuscript 4.3.3).

---

## 5. Engine Port contract

Two operations (manuscript 4.3.2): `run(AnalysisRequest) → AnalysisResult` and `identity() → {engine_kind, engine_version, engine_git_commit}`. Every adapter obeys seven rules (Tabel D.1): stateless between calls (M1 travels in the request); deterministic (basis of hash comparison); never creates a RunRecord (the app does); failures as status/code/message, never exceptions (an exception becomes ENGINE_ERROR); reports version, commit and kind (stored in the RunRecord); does not handle the time budget (the execution guard does); contract units (the Real Engine adapter converts).

### 5.1 AnalysisRequest

| Field | Type | Required | Note |
|---|---|---|---|
| analysis_type | enum | Y | PS, M1, M2, M3a, M3b, M3c, M3d, M4a, M4b (from the route). |
| project_snapshot | object | Y | Canonical snapshot (§7), passed stage 1. |
| parameters | object | Y | Per type, §6; `{}` when none. |
| solver_config | object | Y | Present on every request; ignored by PS. |
| solver_config.mismatch_tolerance_w | number | Y | > 0; default $10^{-3}$ (applies to W and VAR mismatch; manuscript 4.2.3). |
| solver_config.max_iterations | integer | Y | ≥ 1; default 50 (prototype default, changeable). |
| solver_config.initial_guess | enum | Y | DEFAULT only in v1 (flat start with Eq. 4.9 frequency guess). |
| depends_on | RunRecordRef | M2, M3a–d, M4a–b; absent for PS, M1 | Missing/invalid → UNAVAILABLE / DEPENDENCY_NOT_MET; present on PS/M1 → INPUT_INVALID (DEPENDS_ON_NOT_ALLOWED). |
| scenarios | array of {scenario_id, label, project_snapshot} | M3c only | Overrides applied by the client; part of the canonical input. |

**RunRecordRef:** {record_id, analysis_type (= M1), snapshot_hash, status, result_hash, result_payload}.

### 5.2 AnalysisResult

| Field | Type | Required | Note |
|---|---|---|---|
| status | enum Status | Y | One of six. |
| status_code | string | Y | Reason code or `OK`. |
| message | string | Y | Plain language, names the cause category and a next step (NFR-06). |
| payload | object or null | per §5.4 | Shape per analysis_type (§6). |
| limiting_constraints | array of LimitingConstraint | Y | Non-empty when INFEASIBLE; may list near-limit items when FEASIBLE. |
| warnings | array of {code, message, path} | Y | May be empty. Codes include ENGINE_KIND_FAKE (every Fake result), PROFILE_PEAK_ABOVE_LOADS (PS), RATING_MARGIN_SHORT (M2), VALIDITY_NOT_CALIBRATED (M4), ENGINE_VERSION_MISMATCH (re-run). |
| diagnostics | object | Y | Free-form; e.g. iterations, elapsed time, stage-1 issues, cause codes. |

### 5.3 LimitingConstraint

| Field | Type | Required | Note |
|---|---|---|---|
| kind | enum | Y | BUS_VOLTAGE_MIN, BUS_VOLTAGE_MAX, FREQUENCY_MIN, FREQUENCY_MAX, INVERTER_LOADING, LINE_CURRENT, POWER_BALANCE. |
| element_id | string | Y | Bus, Inverter or Line id; `SYSTEM` for frequency and balance. |
| value, limit | number | Y | In `unit`. |
| unit | string | Y | pu, Hz, ratio, A, kW. |
| margin | number | Y | Signed distance in `unit`; negative = violated. Violation only beyond $u + (\epsilon_{abs} + \epsilon_{rel}|u|)$ with $\epsilon_{abs}=10^{-12}$, $\epsilon_{rel}=10^{-9}$ (Eq. 4.11). |
| normalised_margin | number | Y | $\bar\mu_c$ of Eq. 4.18 (two-sided: distance to the nearer bound over the band width; one-sided: over $|l|$); used to pick the limiting constraint deterministically. |

Checks with an empty limit appear in the payload list `not_evaluated` as {kind, element_id}, not here.

### 5.4 Status table and allowed sets

| Status | Meaning | Produced by | payload | Example codes |
|---|---|---|---|---|
| INPUT_INVALID | Rejected before calculation | App (stage 1); engine if it detects what stage 1 missed | null; issues in diagnostics | §4 codes, MULTIPLE_ISSUES |
| SOLVER_FAILED | No convergence or numerical failure | Engine | null | NO_CONVERGENCE, MAX_ITERATIONS_REACHED, ILL_CONDITIONED_JACOBIAN (cond > 10¹²), NON_FINITE, EIGEN_SOLVER_FAILED, SIMULATION_FAILED, EQUILIBRIUM_INVALID (M4a, D-55 K91) |
| PHYSICALLY_INADMISSIBLE | Converged, not physical | Engine (M1) | optional, diagnostic only | OPERATING_POINT_NOT_PHYSICAL (e.g. $V_b \le 0$) |
| INFEASIBLE | Valid, constraints violated | Engine (M2) | yes | CONSTRAINT_VIOLATED |
| FEASIBLE | Success: PS "advice produced"; M1 "operating point found" (no constraint judgement); M2 "design meets all evaluated constraints"; M3 "analysis completed"; M4 "analysis completed" (stability/transient class in payload) | Engine | yes | OK |
| UNAVAILABLE | Not applicable, dependency failed, timeout, engine error | App or engine | null | TIMEOUT, DEPENDENCY_NOT_MET, NOT_APPLICABLE, ENGINE_ERROR |

**Allowed Status per analysis type (manuscript 4.3.2); every type may also return INPUT_INVALID and UNAVAILABLE:**

| analysis_type | Additional allowed Status |
|---|---|
| PS | FEASIBLE (closed form) |
| M1 | FEASIBLE, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE (never INFEASIBLE) |
| M2 | FEASIBLE, INFEASIBLE (failures along the λ trace are recorded per point) |
| M3a, M3b, M3c, M3d | FEASIBLE when the request completes; per-point / per-scenario Status in the payload |
| M4a, M4b | FEASIBLE, SOLVER_FAILED |

A Status outside the allowed set is reported as UNAVAILABLE / ENGINE_ERROR (contract violation). An analysis type not yet supported by an adapter returns UNAVAILABLE / NOT_APPLICABLE.

**Dependency rule:** M2, M3a–d, M4a–b need a valid M1 RunRecordRef: (1) `status` = FEASIBLE; (2) `snapshot_hash` = hash of the request snapshot (M3c: base snapshot); (3) SHA-256 of canonical {status, result_payload} = `result_hash`. Any failure or absence → UNAVAILABLE / DEPENDENCY_NOT_MET without an engine call; the message says "stale" when only (2) fails. M3/M4 may run on an M2-INFEASIBLE design. Part (3) detects accidental change, not tampering.

---

## 6. Payload schemas per analysis_type

Equation numbers refer to the manuscript.

### 6.1 PS — saran kapasitas awal

| Parameter | Type | Unit | Required | Rule |
|---|---|---|---|---|
| inverter_margin_ratio (m_inv) | number | — | Y | ≥ 0, no default |
| unit_count (n) | integer | count | Y | ≥ 1 |
| redundancy (r) | integer | — | Y | 0 or 1; 1 only if n ≥ 2 (N−1) |
| autonomy_h (t_aut) | integer | h | N | 1–24 |
| dc_efficiency_ratio (η_dc) | number | — | N | 0 < η ≤ 1 |
| depth_of_discharge_ratio (DoD) | number | — | N | 0 < DoD ≤ 1 |

| Output | Type | Unit | Note |
|---|---|---|---|
| load_apparent_kva | number | kVA | $S_L^{tot} = |\sum_k (P_k + jQ_k)|$ (Eq. 4.2), from the Load table. |
| required_inverter_kva | {value_kva, basis, assumptions} | kVA | $S_{inv}^{tot} = S_L^{tot}(1+m_{inv})$ (Eq. 4.2). |
| inverter_plan | {unit_count, redundancy, unit_rating_kva, installed_kva, basis, assumptions} | kVA | $S_{unit} = 0.1\lceil S_{inv}^{tot}/(0.1(n-r))\rceil$, $S_{inst} = n S_{unit}$ (Eq. 4.3); equal unit ratings; no rounding to catalogue ratings. |
| storage_energy | {e_ac_kwh, e_dc_kwh, e_nom_kwh, stage, basis, assumptions} or null | kWh | Only with LoadProfile and autonomy_h: worst circular window (Eq. 4.4), then Eq. 4.13 as far as η and DoD exist; `stage` ∈ AC, DC, NOMINAL. Null otherwise, with the reason in the basis. |
| profile_peak_kw | number or null | kW | Warning PROFILE_PEAK_ABOVE_LOADS when > $\sum_k P_k$; numbers unchanged. |

The app wraps this into a SizingAdvice (state PROPOSED). PS ignores line losses; m_inv must absorb them, and M2 rechecks rating adequacy (4.2.2).

### 6.2 M1 — aliran daya droop

`parameters`: `{}`.

| Output | Type | Unit | Note |
|---|---|---|---|
| system_frequency_hz | number | Hz | Common ω as frequency. |
| bus_results | array of {bus_id, voltage_kv, voltage_pu, angle_deg} | kV; p.u.; deg | Angle relative to the reference bus; angle errors reported absolute. |
| inverter_results | array of {inverter_id, p_kw, q_kvar, s_kva, loading_ratio} | kW; kvar; kVA; ratio | |
| line_results | array of {line_id, p_from_kw, q_from_kvar, p_to_kw, q_to_kvar, current_a, losses_kw} | kW; kvar; A | |
| total_load_kw, total_load_kvar | number | kW; kvar | |
| total_losses_kw | number | kW | ≥ 0 (sanity check). |
| iterations | integer | count | |
| epsilon_x_ratio | number | ratio | ε_X (Eq. 4.1), validity indicator for A4. |

Convergence: $\max|F_P| < 10^{-3}$ W and $\max|F_Q| < 10^{-3}$ VAR. SOLVER_FAILED when cond(J) > 10¹², the iteration limit is reached or values are non-finite; PHYSICALLY_INADMISSIBLE when a root has $V_b \le 0$ (4.2.3).

### 6.3 M2 — pemeriksaan batasan, penentuan kapasitas awal, margin

| Parameter | Type | Unit | Required | Rule |
|---|---|---|---|---|
| inverter_margin_ratio (m_inv) | number | — | Y | ≥ 0, no default |
| line_margin_ratio (m_line) | number | — | Y | ≥ 0, no default |
| autonomy_h | integer | h | N | 1–24 |
| dc_efficiency_ratio, depth_of_discharge_ratio | number | — | N | (0, 1] |

| Output | Type | Unit | Note |
|---|---|---|---|
| verdict | enum | — | FEASIBLE or INFEASIBLE (mirrors status). |
| constraint_margins | array of LimitingConstraint | per item | All evaluated checks, sorted by normalised margin ascending. |
| not_evaluated | array of {kind, element_id} | — | Checks with empty limits. |
| sizing_check | SizingCheck (§3.9) | | |
| loadability | {lambda_c, lambda_s, lambda_ub, resolution, grid_step, stop_reason} | — | Eq. 4.14–4.16; grid from λ = 1 in steps of 0.05, bisection to 0.005 around each status change, warm start; λ_s passes INFEASIBLE points until the first failure; no interpolation. λ_c > λ_ub with the loading check active flags an implementation error. λ_s is a solution-existence diagnostic, not a stability limit. |

### 6.4 M3a — local sensitivity

| Item | Type | Unit | Note |
|---|---|---|---|
| parameters.parameter_paths | array of string | — | Each resolves (§3.10); count ≤ cap. |
| parameters.output_metrics | array of enum | — | SYSTEM_FREQUENCY, MIN_BUS_VOLTAGE, MAX_BUS_VOLTAGE, MAX_INVERTER_LOADING, MAX_LINE_CURRENT, TOTAL_LOSSES. |
| parameters.step_relative / step_absolute | number | — / parameter unit | Exactly one, > 0, no default (Eq. 4.17). |
| Output: sensitivities | array of {parameter_path, metric, value, normalised_value, unit, scheme, status_change, reason} | metric unit per parameter unit | Central difference, or one-sided when one side fails (`scheme` = CENTRAL, FORWARD, BACKWARD); `status_change` flags a status difference between sides. `value` and `scheme` null when not reported (base point not admissible, h = 0, both sides failed, parameter without a value), `normalised_value` null when y0 or p0 = 0; `reason` says why (D-52 K53, D-55 K87). Relative step: h = step_relative·\|p0\| (D-55 K92). Metric units: Hz, pu, pu, ratio, A, kW. |
| Output: ranking | array of {metric, parameter_path, rank} | — | By absolute normalised effect. |

### 6.5 M3b — 1-D sweep

| Item | Type | Unit | Note |
|---|---|---|---|
| parameters.axis | Axis | | One axis (below). |
| parameters.point_metrics | array of enum | — | Optional per-point metrics beyond M1/M2: LAMBDA_C, ZETA_MIN, RE_LAMBDA_DOM, INDICATORS (the last three run M4a at each admissible point; requires tau on all Inverters). |
| parameters.include_eigenvalues | boolean | — | Default false; true adds the eigenvalue list per point (root locus). |
| Output: points | array of SweepPoint | | One per grid value. |
| Output: first_infeasible_value | number or null | axis unit | First grid value whose status is not FEASIBLE. |

**Axis:** {kind, parameter_path | element_set, field, range_min, range_max, step_count}. `kind` = PARAMETER (one field of one element) or SCALE_FACTOR (one factor applied uniformly to `field` of every element in `element_set`, keeping ratios between units; manuscript Tabel 4.10) or LOAD_SCALE (λ: P and Q of all Loads at fixed PF, Eq. 4.14). Grid: $p_k = p_{start} + k\,\Delta p$.

**SweepPoint:** {value, status, status_code, limiting_constraint, key_metrics{system_frequency_hz, min_voltage_pu, max_loading_ratio, total_losses_kw, lambda_c?, zeta_min?, re_lambda_dom_per_s?, epsilon_x_ratio, r_tau?, kappa?}, eigenvalues?}.

### 6.6 M3c — scenario comparison

| Item | Type | Note |
|---|---|---|
| request.scenarios | array of {scenario_id, label, project_snapshot} | 2 to SCENARIO_CAP; in the request and the hash. |
| parameters.reference_scenario_id | string, optional | Default: first scenario. |
| Output: scenario_results | array of {scenario_id, status, status_code, key_metrics, limiting_constraints} | No ranking (4.2.5). |
| Output: deltas | array of {metric, scenario_id, reference_scenario_id, delta, unit, relative_delta_ratio} | Explicit differences; `relative_delta_ratio` = delta / reference value, null when that is 0 (D-52 K55, D-55 K88). |

### 6.7 M3d — 2-D envelope

| Item | Type | Note |
|---|---|---|
| parameters.axis_x, axis_y | Axis (§6.5) | Point count = product of step counts ≤ SWEEP_CAP. |
| parameters.point_metrics, include_eigenvalues | as §6.5 | |
| Output: grid | array of SweepPoint with {x_value, y_value} | |
| Output: feasible_fraction | number (0–1) | Share of FEASIBLE points. |

### 6.8 M4a — small-signal stability

| Item | Type | Unit | Note |
|---|---|---|---|
| parameters.tau_in_s | number, optional | s | Inner-loop time constant for r_in; without it r_in is "not evaluated". |
| parameters.damping_threshold_ratio | number, optional | — | User pass threshold; without it no pass/fail on damping (4.2.6). |
| Output: eigenvalues | array of {real_per_s, imag_per_s} | 1/s | State dimension $(N-1) + 2N$ (δ_j, P_f,i, Q_f,i). |
| Output: modes | array of {eigenvalue_index, damping_ratio, frequency_hz} | —; Hz | Eq. 4.20; `damping_ratio` null for λ = 0 (D-55 K87). |
| Output: zeta_min | number or null | — | Lowest damping among oscillatory modes. |
| Output: dominant_modes | array of {eigenvalue_index, damping_ratio, frequency_hz, associated_element_ids} | | |
| Output: participation | {state_names[], factors[mode][state]} or null | — | Eq. 4.21; null when the eigenvector matrix is ill-conditioned (reason in diagnostics). |
| Output: stability_class | enum | — | STABLE if $\max_k \mathrm{Re}\,\lambda_k < -t_\lambda$, UNSTABLE if $> t_\lambda$, MARGINAL otherwise; $t_\lambda = 10^{-9}\max_k|\lambda_k|$. |
| Output: indicators | {r_tau, kappa, r_in, epsilon_x} each {value, evaluated, reason} | — | Eq. 4.23, 4.1; thresholds null until stage 1.6, warning VALIDITY_NOT_CALIBRATED. |
| Output: outside_definition | boolean | — | True when the operating point violates constraints (label "outside definition [19]"). |
| Output: damping_pass | boolean or null | — | ζ_min ≥ damping_threshold_ratio; null without a threshold or without oscillatory modes (D-53 K65, D-55 K89). |

Initialised from the M1 payload; requires cond($g_y$) ≤ 10¹² (else SOLVER_FAILED).

### 6.9 M4b — transient stability

| Item | Type | Unit | Note |
|---|---|---|---|
| parameters.disturbance.kind | enum | — | LOAD_STEP, LOAD_SCALING, REFERENCE_STEP, INVERTER_OUTAGE (four kinds, manuscript 4.2.6). |
| parameters.disturbance.element_id | string or `ALL` | — | Load id (LOAD_STEP); Load id or ALL (LOAD_SCALING); Inverter id (REFERENCE_STEP, INVERTER_OUTAGE). |
| parameters.disturbance.reference | enum | — | REFERENCE_STEP only: P_SETPOINT, Q_SETPOINT, V_SETPOINT, F_SETPOINT. |
| parameters.disturbance.magnitude | number | kW (LOAD_STEP Δp), ratio (LOAD_SCALING, > 0), kW / kvar / kV / Hz (REFERENCE_STEP by reference) | Unused for INVERTER_OUTAGE. |
| parameters.disturbance.magnitude_kvar | number, optional | kvar | LOAD_STEP Δq; absent = 0. |
| parameters.disturbance.start_time_s | number | s | ≥ 0. |
| parameters.disturbance.duration_s | number or null | s | Step and scaling: null = permanent; finite = reverts. Outage: always permanent. |
| parameters.simulation_end_s | number | s | > start_time_s; ≤ cap. |
| parameters.settling | {frequency_band_hz, voltage_band_kv, window_s}, optional | Hz; kV; s | Each > 0, no defaults; bands around the final value over the final window; window ≤ simulation_end_s − start_time_s. Without it no class is set (D-53 K67, D-55 K90). Invalid → DISTURBANCE_INVALID. |
| Output: time_s | array | s | |
| Output: system_frequency_hz | array | Hz | |
| Output: bus_voltage_kv | array of {bus_id, values[]} | kV | |
| Output: inverter_p_kw, inverter_q_kvar | array of {inverter_id, values[]} | kW; kvar | |
| Output: max_rocof_hz_per_s | number | Hz/s | Descriptive; from $d\omega_i/dt = -m_{p,i}\,dP_{f,i}/dt$. |
| Output: transient_class | enum or null | — | Null without `settling` (reason in `class_reason`, D-55 K90); RECOVERED_STABLE, CRITERIA_VIOLATED, UNSTABLE (all with status FEASIBLE). Simulation failure → SOLVER_FAILED (SIMULATION_FAILED); invalid configuration → INPUT_INVALID. "Simulation did not fail" is never a stability criterion. |
| Output: settled | boolean or null | — | Settling-window result used for the class; null without `settling`. |
| Output: class_reason | string or null | — | Why the class is set or not (e.g. "settling criteria not given", "not settled", network lost). |

Integrator: LSODA, relative tolerance 10⁻⁸, horizon split at the disturbance, up to eight retries (4.2.6). Time step and output sampling are engine-defined.

---

## 7. RunRecord schema (17 fields, manuscript Tabel D.2)

Created by the application service for **every** analysis request, whatever the status; never by the engine. Engine fields are null when the engine was not called.

| Group | Field | Type | Note |
|---|---|---|---|
| Identity | record_id | string (id) | Generated by the app. |
| | schema_version | integer ≥ 1 | RunRecord layout. |
| | app_version | string | App version (also pins library versions via the lock file). |
| | created_at | timestamp | |
| Input | analysis_type | enum | |
| | parameters | object | |
| | snapshot | object | Canonical snapshot. |
| | snapshot_hash | 64 hex | Over `snapshot` (M3c: over {snapshot, scenarios}). |
| | scenarios | array or absent | M3c only. |
| | depends_on | RunRecordRef or absent | Dependent analyses only. |
| | solver_config | object | |
| Engine | engine_version | string or null | |
| | engine_git_commit | string or null | |
| | engine_kind | FAKE, REAL or null | |
| Result | result | AnalysisResult | Including warnings and diagnostics. |
| | result_hash | 64 hex | SHA-256 of canonical {status, payload}. |
| Replay | replay_of_record_id | string or absent | Set on re-run. |

**Canonical snapshot content:** nominal voltage and frequency, buses (without diagram positions and names), lines (entered per-km values, length, server-derived r_ohm and x_ohm), loads, load profile, inverters, design constraints, and accepted/edited SizingAdvice values adopted into the design. Excludes names, descriptions, timestamps, scenarios list, run records and non-accepted advice. A Scenario run uses the base design with overrides applied.

**Canonicalisation (six rules, tested in WP 1.1.4):** (1) JSON UTF-8 without insignificant whitespace; (2) keys sorted by Unicode code point; (3) entity arrays sorted by id, other arrays keep order; (4) numbers as the shortest round-trip decimal text, no NaN/Infinity, `-0` as `0`; (5) standard JSON escaping; (6) SHA-256 in lowercase hex.

**Import:** schema_version supported; both hashes recomputed; a mismatch refuses the file (HASH_MISMATCH); the imported record is never modified. Differing non-null engine version/commit → warn and still re-run. **REPRODUCED** iff the re-run has the same status and equal result_hash; otherwise **DIFFERS** with the differences listed. Tolerances apply only to engine-vs-PSIM (Doc 13). REPRODUCED does not prove correctness.

---

## 8. Project file schema

One JSON document; the open Project lives in the browser; the server stores and writes nothing (ADR-010).

| Top-level field | Type | Required | Note |
|---|---|---|---|
| schema_version | integer | Y | Checked first. Bumped by this alignment (Inverter tau and setpoint fields, optional DesignConstraints, SizingAdvice ps_parameters). |
| app_version | string | Y | |
| project | Project | Y | |
| buses, lines, loads, inverters | arrays | Y | |
| load_profile | LoadProfile or null | Y | |
| design_constraints | DesignConstraints | Y | All limits may be empty. |
| sizing_advice | array of SizingAdvice | Y | At most one in effect (latest ACCEPTED/EDITED). |
| scenarios | array of Scenario | Y | |
| run_records | array of RunRecord | Y | |

Versioning: equal → load; older with a chain → migrate forward step by step and tell the user; newer, missing, non-integer or no chain → refuse, nothing loaded or overwritten; stage-1 validation after migration, errors shown, not fixed; unreadable RunRecords reported and skipped, never deleted silently.

---

## 9. Open points

| # | Item | Tag |
|---|---|---|
| 1 | Droop unit conversion in the Real Engine adapter (§1) to be confirmed against the engine package. | CLOSED (Doc 9 D-54 K74) |
| 2 | Caps: M3a parameter count, M3c SCENARIO_CAP, M4b duration; 413 body limit initial 10 MiB (Doc 6). | [ASSUMPTION] → WP 1.7.1 |
| 3 | `balance_tolerance_kw` default and whether it belongs to DesignConstraints or solver_config. | CLOSED: no default, stays in DesignConstraints (Doc 9 D-54 K84) |
| 4 | Settling window and envelope criteria for the transient class (engine side). | → engine design, stage 1.3.5 |
| 5 | Indicator thresholds (r_τ, κ, r_in, ε_X) calibrated from M5. | → stage 1.6 |
| 6 | Doc 12 extensions (catalogue, BatteryBank, sharing metrics, profile hour axis) merged at stage 1.5. Catalogue document, `catalog_ref` on Inverter and Line, and unit suffixes `_v` (V) and `_uf_per_km` (µF/km) for catalogue fields applied by Doc 9 D-61; BatteryBank, sharing metrics and the profile hour axis still open. | PARTLY APPLIED |

## Log

| Date | Change |
|---|---|
| 2026-10-17 – 10-21 | Revisions 1–2 and change proposals C5.5–C5.7 (see Doc 14 history). |
| 2026-11-01 | Aligned with the final manuscript (Doc 14 items A1–A20): PS and M2 parameters, SizingCheck fields, loadability margins, optional constraints with "not evaluated", Inverter tau and P*/Q*, M3 axis kinds and per-point metrics, M3 status set, M4a stability class, participation and indicators, M4b four-kind catalogue and transient class, allowed Status per type, warnings, solver defaults, Engine Port rules, 17-field RunRecord grouping; equations allowed. |
| 2026-11-02 | Stage 1.4 (Doc 9 D-54): droop conversion confirmed (§1, §9 #1); `balance_tolerance_kw` absent = not evaluated (§3.7, §9 #3). |
| 2026-11-02 | Stage 1.5 (Doc 9 D-55 K87–K92, to be confirmed): M3a nullable `value`/`normalised_value`/`scheme` + `reason`, relative step rule (§6.4); M3c `relative_delta_ratio` (§6.6); M4a nullable `damping_ratio`, `damping_pass` (§6.8); M4b `settling` parameter, nullable `transient_class`/`settled`, `class_reason` (§6.9); codes MULTIPLE_INVERTERS_ON_BUS (§4) and EQUILIBRIUM_INVALID (§5.4). |
