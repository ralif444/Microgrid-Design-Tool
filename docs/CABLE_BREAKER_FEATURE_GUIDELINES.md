# CABLE_BREAKER_FEATURE_GUIDELINES — Cable and overload-protection sizing (v1)

> Standalone build guideline for Claude Code, in the same style as the SLD guideline. Date: 2026-11-08.
> Inputs: `claude/SUMBER_kabel_proteksi_PUIL2011_v1.md` (PUIL 2011 clause/table map, called **SUMBER-PUIL** below), `claude/SUMBER_standar_katalog_v1.md` (editions, catalogues), Docs 03, 06, 07, 12, user decisions of 2026-11-07/08.
> Equations are allowed in design documents. Rules that the author derived are marked **[DERIVED]**; design choices without a standard behind them are marked **[DESIGN CHOICE]**.

## 0. Status and guardrails

| Item | Rule |
|---|---|
| Thesis scope | **KONFLIK:** the manuscript lists "protection" as out of scope. This feature needs supervisor approval before it enters the thesis. Until then it is built behind a feature flag, `Settings.feature_cable_sizing` (env `MGAPP_FEATURE_CABLE_SIZING`, already in `backend/src/mgapp/config.py`), **off by default**. With the flag off, the route returns `UNAVAILABLE / NOT_APPLICABLE` and the screen is hidden. |
| What it is | One-shot, rule-of-thumb advice: overload rating of the breaker plus conductor size. It is **not** a protection or coordination study. There are no short-circuit, breaking-capacity, selectivity, earthing, neutral or PE checks. |
| Islanded caveat (fixed text in screen and report) | "Grid-forming inverters limit their fault current. A breaker sized here for overload may not trip on a fault in islanded operation. Fault protection is not assessed by this tool." |
| Where it runs | An **app-side Python service** (`backend/src/mgapp/services/cable_sizing/`), not the engine. It never calls the Engine Port. It adds no equation, state or assumption to the engine model (Doc 12 level L2: derived output). |
| Technical baseline | **PUIL 2011 (SNI 0225:2011)**, the edition the user holds. Bagian 4-43 is based on IEC 60364-4-43:2008 and Bagian 5-52 on IEC 60364-5-52:2001 (Annex A numbering, single method D). **Legal note:** Permen ESDM 7/2021 lists PUIL 2020 as the mandatory edition. Record this as KONFLIK in Doc 9 and in the thesis; migrate when PUIL 2020 is obtained (SUMBER-PUIL §8.4). |
| Data policy | The app ships **no standard tables and no vendor data**. The user transcribes the PUIL tables into a table file (§4) and fills the catalogues. If the GitHub repo is public, keep the filled table file out of it (`.gitignore`, loaded from a user path), because PUIL is copyrighted. |

## 1. Decisions applied (user, 2026-11-08)

| # | Decision |
|---|---|
| D1 | Design current for lines: $I_B$ = M2 `sizing_check.per_line[].required_current_a`, i.e. $I_\ell(1+m_{line})$ (Doc 3 §3.9). This uses the base design only. A worst-scenario $I_B$ is **deferred**: M3c does not return per-line currents, so it would need a contract change. |
| D2 | Design current for inverter output feeders: the rated current $I_{r,i} = S_{r,i}/(\sqrt3\,V_n)$ (A, with $S_r$ in kVA and $V_n$ in kV line-to-line). |
| D3 | Advice only. Nothing is written back into Line R/X. Raise the warning `LINE_R_MISMATCH` when the selected cable's resistance differs from the entered line resistance by more than 10 % (§3.5). |
| D4 | No separate voltage-drop check: M1/M2 node voltages already cover it. |
| D5 | One set of installation defaults per Project, overridable per element (§2.2). |
| D6 | Device class: MCB to IEC 60898-1 when $I_n \le 63$ A, MCCB to IEC 60947-2 above. The threshold is a configurable [DESIGN CHOICE] (confirmed by the user, 2026-11-08). |
| D7 | $k_2 = I_2/I_n$ comes from the device-class record in the table file, with its source. Seed values: 1,45 (IEC 60898-1) and 1,30 (IEC 60947-2). Both are stated by the manufacturer in Schneider FAQ FA369327, and ABB's 2021 MCB catalogue confirms 1,45. This is allowed because PUIL 433.1 says $I_2$ "harus disediakan oleh pabrikan atau diberikan dalam standar produk". Replace with the product-standard clause once bought. |
| D8 | Rated-current series: a user-editable list per device class in the table file, seeded from a real catalogue, never hard-coded. The PUIL Tabel 7.3-1/7.3-4 series is fuse-type; do not use it for MCBs (SUMBER-PUIL §5). |
| D9 | v1 methods: **B1, A1, C, D (buried duct)**. Direct burial is deferred (SUMBER-PUIL §3.2, §8.1). |
| D10 | R_DC source: IEC 60228 class 2 is primary once bought; PUIL Tabel 7.3-40 is the cross-check (SUMBER-PUIL §4.2). |
| D11 | Catalogue match: the nearest catalogue cable at or above the chosen size, with the same conductor, insulation and cores. Datasheet ampacity and conditions are shown **as a check only**. Breaker: an availability check for the same standard and $I_n$. The UL-based breaker CSV is never used for $I_n$ steps. |
| D12 | SLD: breaker symbol on each sized line and feeder, with no extra label (specs on hover). Report: one results table plus the caveat. |
| D13 | Method registry: v1 has one method, `IEC60364_OVERLOAD_PUIL2011`. Other methods can be added later without changing the screen or contract (§5). |

## 2. Inputs

### 2.1 Elements sized
- Every `Line` of the Project, with $I_B$ from D1.
- Every `Inverter`, as an implicit output feeder (inverter terminals to its bus), with $I_B$ from D2. Feeder length is not needed, because there is no voltage drop and no R check.

### 2.2 Installation parameters (`CableSizingSettings`)
These are stored in the Project as design data for this feature only, not in the engine snapshot.

| Field | Type | Unit | Rule | Note |
|---|---|---|---|---|
| method | enum | — | B1, A1, C, D_DUCT | PUIL Tabel A.52-1 reference methods |
| conductor | enum | — | CU, AL | Al allowed from 2,5 mm² (table range) |
| insulation | enum | — | PVC, XLPE | max conductor temperature 70 / 90 °C (PUIL Tabel 52-4) |
| ambient_temp_c | number | °C | finite | air (A1, B1, C) or ground (D) |
| soil_resistivity_k_m_per_w | number | K·m/W | > 0; D only | Tabel A.52-16 |
| grouping_count | integer | count | ≥ 1 | circuits or multicore cables in the group |
| grouping_arrangement | enum | — | BUNCHED, SINGLE_LAYER_WALL, UNDER_CEILING (A–C); DUCT_TOUCHING, DUCT_0_25M, DUCT_0_5M, DUCT_1M (D) | rows of A.52-17 or columns of A.52-19 |
| cable_construction | enum | — | MULTICORE, SINGLE_CORE | selects A.52-19 part A or B for D |
| per_element_overrides | map id → partial settings | — | — | D5 |

Loaded conductors are always **3**, because the network is balanced three-phase (A6) and the neutral is out of scope. So v1 needs only **Tabel A.52-4 (PVC, 3 loaded)** and **A.52-5 (XLPE, 3 loaded)**. The 2-loaded tables A.52-2/-3 do not need transcribing.

## 3. Method `IEC60364_OVERLOAD_PUIL2011`

### 3.1 Conditions (PUIL 2011 Ayat 433.1, p. 161, PDF p. 205; wording in SUMBER-PUIL §2)

$$I_B \le I_n \le I_Z \tag{CB.1}$$
$$I_2 \le 1{,}45\, I_Z \tag{CB.2}$$

$I_B$ is the design current (A), $I_n$ the device rated current or the selected setting for adjustable devices (433.1 CATATAN 1) (A), $I_Z$ the continuous current-carrying capacity (KHA) of the cable (A), and $I_2$ the conventional operating current of the device (A).

### 3.2 Current-carrying capacity
Assumed form from 523.2 and A.52.2. **Confirm the wording against 523.2 before it goes into Bab III** (SUMBER-PUIL §3.3).

$$I_Z(S) = I_{tab}(S, \text{method}, \text{conductor}, \text{insulation})\cdot k_\theta \cdot k_\rho \cdot k_g \tag{CB.3}$$

| Factor | Methods A1, B1, C | Method D (buried duct) |
|---|---|---|
| $I_{tab}$ | A.52-4 / A.52-5, columns A1, B1, C | A.52-4 / A.52-5, column D |
| $k_\theta$ | Tabel A.52-14 (air, reference 30 °C) | Tabel A.52-15 (ground, reference **20 °C**) |
| $k_\rho$ | 1 | Tabel A.52-16 (reference 2,5 K·m/W) |
| $k_g$ | Tabel A.52-17, row by arrangement (rows 1–3; C uses row 2 or 3) | Tabel A.52-19 part A or B |

Lookup rules [DESIGN CHOICE]:
- No interpolation. If ambient temperature, resistivity or group size is not a tabulated value, take the **next more severe** tabulated value: higher temperature, higher resistivity, larger group. Record the value used.
- A blank table cell (for example B1 above 120 mm², or PVC above 60 °C in A.52-14) means "not available" and is never treated as 0.
- If the group size exceeds the table, use the last column only where the table note allows it. A.52-17 rows 2–3 give no further reduction beyond 9 circuits. Otherwise the element outcome is `OUT_OF_TABLE`.

### 3.3 Selection algorithm (per element)
1. Device class from $I_B$ (D6). Let $\mathcal{I}$ be that class's rated-current series and $k_2$ its factor (D7).
2. $I_n = \min\{ I \in \mathcal{I} : I \ge I_B \}$. If the set is empty, the outcome is `NO_DEVICE_FITS`. If the result exceeds 63 A while the class is MCB, switch to the MCCB class and repeat from step 1. *Note (user decision 2026-11-09, Doc 9 D-101 K273): an empty MCB set also switches to MCCB; `NO_DEVICE_FITS` only when the MCCB set is empty too.*
3. $I_2 = k_2 I_n$.
4. $S = \min\{ S \in \mathcal{S} : I_Z(S) \ge I_n \ \wedge\ I_2 \le 1{,}45\, I_Z(S) \}$ over the size list $\mathcal{S}$ (Cu 1,5–300 mm², Al 2,5–300 mm², PUIL Tabel 7.1-1 ∩ the KHA table range). Equivalently, $I_Z(S) \ge I_n \max(1, k_2/1{,}45)$ **[DERIVED]**. If no size fits, the outcome is `NO_SIZE_FITS`. Parallel conductors (PUIL 4-43 Lampiran A) are not supported in v1.
5. Report both conditions explicitly, even when (CB.2) is satisfied automatically ($k_2 \le 1{,}45$).

Choosing $I_n$ first and the cable second keeps the device at the smallest rating that carries $I_B$. That follows the order of (CB.1). It is not stated as a procedure in PUIL, so it is a [DESIGN CHOICE].

### 3.4 Margins shown
$I_n - I_B$ (A), $I_Z - I_n$ (A) and $1{,}45 I_Z - I_2$ (A); all are ≥ 0 when the element is sized.

### 3.5 Resistance consistency check (D3)
Correct the cable's $R_{20}$ (Ω/km, from the table file, D10) to the insulation's maximum conductor temperature $t$ (70 °C PVC, 90 °C XLPE) with PUIL Tabel 7.3-40:

$$R_t = R_{20}\frac{234{,}5 + t}{254{,}5}\ \text{(Cu)},\qquad R_t = R_{20}\frac{228 + t}{248}\ \text{(Al)} \qquad [\Omega/\text{km}] \tag{CB.4}$$

$$\delta_R = \frac{|r_{line} - R_t|}{R_t}, \qquad \text{warning LINE\_R\_MISMATCH} \iff \delta_R > 0{,}10 \tag{CB.5}$$

$r_{line}$ is the entered `r_ohm_per_km`. Using the maximum temperature and the 10 % threshold are [DESIGN CHOICE]s. $R_{AC}$ (skin effect) and reactance are not available from PUIL, so there is no X check; mark this [PERLU REF] in the thesis. Inverter feeders get no R check.

## 4. Table file (`cable_tables.json`, user-filled, versioned)

```json
{
  "schema_version": 1,
  "table_set_id": "PUIL2011",
  "source": {"document": "SNI 0225:2011 (PUIL 2011)", "edition": "2011", "entered_by": "<name>", "entered_on": "YYYY-MM-DD", "double_entry_checked": false},
  "sizes_mm2": {"CU": [], "AL": []},
  "r20_ohm_per_km": {"source": {"table": "Tabel 7.3-40", "page": "545/589"}, "CU": {}, "AL": {}},
  "ampacity": [
    {"table": "A.52-4", "page": "296/340", "insulation": "PVC", "loaded_conductors": 3,
     "conductor": "CU", "method": "B1", "values_a": {"1.5": null}}
  ],
  "k_theta_air":  {"table": "A.52-14", "page": "306/350", "ref_c": 30, "PVC": {}, "XLPE": {}},
  "k_theta_ground": {"table": "A.52-15", "page": "306/350", "ref_c": 20, "PVC": {}, "XLPE": {}},
  "k_rho": {"table": "A.52-16", "page": "307/351", "ref_k_m_per_w": 2.5, "values": {}},
  "k_group": {"A.52-17": {"page": "307/351", "rows": {}}, "A.52-19A": {"page": "309/353"}, "A.52-19B": {"page": "309/353"}},
  "device_classes": [
    {"class": "MCB",  "standard": "IEC 60898-1", "k2": 1.45, "k2_source": "Schneider FAQ FA369327; ABB MCB catalogue 2021", "in_series_a": [], "in_series_source": "<catalogue, page>", "max_in_a": 63},
    {"class": "MCCB", "standard": "IEC 60947-2", "k2": 1.30, "k2_source": "Schneider FAQ FA369327", "in_series_a": [], "in_series_source": "<catalogue, page>"}
  ]
}
```

Rules:
- The server validates the file. An empty `in_series_a`, a missing table for the selected method, or `double_entry_checked: false` all give `INPUT_INVALID` with code `CABLE_TABLES_INCOMPLETE` or `CABLE_TABLES_UNCHECKED`.
- The SHA-256 of the canonical table file (Doc 3 §7 canonicalisation rules) is stored as `table_set_hash` in the RunRecord parameters, so any table edit is traceable.
- Values are entered as printed. **Do not copy the PUIL errata** listed in SUMBER-PUIL §7 (the "5285" KHA value, the Tabel 7.3-40 anomalies); enter the value confirmed from the page image and note it in `source`.
- Transcription workflow: hand-enter A.52-4/-5 from PDF pp. 340–341 (image only), enter them a second time independently, diff the two by script, then set `double_entry_checked: true`.

## 5. Contracts

### 5.1 Method registry (Python)
```python
class SizingMethod(Protocol):
    method_id: str            # "IEC60364_OVERLOAD_PUIL2011"
    def validate(self, settings, tables) -> list[ValidationIssue]: ...
    def size(self, elements: list[SizingElement], settings, tables) -> list[ElementSizing]: ...
```
The registry maps `method_id` to an implementation. The screen lists the registered methods; v1 shows one.

### 5.2 Endpoint
`POST /api/analyses/CB` (new analysis type `CB`, app-side). Same pipeline and response as the other analyses (Doc 6 §4): stage-1 validation, canonicalise and hash, dependency check, then a RunRecord. The difference is that the service computes the result itself, with no Engine Port call: `engine_kind` and the other engine fields are null, and `diagnostics.computed_by` is `"app"`.

| Field | Rule |
|---|---|
| `depends_on` | A RunRecordRef to an **M2** record (status FEASIBLE or INFEASIBLE), with the three-part check of Doc 3 §5.4 applied to M2. M2 already depends on a valid M1. Missing or stale → `UNAVAILABLE / DEPENDENCY_NOT_MET`. |
| `parameters` | `{method_id, settings: CableSizingSettings, tables: <table file>, table_set_hash}` |
| Allowed Status | FEASIBLE (the request completed; per-element outcomes in the payload), INPUT_INVALID, UNAVAILABLE. Like M3, an element that could not be sized does not change the request status. |

### 5.3 Payload
```
elements[]: {
  element_id, element_kind (LINE | INVERTER_FEEDER),
  ib_a, ib_source ("M2.sizing_check.per_line" | "inverter_rated_current"),
  device: {class, standard, in_a, k2, k2_source, i2_a},
  cable: {conductor, insulation, method, size_mm2, i_tab_a, k_theta, k_rho, k_g,
          lookup_values {temp_c_used, rho_used, group_used}, iz_a},
  checks: {cond1_ok, cond2_ok, margin_in_ib_a, margin_iz_in_a, margin_145iz_i2_a},
  r_check: {r_line_ohm_per_km, r_cable_ohm_per_km, temp_c, deviation_ratio, flagged} | null,
  catalogue_match: {cable_entry_id | null, cable_datasheet_ampacity_a, cable_conditions,
                    breaker_entry_id | null} ,
  outcome: SIZED | NO_DEVICE_FITS | NO_SIZE_FITS | OUT_OF_TABLE | TABLE_GAP,
  notes[]
}
method_id, table_set_id, table_set_hash, caveat_text
```
Warnings: `LINE_R_MISMATCH` (per line), `DIRECT_BURIAL_NOT_SUPPORTED`, `FEATURE_EXPERIMENTAL` (always present while the supervisor's approval is pending).

## 6. UI

| Item | Spec |
|---|---|
| Screen | S-19 "Cable and breaker sizing" (`/cable-sizing/`) under Further analyses. Hidden when the flag is off. Enabled only with a valid M2 (same gating pattern as Doc 7 §3.1). |
| Layout | Settings panel (project defaults) → Run → status banner → results table (one row per element: element, I_B, device class and In, size, I_Z, both conditions with ✓/✗, outcome, R warning icon) → a row expands to show the factors, the table and page used for each factor, and the catalogue match. The fixed caveat sits above the table. |
| Status styling | Carbon support colours + icon + word for outcomes; never brand colours. |
| Glossary tooltips | KHA / I_Z, I_B, I_n, I_2, k_θ, k_ρ, k_g (Indonesian term + one line). |
| SLD | A breaker symbol on each sized line and feeder (IEEE symbol, consistent with the existing SLD guideline). The hover card shows In, class, size and I_Z. No symbol for unsized elements. |
| Report | Section "Cable and overload sizing (experimental)": the table, method and table-set id with hash, the caveat, the KONFLIK note about the PUIL edition. |
| Catalogue | Reuse the S-18 Catalogue. Add the entry kind `BREAKER` {standard, class, in_a, curve, poles, provenance}. Conductor entries already exist (FR-68). The Al LV CSV from 2026-11-08 can be imported as conductor entries; each keeps its datasheet conditions. |

## 7. Tests

| Level | Test |
|---|---|
| Unit | lookup_next_more_severe_value; blank_cell_is_gap_not_zero; cb1_cb2_both_reported; mcb_to_mccb_switch_above_63a; no_device_fits; no_size_fits; r_correction_cu_al (CB.4 against a hand value); table_hash_changes_on_edit |
| Contract | flag_off_returns_not_applicable; depends_on_m2_missing_or_stale; unchecked_tables_input_invalid; engine_fields_null; per_element_outcome_does_not_change_status |
| Hand-calculation cases (thesis verification) | **H1** Cu PVC B1, 30 °C, 1 circuit (all factors 1). **H2** Al XLPE C, 40 °C, 3 circuits SINGLE_LAYER_WALL. **H3** Cu XLPE D duct, ground 30 °C, ρ 1,5 K·m/W, 2 ducts touching. **H4** I_B in the MCCB range (> 63 A). **H5** B1 above 120 mm² → TABLE_GAP. **H6** a line whose entered r is more than 10 % off → LINE_R_MISMATCH. Expected values are computed by hand from the user's transcribed tables **before** the code runs. Tolerance: exact size and In; I_Z to 0,01 A. |
| Validation (user decision 2026-11-08: PSIM and Simulink only, no ETAP) | (a) **Input chain:** I_B comes from M1/M2 line currents, which are already validated against PSIM in M5. For the reference design used in H-cases, list the PSIM line currents next to the tool's I_B and give the % error under the frozen M5 tolerance policy. No new PSIM model is needed. (b) **Rule chain:** the sizing rule is a deterministic table lookup, so hand calculation (H1–H6, exact match) is its verification. PSIM and Simulink do not implement IEC 60364/PUIL ampacity or breaker selection, so they cannot validate this part. (c) **Optional literature check:** reproduce one worked example from a citable textbook by loading that book's tables into a test table file [PERLU REF]; vendor handbooks are not citable under the project source rules. State in Bab III/IV why no cable-sizing software comparison is made. |
| E2E | screen_hidden_when_flag_off; run_shows_caveat; sld_shows_breaker_symbols_after_run |

## 8. Doc-set and thesis updates
- **Doc 12:** new extension **X10** "Cable and overload-protection sizing" (level L2, Could), FR numbers from **FR-105** (FR-86 – FR-104 are taken by X0–X9; X9 is example mode). Gate 1.4 has passed in the repo, so a real M2 exists. Add the `BREAKER` catalogue kind. Follow the repo's round pattern: a docs-only gate first (X10-0, like SLD-0), with new FRs listed as seam-6 exceptions until tested.
- **Doc 9 register:**
  - KONFLIK "protection out of scope".
  - KONFLIK "PUIL 2011 baseline vs Permen ESDM 7/2021 (PUIL 2020)".
  - [ASSUMPTION] CB.3 form.
  - [DESIGN CHOICE] D6 threshold, lookup rule, 10 % R threshold.
- **Doc 3 / Doc 6 (at the stage-1.5 merge):**
  - analysis_type `CB`;
  - `depends_on` on M2;
  - the table-file schema;
  - warning codes `LINE_R_MISMATCH`, `FEATURE_EXPERIMENTAL`, `DIRECT_BURIAL_NOT_SUPPORTED`;
  - stage-1 codes `CABLE_TABLES_INCOMPLETE`, `CABLE_TABLES_UNCHECKED`.
- **Thesis (only after approval):**
  - Bab II: 433.1 and 523 as cited from PUIL 2011.
  - Bab III: CB.1–CB.5 with the derived/design-choice labels.
  - Bab IV: H1–H6 (verification) plus the PSIM line-current comparison for I_B (validation of the input chain).
  - Cite PUIL 2011, IEC 60364-4-43/-5-52 (editions per SUMBER), IEC 60898-1, IEC 60947-2 and IEC 60228, all to be verified before citing.

## 9. Before you start coding (checklist)
- [ ] Supervisor informed of both KONFLIK items (approval is not needed to build behind the flag).
- [ ] A.52-4 and A.52-5 transcribed, double-entered and diffed. A.52-14/-15/-16/-17/-19 checked against the page images (SUMBER-PUIL §3.3 values come from the text layer).
- [ ] Tabel 7.3-40 R20 entered (IEC 60228 later).
- [ ] MCB and MCCB rated-current series entered from one IEC-market catalogue, with page.
- [ ] H1–H6 expected values computed by hand.
- [x] A real M2 is available (gate 1.4 passed). Unit and contract tests still use Fake-Engine M2 fixtures.

## 10. Prompt for Claude Code
```
Read CABLE_BREAKER_FEATURE_GUIDELINES.md fully, then docs 03, 06, 07 and 12 of the repo doc set.
Implement the cable and breaker sizing feature exactly as specified, behind Settings.feature_cable_sizing (off by default). Tickets: .scratch/cable-sizing/issues/. One round per ticket, each with its gate_log entry:
0. Round X10-0 (docs only, gate_log entry): Doc 12 X10 with FR-105 onward, Doc 9 entries of §8, Doc 7 S-19, Doc 11 rows; seam-6 exceptions for the new FRs.
1. backend/src/mgapp/services/cable_sizing/: method registry, method IEC60364_OVERLOAD_PUIL2011 (§3), table-file loader and validator (§4).
2. POST /api/analyses/CB through the existing pipeline, depends_on = M2, engine fields null (§5).
3. Screen S-19, SLD breaker symbols, report section, BREAKER catalogue kind (§6).
4. Tests of §7: unit and contract first (TDD), using a FICTITIOUS test table file with round numbers.
   Never put PUIL values in the repo or in tests.
Do not invent table values, k2 values or rated-current series. Where data is missing, return the specified INPUT_INVALID codes.
Stop and ask if any rule here conflicts with docs 03/06/07/12.
```

## Log delegasi
| Task | Model | Retries/escalation | Orchestrator fixes |
|---|---|---|---|
| Guideline drafted from user decisions + SUMBER-PUIL + Docs 03/06/07/12 | Opus inline | — | k2 for IEC 60947-2 set from Schneider FAQ FA369327 (verified 2026-11-07); worst-scenario I_B deferred (no per-line currents in M3c) |
| 2026-11-08 repo setup | Opus inline | — | Paths matched to the repo (backend/src/mgapp), extension code X10, FR from FR-105 (renumbered 2026-11-08 by the user: X9 and FR-99 – FR-104 are example mode), flag added to config.py, tickets in .scratch/cable-sizing/ |
| 2026-11-08 revision | Opus inline | — | ETAP comparison replaced by PSIM input-chain validation + hand verification (user: PSIM/Simulink only); 63 A threshold and FR ≥ 86 confirmed |
