# Coupling reactors, reactor sizing advice and realistic stability cases (X11)

Status: ready-for-human (WP-1 – WP-6, WP-8 and WP-7 except D2-LF built 2026-11-19, Doc 9 D-119, ADR-017; D2-LF needs the site lengths (Q7); supervisor approval asked (Q5))
Drafted: 2026-11-19 (brainstorm with the user, agent-written).

## 1. Why

The catalogue D2 (N2XY 4×16, R/X ≈ 19.6, 30 m and 35 m) is small-signal UNSTABLE under plain droop (Doc 13 §4, D-118). Real low-voltage cables are mostly resistive, so this is the realistic case, not a modelling error. Real installations get the missing inductance from a coupling reactor or the inverter's output filter. The user chose (2026-11-19):

- realistic cases only; the manuscript prototype D2 (R/X 0.5) is not reused;
- keep the as-built D2 and validate its instability;
- explore three remedies in the app and in the cases: **(1) coupling reactors**, **(4) realistic long feeders**, **(6) the finding as design guidance**;
- add **reactor sizing advice**: when a design is unstable, the app suggests the reactor needed and a catalogue part.

Out: isolation transformers (manuscript 1.5, single voltage level), virtual impedance and P–V/Q–f droop (new control equations, Doc 12 §1). They may be named in the thesis as further work only.

## 2. Exploratory result (agent, 2026-11-19, Real Engine, not a validation result)

Catalogue D2 with one series reactor per inverter, sized as a percentage of each inverter's own base impedance (Z_b = V²/S at 440 V), modelled as a 1 m line. The reactor resistance is an **assumption** (reactor X/R 30 and 10), to be replaced by datasheet values.

| Reactor (% of Z_b) | L INV1 / INV2 (mH) | M4a (X/R 30) | ζ_min | Mode (Hz) | M1 lowest bus (p.u.) |
|---|---|---|---|---|---|
| 0 (as built) | — | UNSTABLE | −0.336 | 11.30 | — |
| 0.5 % | 0.041 / 0.062 | UNSTABLE | −0.147 | 10.87 | 0.9873 |
| 1 % | 0.082 / 0.123 | UNSTABLE | −0.018 | 9.76 | 0.9868 |
| 2 % | 0.164 / 0.246 | STABLE | 0.120 | 7.83 | 0.9857 |
| 3 % | 0.246 / 0.370 | STABLE | 0.192 | 6.60 | 0.9847 |
| 4 % | 0.329 / 0.493 | STABLE | 0.240 | 5.77 | 0.9837 |
| 6 % | 0.493 / 0.739 | STABLE | 0.308 | 4.70 | 0.9816 |
| 10 % | 0.822 / 1.232 | STABLE | 0.406 | 3.54 | 0.9773 |

At reactor X/R 10 the results differ by less than 0.01 in ζ. The stability boundary lies between 1 % and 2 %; the voltage cost is small (about 0.1 p.u.-% per 1 %). The reactor rated current must cover the inverter rated current (75 kVA at 440 V: 98.4 A; 50 kVA: 65.6 A). Script: agent scratch `react.py` (not in the repo); to be reproduced as a test fixture in WP-8.

## 3. Features (app)

### F1 Line kind REACTOR
- `Line.kind`: `CABLE` (default) | `REACTOR`. Schema version bump; migration sets `CABLE` on old files.
- Engine Port unchanged: a reactor is an ordinary RL line. **Decision (recommended):** store it like any line, with `length_km` fixed at 0.001 and the per-km values derived (R·1000, X·1000). The form shows and edits L (mH) and R (mΩ) and converts; the user never sees per-km values for a reactor.
- Cable sizing (X10) skips REACTOR lines. The LINE_CURRENT constraint uses the reactor's rated current, so overload is checked as for cables.
- Diagram: inductor symbol on the branch; inspector and hover card show L, R, rated current, catalogue source. Report: line table gains a Type column.

### F2 Catalogue kind REACTOR
- Fields: `inductance_mh`, `resistance_mohm` (or losses in W at rated current, then R = P/(3·I²) marked DERIVED), `rated_current_a`, `rated_voltage_v`, `impedance_percent` (if printed), provenance and per-field sources, like the other kinds.
- Entries only from datasheets (CLAUDE.md: never invent). Base catalogue gets a small ladder covering about 65–100 A and roughly 0.1–1 mH (WP-1).

### F3 Reactor sizing advice (new advisory analysis, app-composed)
- Placement like BA and cable sizing (ADR-014, ADR-015): the app composes existing M1 and M4a runs on modified snapshots; no engine change, no new equations (Doc 12 §1). A new ADR-017 records it.
- Trigger: offered on the M4a result when the class is UNSTABLE or MARGINAL, or when `damping_pass` is false. Also reachable from Further analyses.
- Inputs: damping target ζ\* (prefilled from the M4a `damping_threshold_ratio` if one was used; otherwise the user enters it; **no built-in default**), search ceiling in % of Z_b (user field), reactor X/R used for the search (prefilled from the catalogue ladder, editable).
- Method: one reactor per inverter, the same percentage of each inverter's own base impedance (keeps the droop sharing proportional; design choice). Bisection on that percentage: each step adds the temporary terminal buses and reactor lines, runs M1 then M4a, and stops at the smallest percentage with ζ_min ≥ ζ\* and M1 FEASIBLE. Then it picks, per inverter, the catalogue reactor with L ≥ needed and rated current ≥ inverter rated current, smallest rated current first, then smallest L (built: smallest L alone put the 100 A part on INV2), and re-runs M1 and M4a with the picked parts to confirm.
- Output per inverter: needed L (mH), suggested catalogue entry, confirmed ζ_min, mode frequency, lowest bus voltage and the RunRecord ids. Outcomes: FOUND, NOT_FOUND_BELOW_CEILING (says no reactor up to the ceiling reaches ζ\*; the cause may be something else), VOLTAGE_LIMITED (stable size breaks a voltage limit), NO_CATALOGUE_PART (size found, no catalogue entry fits).
- **Apply** inserts the terminal buses and REACTOR lines into the design (explicit topology; built with a confirmation step, since the app has no undo stack). Nothing is changed without Apply.
- Advice only: it does not change any verdict, and the user re-runs M4a on the applied design.

### F4 Guidance on an unstable result (option 6)
- Fixed, qualitative text on the M4a result and in the report when the class is UNSTABLE or MARGINAL: plain droop assumes inductive coupling; short low-voltage cables are mostly resistive and can couple the inverters too tightly; usual remedies are a coupling reactor at each inverter or longer electrical distance; link to F3. **No numbers in the text** (the D2 thresholds belong to the thesis, not to every design).
- The ε_X indicator (A4) row keeps its uncalibrated caption; F4 does not add a threshold.

### F5 Long-feeder designs (option 4)
- No code. Only example files and guidance: lengths must come from the case site (the user), not from the stability thresholds.

## 4. Cases and testing

| Case | Design | Expected | Validation use |
|---|---|---|---|
| D2-AB | current catalogue D2 (as built) | UNSTABLE | mode σ and frequency; categorical DR/TS (Doc 13 §5, unchanged) |
| D2-LR | D2-AB + catalogue reactors chosen by F3 | STABLE | full numeric comparison: SM ring-down, DR, TS (the dynamic cases become numeric again) |
| D2-LF | D2 with the site's feeder lengths (user data) | depends on lengths | steady state; stability if it holds |

- D2S and D2H: re-base on D2-LR so the stressed dynamic cases are stable (user decision, see §6).
- Tests: project-file migration (`kind` default), catalogue schema for REACTOR, cable sizing skips reactors, F3 bisection unit test (monotone stub), a Fake Engine profile for the F3 e2e (find, apply, re-run), e2e for adding a reactor by hand, guided-example guard, hand case for one reactor line (impedance and voltage drop).
- PSIM: reactor is an RL branch; Doc 13 §3 gains the reactor rows, §4 and §5 the D2-LR cases.

## 5. Changes elsewhere in the project

- Doc 03 contracts: Line.kind, catalogue REACTOR, F3 parameters and payload.
- Doc 06 API: none if F3 stays app-side (as BA); otherwise a new endpoint.
- Doc 07 UI: line form, F3 panel, M4a guidance, SLD symbol.
- Doc 09 register: new D-entry; Doc 11 traceability; Doc 12 new section X11 and FR numbers; ADR-017.
- Doc 13: cases D2-LR and D2-LF, reactor rows, budget, open points.
- Doc 14: entry for the reactor element (a component the manuscript does not list): user-decided or supervisor.
- `docs/CASE_DATA_SOURCES.md`: reactor datasheet sources; site feeder lengths.
- Examples: `d2` stays as D2-AB; new `d2-lr`, `d2-lf`; guided example (D2-LR shows the F3 workflow); demo script.
- Thesis (later, user): the R/X and length findings, the reactor sweep, the PSIM comparison. The app only carries the generic guidance.

## 6. Decisions

| # | Question | Recommendation | Decided |
|---|---|---|---|
| Q1 | Reactor topology: explicit terminal bus and line, or a hidden field on the inverter | explicit | explicit (user 2026-11-19) |
| Q2 | Storage: 1 m line with derived per-km values | yes | yes, 1 m line (user 2026-11-19) |
| Q3 | Sizing rule: same % of each inverter's base impedance | yes | same % of own base (user 2026-11-19) |
| Q4 | ζ\* default | none; user enters or takes the M4a threshold | no default (user 2026-11-19) |
| Q5 | Doc 14 entry for the reactor: user-decided or ask the supervisor | ask the supervisor | ask the supervisor; KONFLIK pending, work may proceed (user 2026-11-19) |
| Q6 | D2S and D2H re-based on D2-LR | yes | yes, re-base (user 2026-11-19) |
| Q7 | D2-LF feeder lengths | from the user's site data | user supplies site lengths; D2-LF waits for them (user 2026-11-19) |
| Q8 | Does the TRUMPF manual give an output filter inductance that should count toward the reactor? | check in WP-1 | check; count a printed value as a sourced line, assume nothing otherwise (user 2026-11-19). Checked: no value printed; the unit has an unquantified virtual impedance (§6a) |

## 6a. WP-1 results (agent, 2026-11-19)

**Reactor datasheets.** Values read from the manufacturer documents; the Block table was read from the PDF text (raw extraction, the layout extraction shifts the rows by one).

| Part | L (mH) | R | Rated current | Loss | Voltage | Source |
|---|---|---|---|---|---|---|
| BLOCK LR3 40-4/70 | 0.42 | 5.39 mΩ (typ. winding resistance, printed) | 70 A | 127.9 W | 690 V AC rated (UL max 600 V); uk 4 % @ 400 V | BLOCK data sheet LR3 40-4/x, Doc-Nr 0001211845, 11.2025, sheet 2/8 |
| BLOCK LR3 40-4/80 | 0.37 | 2.90 mΩ | 80 A | 93.7 W | same | same |
| BLOCK LR3 40-4/100 | 0.30 | 1.43 mΩ | 100 A | 147.0 W | same | same; block.eu product page LR3 40-4/100 agrees (0.3 mH, 100 A, 147 W, uk 4 % @ 400 V) |
| Schneider VW3A4556 (Altivar line choke) | 0.3 | not printed; ≤ 7.6 mΩ DERIVED from 260 W / (3·107²), upper bound (loss includes core loss) | 107 A | 260 W | not read yet | se.com product page title; datasheet PDF "Schneider Electric_Altivar-312_VW3A4556.pdf" not read yet |
| Schneider VW3A4555 | 0.5 | — | 60 A | 94 W | — | distributor and se.com listings; 60 A is below INV2's 65.6 A, so it does not fit D2 |

Notes:
- BLOCK values are "typical" per the data sheet (L tolerance ±10 %, sheet 1/8). The D2 line voltage of 440 V is within the 690 V rating.
- Schneider is the only line choke family in the user's preferred brand that fits INV1; nothing in that family fits INV2 (60 A too low, next size 107 A at 0.3 mH would also fit INV2 and is the simplest single-part option, pending its datasheet).

**Check on the catalogue D2 with real parts (Real Engine, agent):**

| Parts | % of Z_b (INV1 / INV2) | M4a | ζ_min | Mode (Hz) | M1 lowest bus (p.u.) |
|---|---|---|---|---|---|
| BLOCK LR3 40-4/100 on INV1, LR3 40-4/70 on INV2 | 3.65 / 3.41 | STABLE | 0.218 | 6.15 | 0.9842 |
| Schneider VW3A4556 on INV1 (R upper bound), LR3 40-4/70 on INV2 | 3.65 / 3.41 | STABLE | 0.216 | 6.12 | 0.9839 |

So D2-LR can be built from catalogue parts today. These are exploratory runs, not validation results.

**Q8, TRUMPF output inductance (manual A67-0141-00.BKen-001-12, edition 2025-02-24, provided by the user 2026-11-19, read by full-text search):**
- No output filter inductance, coupling inductance or impedance value is printed anywhere in the manual (the only "inductivity" mentions are the DC link and cable twisting).
- The manual states that the AC-DC module has an **integrated virtual impedance** that damps dynamic processes and supports parallel connection (p. 106, system description; p. 114, "Virtual impedance"). No value, and no Modbus parameter for it, is given.
- In voltage-regulated mode the current limiter caps the current at about 125 A (p. 114).
- **Result under the Q8 decision:** nothing is counted toward the reactor (no printed value). The engine keeps modelling the unit as a droop voltage source without that virtual impedance, so for this product the as-built D2 result is **conservative**: the real unit adds damping of unknown size. This goes into Doc 13 (the PSIM inverter must also be modelled without virtual impedance, or the comparison mixes two models) and into the thesis limitations. Asking TRUMPF for the value is possible, but any answer that is not in a published document cannot enter the catalogue.

## 7. Work packages (each becomes an issue file under `issues/` when work starts)

Build status (2026-11-19): WP-1 done (BLOCK LR3 40-4/70, /80, /100; Schneider left out, R not printed); WP-2 done (ADR-017, Doc 03, 06, 07, 09 D-119, 11, 12 X11, 14 D20); WP-3 done without a schema bump (`kind` optional, hashes kept); WP-4 done; WP-5 done except the Fake profile and the e2e (the RS contract test uses a monotone stub engine); WP-6 done; WP-7 done except `d2-lf` (Q7) and the demo script (unchanged: it uses `d2`); WP-8 done (Doc 13 §3 – §6, hand case R-1); the §2 sweep is not a fixture (the RS real-engine test covers the boundary).

1. **WP-1 Data:** source 2–4 reactor datasheets (about 65–100 A, 0.1–1 mH, 400–480 V); check the TRUMPF manual for output inductance (Q8). Blocks WP-3, WP-6.
2. **WP-2 Contracts and ADR:** Doc 03, Doc 12 X11, ADR-017, Doc 14 entry, register. After the Q1–Q5 decisions.
3. **WP-3 Line kind and catalogue kind:** schema bump, migration, form, cable sizing skip, catalogue entries, tests.
4. **WP-4 Diagram and report:** inductor symbol, inspector, report Type column, Indonesian strings (kept-English list applies).
5. **WP-5 Reactor sizing advice (F3):** composition, bisection, catalogue pick, confirm runs, Apply, Fake profile, e2e.
6. **WP-6 Guidance (F4):** fixed text, report section, translations.
7. **WP-7 Cases:** `d2-lr` (needs WP-1, WP-5), `d2-lf` (needs Q7), re-base D2S and D2H, guided example, demo script.
8. **WP-8 Validation basis:** Doc 13 cases, reactor hand case, budget; reproduce §2 as a fixture.
