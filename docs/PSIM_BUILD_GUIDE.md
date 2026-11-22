# PSIM build guide, step by step (M5)

> Companion to Doc 13 (written 2026-11-21, D-123). Doc 13 says *what* is validated and why; this guide says *how* to build and run each case in PSIM so that the PSIM model is the app's test case one to one. On any conflict Doc 13 wins, and the manuscript wins over both. Tool: PSIM Professional 9.1.4.400 (manuscript Tabel 3.5). No PSIM run has been made yet: every PSIM element name below is a function to look for in your PSIM library, marked **[check in PSIM]** where the exact element or field name was not verified in 9.1.4.

## Ringkasan

Panduan ini menjelaskan langkah membangun model PSIM untuk validasi luring M5 sehingga setiap model PSIM sama persis dengan kasus uji aplikasi. Semua nilai masuk ke PSIM lewat file parameter yang dibangkitkan dari RunRecord REAL, tidak pernah diketik tangan. Langkahnya: ambil RunRecord, bangkitkan lembar masukan dan file parameter, bangun model lapis 1 sekali, jalankan setiap kasus, ekspor sinyal dengan nama baku, lalu bandingkan dengan skrip `validation/m5` di bawah kebijakan toleransi v2 yang terkunci.

---

## 0. What one-to-one means here

| The app case has | The PSIM model must have | Where it comes from |
|---|---|---|
| The Project snapshot (buses, lines, reactors, loads, inverters) | The same buses, R and L per line, the same inverter and load ids | `params.txt` (`r_`, `l_`, `p_`, `q_`, inverter rows) |
| The M1 operating point | The run starts at that point: θ, P_f, Q_f per inverter | `params.txt` (`f0`, `theta0_`, `P0_`, `Q0_`) |
| The droop law and filters (Doc 13 Eq. 13.1–13.3) | The same law in three-phase totals, $m_p$ and $n_q$ already converted | `params.txt` (`mp_rad_s_per_w_`, `nq_v_per_var_`, `tau_p_s_`, `tau_q_s_`) |
| The M4b disturbance | The same element, size (SI units), instant and end time | `params.txt` (`t_dist`, `t_end`, `dp_`, `dq_`, `dp_star_`, `trip_`) |
| The engine's outputs | The same signals, names and units | §5 below, `validation/README.md` |
| The engine's verdicts | The same rule applied to PSIM | `python -m m5 class`, `eig`, `mode` |

Anything else in the PSIM model is a declared difference: either structural (Doc 13 §2: line inductor dynamics, X following frequency; layer 2 adds A2 elements) or a numerical aid (Doc 13 §10), written in the run's metadata.

## 1. Case matrix

Twenty-six REAL RunRecords cover every case. File names are those of step 2.

| Case | Design | Record(s) | Disturbance in PSIM | `t_end` | Comparison |
|---|---|---|---|---|---|
| SS-01 | D1 | `d1_M1` | none | 5 s | `steady` |
| SS-02 | D2-LR | `d2-lr_M1` | none | 5 s | `steady` (numeric) |
| SS-02 | D2-LF | `d2-lf_M1` | none | 5 s | `steady` (numeric; slow growth, Doc 13 §5) |
| SS-02 | D2-AB | `d2_M1` | none | 5 s | reported only: time until 10 % deviation (D-123) |
| SS-03 | D2S | `d2s_M1` | none | 5 s | `steady` |
| SS-04 | D2H | `d2h_M1` | none | 5 s | `steady` |
| SM-01, SM-02 | D2-LR | `d2-lr_SM-0x` + `d2-lr_M4a` | load step / P* step | 3 s | `mode` and `eig` (window from `t_dist`) |
| SM-01, SM-02 | D2-AB | `d2_SM-0x` + `d2_M4a` | as D2-LR | 3 s | `eig` on the growth window (D-123), `class` |
| DR-01, DR-02 | D2-LR | `d2-lr_DR-0x` | load step / P* step | 4 s | `series`, `class` |
| DR-01, DR-02 | D2-AB | `d2_DR-0x` | as D2-LR | 4 s | `class` (categorical) |
| TS-01, TS-03 | D2-LR, D2-AB | `<d>_TS-0x` | load +300 % / large P* step | 5 s | `class` (series reported) |
| TS-02 | D2-LR, D2-AB | `<d>_TS-02` | INV2 trip | 5 s | `class` (series reported); run last |
| SM-01-NLC | D2-AB, layer 2 only | `d2_SM-01` | as SM-01, $L_c$ removed | 3 s | `eig`, reported beside SM-01, no verdict |

The engine verdicts to match (Doc 13 §5 class table, re-checked 2026-11-21): D2-LR all RECOVERED_STABLE except TS-01 CRITERIA_VIOLATED; D2-AB all UNSTABLE except TS-02 RECOVERED_STABLE.

## 2. Step 1: get the REAL RunRecords

Start the app on the Real Engine (`$env:MGAPP_ENGINE = "REAL"; uv run --project backend mgapp`, header badge **Engine: REAL**). FAKE records are refused by the script.

**Either through the app** (the manuscript route, Doc 13 §8 step 4):

1. D2 and D2-LR: on the start page click **Open guided example (D2)** or **Open guided example (D2-LR, with coupling reactors)**. Run M1, then Small-signal (M4a), then each Transient (M4b) preset SM-01 … TS-03 (the settling bands are pre-filled; do not change them).
2. D1, D2S, D2H, D2-LF: **Open project file** with `frontend/public/examples/<design>.mgproj.json`; run M1 and M4a.
3. Open **Runs** and click **Export** on each run: `<record_id>.mgrun.json`. Rename to the names of §1 (`<design>_<case>.mgrun.json`) or keep a list.

**Or in one command**, through the same app API (same engine, same snapshots, same presets):

```powershell
uv run --project backend python tools/make_validation_fixtures.py --records validation/records
```

Check that every record shows `"engine_version": "0.5.0"`. If the engine version changes, all records are made again (Doc 13 §8 step 9).

## 3. Step 2: input sheet and PSIM parameter file

One folder per record:

```powershell
cd validation
../engine/.venv/Scripts/python -m m5 sheet records/d2-lr_SM-01.mgrun.json out/d2-lr_SM-01
```

Add `--layer2` for a layer-2 run; the sheet then also carries the scaled Pogaku inverter (Doc 13 §7) and **refuses** a case whose inverter-side current at the M1 point is already at the limit.

The folder gets `sheet.json` (every value with its source and the record hashes) and `params.txt`, the PSIM parameter file. Load `params.txt` with PSIM's **Parameter File** element [check in PSIM] and refer to the names below in every element. Never edit it; a changed record means a new sheet.

| Name in `params.txt` | Unit | Meaning |
|---|---|---|
| `Vll`, `fn` | V, Hz | nominal 440 V LL, 50 Hz |
| `v_star_phase_v_<inv>`, `w_star_rad_s_<inv>` | V phase RMS, rad/s | droop set points $V^*$, $\omega^*$ |
| `mp_rad_s_per_w_<inv>`, `nq_v_per_var_<inv>` | rad/(s·W), V/VAR | droop gains on three-phase totals, already converted from $k_P$, $k_Q$ (Doc 13 §3) |
| `p_star_w_<inv>`, `q_star_var_<inv>` | W, VAR | $P^*$, $Q^*$ (0) |
| `tau_p_s_<inv>`, `tau_q_s_<inv>` | s | first-order power filters (0.05 s) |
| `rated_va_<inv>` | VA | rating (layer-1 check, layer-2 limiter base) |
| `r_<line>`, `l_<line>` | Ω, H per phase | cables and reactors alike; reactors are lines LR1, LR2 |
| `p_<load>`, `q_<load>` | W, VAR | constant-PQ load, three-phase |
| `f0` | Hz | M1 system frequency |
| `P0_<inv>`, `Q0_<inv>` | W, VAR | M1 output: initial value of $P_f$, $Q_f$ |
| `theta0_<inv>` | rad | M1 angle of the inverter's bus, first bus B1 = 0 |
| `V0_<bus>`, `I0_<line>` | V LL RMS, A | M1 values, for the flat-start check |
| `t_dist`, `t_end` | s | disturbance instant, simulation end |
| `dp_<load>`, `dq_<load>` | W, VAR | load step (LOAD_STEP) |
| `dp_star_<inv>` | W | $P^*$ step (REFERENCE_STEP) |
| `trip_<inv>` | 1 | inverter outage (INVERTER_OUTAGE, permanent) |
| layer 2 only: `lf_h_`, `cf_f_`, `rf_ohm_`, `lc_h_`, `rlc_ohm_`, `kpv_`, `kiv_`, `kpc_`, `kic_`, `f_ff_`, `fs_hz_`, `td_s_`, `i_limit_a_rms_`, `tau_in_s_` | SI | Doc 13 §7 |

## 4. Step 3: build the layer-1 model (once, then per topology)

Three topologies cover all designs: D1 (INV1@B1 — LN1 — B2), D2 family without reactors (D2-AB, D2-LF: INV1@B1 — LN1 — B2 — LN2 — B3@INV2) and with reactors (D2-LR, D2S, D2H: INV1@INV1T — LR1 — B1 — LN1 — B2 — LN2 — B3 — LR2 — INV2T@INV2). Build each once with parameter names only; a new case is a new parameter file, not a new schematic.

### 4.1 Inverter (one subcircuit, reused per inverter)

Doc 13 Eq. 13.1–13.4, layer 1: an ideal three-phase voltage source behind nothing (no filter, no inner loop, no limiter, no virtual impedance).

1. **Measure** at the inverter terminal: the three line-to-neutral voltages $v_a, v_b, v_c$ and the three output currents $i_a, i_b, i_c$ (current positive from the inverter into the network).
2. **Powers**, three-phase totals (Eq. 13.4): $P = v_a i_a + v_b i_b + v_c i_c$, $Q = [(v_b - v_c) i_a + (v_c - v_a) i_b + (v_a - v_b) i_c]/\sqrt3$.
3. **Filters**: two first-order low-pass blocks $1/(\tau s + 1)$ with `tau_p_s_<inv>`, `tau_q_s_<inv>`, initial outputs `P0_<inv>`, `Q0_<inv>` [check in PSIM: transfer-function block with initial value, or an integrator loop $\dot P_f = (P - P_f)/\tau$ whose integrator takes the initial value].
4. **Droop** (Eq. 13.2): $\omega = $ `w_star_rad_s` $-$ `mp_rad_s_per_w` $\cdot (P_f - $ `p_star_w`$)$; $V = $ `v_star_phase_v` $-$ `nq_v_per_var` $\cdot (Q_f - $ `q_star_var`$)$.
5. **Angle**: integrator of $\omega$ with initial value `theta0_<inv>`, so $\theta(t) = \theta_0 + \int_0^t \omega\,dt$. Only angle differences matter, so every inverter uses the same convention.
6. **Source** (Eq. 13.3): three controlled voltage sources [check in PSIM], star-connected with the star point grounded, driven by $\sqrt2 V \sin\theta$, $\sqrt2 V \sin(\theta - 2\pi/3)$, $\sqrt2 V \sin(\theta + 2\pi/3)$.
7. **Outputs**: `f_<inv>` $= \omega/2\pi$ (the commanded frequency, not a PLL), `P_<inv>`, `Q_<inv>` = the unfiltered $P$, $Q$ of step 2 (the engine reports the network injection, not $P_f$).

Checks before the first run: $m_p$ and $n_q$ come from the file (entering $k_Q$ unconverted makes the voltage droop √3 too large); powers are three-phase totals; V is phase RMS inside the droop.

### 4.2 Lines and reactors

Per phase a series R (`r_<line>`) and L (`l_<line>`), no shunt. LR1 and LR2 are built exactly like the cables. L is fixed at its 50 Hz value, so its reactance follows the actual frequency (the declared A4 difference). Optional: set each inductor's initial current from the M1 phasors to shorten the start-up transient [check in PSIM: inductor initial-current field]; on a stable design the transient decays within about 1 s and is outside the steady window.

### 4.3 Constant-PQ load

PSIM 9.0 has no constant-power element (guide §4.8.1); check 9.1.4.400 (Doc 13 open point 4). With controlled current sources [check in PSIM], one per phase, star-connected, consistent with Eq. 13.4:

$$i_x = \frac{P_L\,v_x + Q_L\,v_{x\perp}}{v_a^2 + v_b^2 + v_c^2}, \qquad v_{a\perp} = \frac{v_b - v_c}{\sqrt3},\ v_{b\perp} = \frac{v_c - v_a}{\sqrt3},\ v_{c\perp} = \frac{v_a - v_b}{\sqrt3}$$

with $P_L = $ `p_<load>` (+ step), $Q_L = $ `q_<load>` (+ step). Then $\sum v_x i_x = P_L$ and Eq. 13.4 gives $Q_L$ exactly, at any frequency, with no averaging. A node with only inductors and current sources may need a numerical aid (Doc 13 §10: a small shunt C at the load bus, a low-pass on the load's voltages, a ramped step). Each aid is declared in the metadata, and the case stays layer 1 only if the aid's steady effect, measured, is below the layer-1 tolerance (D-121).

### 4.4 Disturbances (as the engine applies them, `mgengine.m4b._disturbed`)

| Kind | In PSIM | Engine detail to copy |
|---|---|---|
| LOAD_STEP | $P_L = $ `p_L1` $+$ `dp_L1`$\cdot u(t - $`t_dist`$)$, same for Q with `dq_L1` | ideal step, permanent; a ramp is a declared aid |
| REFERENCE_STEP P* | `p_star_w_INV1` $+$ `dp_star_INV1`$\cdot u(t - $`t_dist`$)$ into the droop | ideal step on $P^*$ only, permanent |
| INVERTER_OUTAGE | a switch between INV2's source and its terminal bus opens at `t_dist` (B3 on D2-AB, INV2T on D2-LR); the line or reactor stays connected | the inverter is removed; its bus stays as a node with zero injection; permanent. Opening a current-carrying switch in an ideal simulator spikes: use a current-zero (thyristor-type) breaker or a declared snubber; run TS-02 last |

### 4.5 Signals to export (exact names, SI units)

| Column | Definition in PSIM |
|---|---|
| `Time` | simulation time |
| `f_sys` | mean of `f_<inv>` over the inverters in service; after the TS-02 trip, `f_INV1` alone. One formula for all cases: $(f_1 + (1 - u_{trip}) f_2)/(2 - u_{trip})$ with $u_{trip}$ the trip step (0 when there is no trip) |
| `f_<inv>` | §4.1 step 7 |
| `P_<inv>`, `Q_<inv>` | §4.1 step 7, W and VAR |
| `V_<bus>` | line-to-line RMS: $\sqrt{v_a^2 + v_b^2 + v_c^2}$ of the bus's phase voltages (exact for a balanced set, no averaging window, so no half-cycle lag) |
| `A_<bus>` | angle of the bus voltage in degrees, minus that of B1, wrapped to ±180°: $\mathrm{atan2}(v_\beta, v_\alpha)$ with $v_\alpha = (2v_a - v_b - v_c)/3$, $v_\beta = (v_b - v_c)/\sqrt3$ |
| `I_<line>` | phase RMS current $\sqrt{(i_a^2 + i_b^2 + i_c^2)/3}$, every cable and reactor line |

S, loading, P sharing and losses are not exported: the script derives them from P, Q, I with the snapshot's ratings and R (policy v2). Load P and Q are not compared (they are the sheet values by construction).

### 4.6 Simulation control

Time step $10^{-5}$ s or smaller for layer 1; total time `t_end` (5 s for SS); output every 0.5 ms or finer (with a $10^{-5}$ s step, a print step of 50 steps [check in PSIM: the print-step field counts time steps]). Record the solver settings in the metadata.

## 5. Step 4: run, export, check the start

1. **Flat start (every topology, before any dynamic case).** Run the SS case of the design. On a stable design the signals settle within about 1 s; `steady` must PASS. If it fails on f or P sharing, recheck $m_p$, the filter initial values and the angle integrator before anything else.
2. **Run the case** with its own `params.txt`.
3. **Export** the §4.5 columns from SIMVIEW as a text or CSV file [check in PSIM: File → Save As in SIMVIEW]. The script accepts comma or whitespace separation, a header row with `Time`, and strictly increasing time. Never edit the file by hand.
4. **Metadata sidecar** next to the CSV (`<case>.meta.json`): `record_id`, `snapshot_hash`, `result_hash` and `engine_version` (from `sheet.json`), layer, PSIM version 9.1.4.400, time step, print step, every numerical aid under `unmodelled_elements`, the run date, and for layer 2 the `layer2_hash`. One run id per content; a rerun with any change is a new id.

## 6. Step 5: compare

From `validation/`, in PowerShell first `$PY = "../engine/.venv/Scripts/python"`, then `& $PY -m m5 …` (written `$PY -m m5 …` below):

| Case | Command | Pass rule |
|---|---|---|
| SS | `$PY -m m5 steady records/<d>_M1.mgrun.json psim.csv 1` | every row PASS (Eq. 13.5, policy v2); angles REPORTED |
| SM on D2-LR | `$PY -m m5 mode records/d2-lr_SM-0x.mgrun.json psim.csv 1` and `$PY -m m5 eig records/d2-lr_M4a.mgrun.json psim.csv 1 f_INV1 1.0 3.0` | σ, frequency and ζ within §6 against the engine ring-down and the M4a eigenvalue; both fits trusted ($R^2 \ge 0.99$, SNR ≥ 10) |
| SM on D2-AB | `$PY -m m5 eig records/d2_M4a.mgrun.json psim.csv 1 f_INV1 T_FROM T_TO` | growth window chosen on the PSIM run: from where the oscillation stands clear of the start-up transient until 10 % deviation of any V or f from its M1 value (layer 2: or the first limiter engagement); against +25.3 ± j71.0 s⁻¹, 11.3 Hz. The fit must be trusted, else widen or move the window, never the thresholds |
| DR on D2-LR | `$PY -m m5 series records/d2-lr_DR-0x.mgrun.json psim.csv 1` and `class` | NRMSE ≤ 0.05, settling time and nadir/peak within §6, class matches |
| DR, TS on D2-AB; TS on D2-LR | `$PY -m m5 class records/<d>_<case>.mgrun.json psim.csv` | `"match": true`. `RUN_ENDED_EARLY` means PSIM stopped: decide whether it blew up (record UNSTABLE with the evidence) or a set-up error (fix and rerun under a new id) |

Use layer `2` for layer-2 runs. Every output carries the policy hash; keep it with the result. A FAIL is attributed to a cause recorded before testing (Doc 13 §9), never fixed by tuning a shared parameter.

## 7. Layer 2 (after every layer-1 case passes)

Same schematic, same parameter file made with `--layer2`; replace §4.1 steps 6–7 by the Pogaku inverter (Doc 13 §7):

1. Two-level three-phase bridge from an ideal DC source, switching at `fs_hz_` (8 kHz), filter $L_f$ (`lf_h_`, `rf_ohm_`), $C_f$ (`cf_f_`), then $L_c$ (`lc_h_`, `rlc_ohm_`) inside the inverter. The engine's inverter bus (INV1T, INV2T, or B1/B3 without reactors) is after $L_c$; P and Q are measured there.
2. dq voltage loop PI (`kpv_`, `kiv_`) on the $C_f$ voltage, current loop PI (`kpc_`, `kic_`) on the $L_f$ current, feed-forward `f_ff_` of the output current, the dq frame on the droop angle $\theta$.
3. Sampling twice per carrier (asymmetric regular sampling, total delay `td_s_` = 93.75 µs). Single-update sampling makes the current loop unstable (Doc 13 §7).
4. Limiter: circular saturation of $|i_{dq}^*|$ at `i_limit_a_rms_` (1.5 p.u.) with anti-windup on the voltage-loop integrators; export a flag of its engagement. Predicted engagements are in `validation/predictions/limiter_v1.json`; an engagement where none is predicted is an anomaly.
5. Time step: a stated fraction of $1/f_s$, recorded in the metadata.
6. SM-01-NLC: the D2-AB SM-01 run with $L_c$ removed (voltage loop at the terminal), reported beside SM-01.

## 8. Pitfalls found in the 2026-11-21 audit

| Pitfall | Right way |
|---|---|
| Angles referred to INV1T on the reactor designs | B1 is the reference on every design (Doc 13 §3) |
| $k_Q$ typed as $n_q$ | use `nq_v_per_var_` from the file ($k_Q/\sqrt3$) |
| kW or kvar in PSIM | the file is in W, VAR, V, A, H, Ω, s |
| D2-AB "steady" run expected to stay at the M1 point | it cannot (growth $\approx 10^{11}$ per second); SS-02 on D2-AB is reported only, SM on D2-AB uses `eig` on the growth window (D-123) |
| System frequency taken from one inverter or a PLL | `f_sys` as in §4.5, the engine's definition |
| A one-cycle RMS meter for V or I | the instantaneous formulas of §4.5 (no lag) |
| TS-02 trip spike read as a result | current-zero breaker or declared snubber; run TS-02 last |
| An old record after an engine change | regenerate all records and sheets (§2) |

## Log

| Date | Change |
|---|---|
| 2026-11-21 | Created from the build-readiness audit (D-123). |
