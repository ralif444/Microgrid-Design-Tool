# Case data sources (collected 2026-11-19)

Purpose: real data and sources for the cases still running on fictitious or undecided values
(battery hand cases, PSIM layer 2, cable and breaker sizing). Nothing here is applied to the app
or the docs yet; the user verifies the battery and PSIM cases (user decision 2026-11-19).

Labels: **READ** = value read in the named document at the named page. **VERIFIED** = DOI
checked at Crossref (title, authors, venue, volume, pages match); the content was not read
unless also READ. **DERIVED** = arithmetic on READ values, shown. **UNVERIFIED** = from search
snippets or memory; do not cite until checked. **NOT FOUND** = searched, nothing usable.

## 1. Battery hand cases (BESS adequacy, Doc 12 §12)

State of the cases: V1–V6 were recomputed on the current D2 (commit 4913813). D2 network,
inverters and loads are catalogue values; only the battery module, the DC window and the 24-h
load profile are fictitious. These three are what this section sources.

### 1.1 TRUMPF TruConvert DC window and efficiency (READ)

- *Data Sheets TruConvert*, TRUMPF Hüttinger, 23.07.2024, p. 5 (AC 3025):
  [Data_Sheet_TruConvert.pdf](https://www.trumpf.com/filestorage/TRUMPF_Master/Products/Power_Electronics/Energy_storage/Data_Sheet_TruConvert.pdf)
  - Max. efficiency 98 % (a maximum, not a weighted efficiency).
  - DC-link nominal current listed for 750 V (36 A) to 950 V (28 A); "maximum output voltage
    950 VDC". No separate "DC minimum" line is printed: the 750 V lower bound of the catalogue
    window is read from the current table. Note this in the catalogue source text.
- Same datasheet, p. 4 (DC 1030 DC/DC converter): DC link 850 V ±10 %, battery side
  current-controlled 200–700 V, 30 kW, max. efficiency 99.5 %.
  - Route via DC 1030 (not modelled by the app): battery window 200–700 V; efficiency chain
    DERIVED 0.995 × 0.98 = 0.975 (both maximum values, so optimistic).
- *FAQ TruConvert Series*, Mar 2023, p. 2: up to 950 V directly on the AC 3025 DC link; the DC
  link must stay ≥ 50 V above the battery voltage with DC 1030.
- Open: the AC 3025 operating manual DC-link minimum (manual not yet searched for it).

### 1.2 Battery candidate that fits 750–950 V (READ)

Rule (Doc 12 Eq. 12.3): n·V_min ≥ 750 V and n·V_max ≤ 950 V, so the window ratio must be ≤ 1.267.

**Energysynt zeroCO2 XL "BESS 125K"** (Pylontech H32148-C LFP modules), *Battery Energy Storage
Systems for C&I Applications*, Energy S.p.A., PC019 Rev.001, March 2024, PDF p. 9 (rack table)
and printed p. 23 (module sheet):
[PC019 Rev.001](https://www.energysynt.com/file/2024/03/EN_Storage-Systems-for-C&I-applications_PC019-Rev.001-light.pdf)

| Field | Value | Label |
|---|---|---|
| Voltage window | 754–936 V (26 modules × 29–36 V) | READ |
| Rated voltage | 832 V | READ |
| Nominal energy | 123 kWh | READ |
| Usable energy | 111 kWh | READ |
| DoD | 90 % (8–98 % SOC) | READ |
| Rated / max current | 74 A / 148 A (0.5C) | READ |
| Continuous power | 74 A × 832 V = 61.6 kW | DERIVED |
| Efficiency | 95 % (rack), 96 % (module); round-trip or not is not stated | READ |

Open: availability in Indonesia not confirmed; no vendor-printed continuous kW.

Rejected (window outside 750–950 V): Boostess 261 kWh (728–936 V), NBCELL 5U HV (702–936 V),
E-Able GLR-314 15S (672–864 V), Pylontech PowerCube HV (690–828 V), BYD Battery-Box HVL/HVS/HVM
(≤ 460 V). Huawei LUNA2000-200KWH has a built-in DC/DC (about 40–1050 V), so the series rule
does not apply; not checked further.

### 1.3 24-hour load profile (Indonesia): PARTIAL

No open source prints an hourly table. Shape anchors (DOIs VERIFIED):

- Kang et al., "Community microgrid planning in Lombok Island: an Indonesian case study",
  *Front. Energy Res.* 11 (2023), doi:10.3389/fenrg.2023.1209875. Measured 5-min data (Fig. 3,
  2020). Text: node 3 peak ≈ 430 kW at 18:00, valley ≈ 180 kW; node 2 ≈ 200–550 kW, valley near
  noon. Valley/peak DERIVED 0.42 and 0.36. The curve exists only as a figure.
- Syafii et al., "Economic Feasibility Study on PV/Wind Hybrid Microgrids for Indonesia Remote
  Island Application", *TEM Journal* 10(4) (2021) 2001–2006, doi:10.18421/TEM104-66. Sec. 2.1,
  Table 1: average 16.73 kW, peak 50.36 kW, load factor 0.33 (appliance estimate, not measured).

Options for a real profile: ask the Lombok authors for the Fig. 3 data; digitise Fig. 3 and
label it digitised; search PLN/ESDM statistics for a *kurva beban harian* table. A curve built
from the anchors above is a construction and must be labelled so.

### 1.4 DoD and efficiency

Datasheet level only: DoD 90 % and efficiency 95–96 % (Energysynt, §1.2); converters 98 %
(AC 3025) and 99.5 % (DC 1030), both maxima. No standard-body reference retrieved.

## 2. PSIM layer 2 (Doc 13)

Repo fact: base catalogue TRUMPF AC 3025 has `overload_ratio` 1.25 (manual A67-0141-00.BKen-001-12,
2025-02-24, p. 17 and §7.7 pp. 98–99, READ); `current_limit_a`, `output_filter`, `tau_in_s` are
null. The manual publishes no filter values and no switching frequency (whole text searched).

### 2.1 Filter and inner loops

| Source | Use | Label |
|---|---|---|
| Liserre, Blaabjerg, Hansen, IEEE TIA 41(5) 1281–1291, 2005, doi:10.1109/TIA.2005.853373 | LCL design procedure in p.u. (Z_b = V_LL²/S_n) | VERIFIED, text not read |
| Reznik et al., IEEE TIA 50(2) 1225–1232, 2014, doi:10.1109/TIA.2013.2274612 | worked LCL design | VERIFIED, text not read |
| Pogaku, Prodanovic, Green, IEEE TPEL 22(2) 613–625, 2007, doi:10.1109/TPEL.2006.890003 | droop inverter parameter table (LC + coupling L, PI gains) | VERIFIED, table not read (closed access) |
| He, Desai, Huang, Dörfler, IEEE TPEL 40 3980–4007, 2025, doi:10.1109/TPEL.2024.3500885 | open p.u. values: Lf 0.012, Rf 0.025, Cf 0.044 p.u.; fsw 32 kHz, control 8 kHz (1 kVA lab unit) | VERIFIED; READ in arXiv 2404.13376 Table III(b) |
| Rocabert et al., IEEE TPEL 27(11) 4734–4749, 2012, doi:10.1109/TPEL.2012.2199334 | general citation for cascaded loops and droop | VERIFIED |
| Holmes et al., IEEE TPEL 24(11) 2417–2426, 2009 (1.5-sample delay model) | delay model | UNVERIFIED DOI |

Both LCL papers are for grid-following converters; a grid-forming unit controls the capacitor
voltage. Scaling: convert L, C, R to p.u. on the source base and apply to S_n, V_LL of the case;
recompute PI gains from bandwidth targets, do not copy them.

### 2.2 Current limit

- TRUMPF AC 3025 (READ, manual pp. 17–18): overload 125 % 10 min, 150 % 1 min; excess current
  300 % (0.5 s island operation); voltage regulation limited to 125 A absolute for 0.5 s
  (33 A nominal per module at 440 V); Icw 125 A / 500 ms. Limiter type: NOT FOUND.
- Baeckeland et al., IEEE TPEL 39(11) 14493–14517, 2024, doi:10.1109/TPEL.2024.3430316: review
  of GFM current limiting (VERIFIED, not read).
- He et al. 2025: I_lim = 1.1 p.u. in their simulation (READ).
- Paquette & Divan, IEEE TIA 51(2) 1630–1638, 2015, doi:10.1109/TIA.2014.2345877: virtual
  impedance limiting (VERIFIED, not read).

### 2.3 PSIM features (PSIM User's Guide 9.0 R3, May 2010, READ)

- No electrical constant-power load element; §4.8.1 shows a build-it example with a controlled
  current source. Check the 9.1.4.400 element list.
- Command line `PsimCmd -i … -o … -v "Name=Value" -t … -s …` documented in ch. 6 (§6.6).
- Python API exists only from PSIM 2023.1 (UNVERIFIED beyond a forum title); not in 9.1.4.
- SimCoupler (§3.6) links to Simulink only.

### 2.4 Comparison methods

- Hua & Sarkar, IEEE TASSP 38(5) 814–824, 1990, doi:10.1109/29.56027 (matrix pencil, VERIFIED).
- Sarkar & Pereira, IEEE APM 37(1) 48–55, 1995, doi:10.1109/74.370583 (VERIFIED).
- Resolution floor: NOT FOUND in power-systems literature; stays the author's declared
  convention (Doc 13 WP 1.6.2). ASME V&V 20 is CFD and simulator-vs-experiment only.

### 2.5 Droop gains 1 % P-f and 10 % Q-V

Inside the TRUMPF settable range (DroopkP 0.1–4 %, DroopkQ 0.1–10 %, manual Tab. 33, as cited in
the catalogue). Grid-code range (IEEE 1547-2018): UNVERIFIED.

## 3. Cable and breaker sizing (method IEC60364_OVERLOAD_PUIL2011)

### 3.1 PUIL 2011 tables (SNI 0225:2011), entered 2026-11-19

The table file is `data/private/cable_tables.json` (git-ignored: PUIL is copyrighted; the
values stay out of this public repo). Notes on its entry: `data/private/cable_tables_NOTES.md`.

| Content | PUIL 2011 table | Printed / PDF page |
|---|---|---|
| Ampacity, PVC, 2 loaded… 3 loaded cores, methods A1, B1, C, D | A.52-4 | 296 / 340 |
| Ampacity, XLPE/EPR | A.52-5 | 297 / 341 |
| k_θ air / ground | A.52-14, A.52-15 | 306 / 350 |
| k_ρ soil, k_group | A.52-16, A.52-17 | 307 / 351 |
| k_group in ducts | A.52-19 | 309 / 353 |
| Conductor resistance r20 | Tabel 7.3-40 (cols 6 and 8, stranded) | 545 / 589 |

Entry check: two independent transcriptions, 248 cells, 1 difference (resolved from a zoomed
image). Open: two blurred cells where both transcriptions agree (A.52-5 Cu C 300 mm² = 576,
A.52-5 Al A1 16 mm² = 58); check against a clean copy of PUIL.

### 3.2 Breaker device classes

- MCB (IEC 60898-1): k2 = 1.45 (Schneider FAQ
  [FA369327](https://www.se.com/au/en/faqs/FA369327/), READ); I_n series 0.5–63 A from the
  Acti 9 catalogue 09/2013, p. 32 (distributor copy, READ).
- MCCB (IEC 60947-2): k2 = 1.30 (FA369327, IEC 60947-2 column; applied to MCCBs through the
  standard). I_n series [80, 100, 125, 160, 200, 250] A is **UNVERIFIED** (ComPacT NSX TM-D
  ladder from product pages and snippets). To confirm in the ComPacT NSX catalogue LVPED221001EN
  (se.com blocks automated download; open it in a browser).

### 3.3 Run on the guided D2 example (Real Engine, 2026-11-19)

Settings: method C, Cu, XLPE, 35 °C, one circuit, MULTICORE. All four elements SIZED:

| Element | I_B (A) | Device | Cable (mm²) | I_z (A) |
|---|---|---|---|---|
| LN1 | 27.8 | MCB 32 A | 4 | 38.4 |
| LN2 | 18.8 | MCB 20 A | 1.5 | 21.1 |
| INV1 | 98.4 | MCCB 100 A | 25 | 114.2 |
| INV2 | 65.6 | MCCB 80 A | 16 | 91.2 |

LN1 and LN2 report `LINE_R_MISMATCH`: the D2 line R (catalogue conductor) differs by more than
10 % from the PUIL r20 of the selected size. Expected, since the line data were not chosen from
the PUIL size; the user decides whether to align them.

## 4. Open gaps (summary)

1. Battery: a second fitting product and an Indonesian distributor; vendor continuous kW.
2. Load profile: a numeric 24-h table (see §1.3 options).
3. PSIM: Pogaku and Liserre tables (closed access); limiter type and value; fsw; check
   9.1.4.400 for a constant-power load; test PsimCmd.exe and its licence.
4. Breakers: MCCB I_n ladder page in LVPED221001EN.
5. PUIL: two blurred cells.
