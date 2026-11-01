# 13 — PSIM modelling basis for offline validation (M5)

> Doc 13 of the doc set (added 2026-11-01). Inputs: final seminar-proposal manuscript (`Seminar.pdf`; Tabel 3.4, subbab 3.8, 4.5.3, Tabel 4.13–4.14, Gambar C.7a–C.7b, work packages 1.6.1–1.6.6), Doc 8 §7, and the prototype's validation package (`App.zip`: `App/docs/validation/psim_model_specification.md`, `psim_build_guide.md`, `App/backend/validation/cases/*.json`, `designs/*.json`, `policies/tolerance_policy_v1.json`). The manuscript wins on any conflict. The prototype package is prior art: its numbers are reused only where they match the manuscript, and no PSIM run has been executed yet. Equations are allowed (user decision 2026-11-01). This document answers the seminar question on how the PSIM test and validation cases are built.

## Ringkasan

Dokumen ini menjelaskan dasar pemodelan PSIM yang dipakai untuk memvalidasi mesin perhitungan secara luring (M5). PSIM berperan sebagai pembanding, bukan sumber kebenaran, karena perbandingan antarmodel merupakan bentuk validasi yang relatif lemah dan galat bersama antara mesin dan model PSIM tetap mungkin terjadi. Validasi memakai dua lapis model: lapis 1 adalah model rata-rata yang strukturnya setara dengan mesin dan menguji galat numerik serta asumsi jaringan A1 dan A4, sedangkan lapis 2 adalah model pensakelaran rinci dengan PWM, filter LCL, kalang dalam tegangan dan arus, tunda pengukuran, dan pembatas arus yang menguji pengaruh asumsi inverter ideal A2. Sebelas kasus dalam empat keluarga (tunak, sinyal kecil, respons dinamik, dan transien) dijalankan pada empat rancangan acuan D1, D2, D2S, dan D2H. Setiap kasus dibangun dari lembar masukan yang dibangkitkan dari RunRecord REAL yang sama dengan masukan mesin, tanpa penyetelan parameter bersama. Ambang lulus dibekukan sebelum PSIM dijalankan, dan setiap selisih ditelusuri ke penyebab struktural yang dicatat lebih dulu. Parameter lapis 2 diambil dari prosedur desain yang dirujuk dan dibekukan pada lembar masukan sebelum dijalankan. Eksekusi awal dilakukan manual melalui antarmuka PSIM dengan keluaran CSV.

---

## 1. Role of PSIM and limits of the evidence

| Item | Statement | Source |
|---|---|---|
| Role | PSIM is a comparator, not ground truth. | Manuscript 3.8, Tabel 3.4 |
| Strength | Model-to-model comparison is a relatively weak form of validation; PSIM is a reference simulator, not field measurement. | Manuscript 3.8 [49] |
| Residual limitation | A common-mode error shared by the engine and the matched PSIM model (same simplifying assumptions) cannot be detected and is reported even when results agree. | Manuscript 3.8 [69]; Doc 8 §7 step 8 |
| Position in the V&V hierarchy | Level 3 (layer 1) and level 4 (layer 2) after level 1 (analytical oracle and hand calculation) and level 2 (literature cases). | Manuscript Tabel 3.4 |
| Outside the app | M5 runs as an offline script; no PSIM interface exists in the app (Won't). | Manuscript 4.1.2 |
| Tool and machine | PSIM Professional 9.1.4.400, Acer Nitro 16 (Ryzen 5 7535HS, 16 GB), Windows 11. | Manuscript Tabel 3.5 |

## 2. The two layers

| | Layer 1 — matched average model | Layer 2 — detailed switching model |
|---|---|---|
| Purpose | Isolate numerical error and the network assumptions A1 (quasi-static network) and A4 (frequency-independent X). | Isolate the effect of the ideal-inverter assumption A2 and of the measurement chain. |
| Inverter | Ideal three-phase controlled voltage source per inverter, driven by the same droop law and first-order power filters as the engine (Eq. 13.1–13.3). No PWM, no inner loop, no limiter. | Two-level three-phase VSI with PWM, LCL output filter, cascaded voltage and current PI control in dq, the same outer droop loop (Eq. 13.1–13.3), sampling/measurement delay, current limiter. Ideal DC source (A2 is kept for the DC side; detailed battery is out of scope). |
| Lines | Series R and L per phase, $L = X/\omega^*$; no shunt. | Same as layer 1. |
| Loads | Constant PQ (controlled current source or a native constant-power element, declared). | Same as layer 1. |
| Structural differences from the engine that remain | Line-inductor dynamics (engine: algebraic network, A1); reactance follows actual frequency because L is fixed (engine: X fixed, A4). | All of layer 1, plus LCL, PWM, inner loops, delays and limiter (engine: ideal source, A2). |
| Tolerance | Derived from the model-difference budget (manuscript Tabel 4.14, layer-1 column). | Three times layer 1 (convention). |
| Parameter tuning | None: shared parameters are the sheet values. | None for shared parameters; layer-2-only parameters are declared and frozen before the run (§7). |

**Outer droop loop, identical in both layers** (manuscript Eq. 2.1, 2.7, 4.5), for inverter $i$:

$$\tau_{P,i}\,\dot P_{f,i} = P_i^{meas} - P_{f,i}, \qquad \tau_{Q,i}\,\dot Q_{f,i} = Q_i^{meas} - Q_{f,i} \tag{13.1}$$

$$\omega_i = \omega_i^* - m_{p,i}\,(P_{f,i} - P_i^*), \qquad V_i = V_i^* - n_{q,i}\,(Q_{f,i} - Q_i^*) \tag{13.2}$$

$$\dot\theta_i = \omega_i, \qquad v_{a,i} = \sqrt2\,V_i\sin\theta_i,\; v_{b,i} = \sqrt2\,V_i\sin(\theta_i - \tfrac{2\pi}{3}),\; v_{c,i} = \sqrt2\,V_i\sin(\theta_i + \tfrac{2\pi}{3}) \tag{13.3}$$

with $P^{meas}$, $Q^{meas}$ the three-phase totals at the inverter terminal (W, VAR; positive from inverter to network), $V$ the phase RMS voltage (V), $m_p$ in rad/(s·W) and $n_q$ in V/VAR referred to three-phase totals, as in the engine. Measurement in PSIM (prototype convention):

$$P = v_a i_a + v_b i_b + v_c i_c, \qquad Q = \frac{(v_b - v_c)\,i_a + (v_c - v_a)\,i_b + (v_a - v_b)\,i_c}{\sqrt3} \tag{13.4}$$

Using three-phase totals in PSIM avoids the per-phase conversion ($m_p^{phase} = 3\,m_p$) that literature models with per-phase power need; if a per-phase power block is used, the conversion is applied in the input sheet, never by hand.

## 3. Parameter map, engine ↔ PSIM

| Engine / contract quantity (unit) | PSIM element and value | Note |
|---|---|---|
| Nominal line voltage $V_{LL}$ (kV) | $V^* = V_{LL}/\sqrt3$ phase RMS (V) in the droop block | D-designs: 440 V LL → 254.03 V phase (manuscript Tabel 4.7). |
| Nominal frequency $f^*$ (Hz) | $\omega^* = 2\pi f^*$ | 50 Hz. |
| $m_{p,i}$, $n_{q,i}$ | Droop block constants, unchanged | Three-phase totals (§2). |
| $\tau_{P,i}$, $\tau_{Q,i}$ (s) | Two separate first-order low-pass filters | Not a PLL, not second order. |
| $P_i^*$, $Q_i^*$ | Droop block inputs | 0 in all cases except reference steps. |
| Line $r$, $x$ (Ω/km), length (km) | $R = r\,\ell$, $L = x\,\ell/\omega^*$ per phase | Prototype designs give R and X in Ω directly. |
| Load $P_k$, $Q_k$ (kW, kvar, three-phase) | Constant-PQ element or controlled current source | Declared in metadata `load_model`. |
| Rating $S_{r,i}$ (kVA) | Informative in layer 1 (no limiter); limiter base in layer 2 | Layer 1 must not saturate; check before running. |
| $\tau_{in}$ (s), optional M4a input | Derived from layer-2 inner-loop gains (§7) | Feeds indicator $r_{in}$ (manuscript 4.2.7). |
| Initial state | Equilibrium from the engine (angles, $P_f$, $Q_f$, f, bus voltages, inductor currents) | Verified flat before the disturbance. |

## 4. Reference designs

Values below are those of the prototype design files and agree with the manuscript where the manuscript gives numbers (Tabel 4.7, 4.13; $\lambda_{up} = 115/26.93$ for D2). Work package 1.6.1 confirms or replaces them; the final values are frozen in the input sheets.

| Design | Topology | Inverters | Lines (R; X in Ω) | Load at B2 | Purpose |
|---|---|---|---|---|---|
| D1 | INV1@B1 — B2 | 50 kVA; $m_p = 5\times10^{-5}$ rad/(s·W); $n_q = 5\times10^{-4}$ V/VAR | B1–B2: 0.02; 0.04 | 20 kW, 8 kvar | Baseline, single inverter |
| D2 | INV1@B1 — B2 — INV2@B3 | INV1 70 kVA, $m_p = 5\times10^{-5}$, $n_q = 5\times10^{-4}$; INV2 45 kVA, $m_p = 8\times10^{-5}$, $n_q = 7\times10^{-4}$ | B1–B2: 0.02; 0.04 (R/X 0.5). B2–B3: 0.025; 0.045 (R/X 0.556) | 25 kW, 10 kvar (26.93 kVA) | Two inverters with different droop gains |
| D2S | as D2 | as D2 | as D2 | 2.4 × D2 (60 kW, 24 kvar) | Stressed but physical |
| D2H | as D2 | as D2 | as D2 | 4.0 × D2 (100 kW, 40 kvar); ≈ 94 % of rating | Near the engineering limit |

All designs: 440 V LL, 50 Hz, $\tau_P = \tau_Q = 0.05$ s, $P^* = Q^* = 0$.

## 5. The eleven cases

| Case | Family | Design | Disturbance (at $t = 1$ s unless steady) | Run (end; output step) | Compared quantities | Metric |
|---|---|---|---|---|---|---|
| SS-01 | Steady | D1 | — | 5 s; 0.01 s | V, f, P, Q, S, I, losses | Eq. 13.5 |
| SS-02 | Steady (power sharing) | D2 | — | 5 s; 0.01 s | as SS-01, plus P sharing | Eq. 13.5 |
| SS-03 | Steady (stressed) | D2S | — | 5 s; 0.01 s | as SS-01 | Eq. 13.5 |
| SS-04 | Steady (near limit) | D2H | — | 5 s; 0.01 s | as SS-01 | Eq. 13.5 |
| SM-01 | Small signal | D2 | Load step +3 % at B2 (+750 W, +300 VAR) | 3 s; 0.002 s | Dominant mode from ring-down | Matrix pencil: damped frequency, damping |
| SM-02 | Small signal | D2 | $P^*$ step on INV1, +1.5 kW | 3 s; 0.002 s | as SM-01 | as SM-01 |
| DR-01 | Dynamic response | D2 | Load step +10 % (+2.5 kW, +1 kvar) | 4 s; 0.002 s | V(t), f(t), P(t), Q(t), I(t) | Eq. 13.6; settling, overshoot, RoCoF (descriptive) |
| DR-02 | Dynamic response | D2 | $P^*$ step on INV1, +2 kW | 4 s; 0.002 s | as DR-01 | as DR-01 |
| TS-01 | Transient | D2 | Load +300 % (+75 kW, +30 kvar) | 5 s; 0.002 s | Envelope, recovery, final state | Categorical (class must match) |
| TS-02 | Transient | D2 | INV2 trip (breaker opens, permanent; line stays connected) | 5 s; 0.002 s | as TS-01 | Categorical |
| TS-03 | Transient | D2 | Large $P^*$ step on INV1, +15 kW | 5 s; 0.002 s | as TS-01 | Categorical |

The 3 % small-signal step is chosen because at 1 % the voltage deviation falls below the resolution floor (manuscript 4.5.3).

## 6. Comparison rules and tolerance policy v1

Steady quantities, with $a$ the engine value, $p$ the PSIM value and $p_{floor}$ the resolution floor (manuscript Eq. 4.24):

$$e_{abs} = |a - p|, \qquad e_{rel} = \frac{|a - p|}{|p|}\ \ (|p| > p_{floor}), \qquad \text{pass} \iff |a - p| \le \epsilon_{abs} + \epsilon_{rel}\,|p| \tag{13.5}$$

Angle errors are reported as absolute only. Time series are aligned at the disturbance instant (manuscript Eq. 4.25):

$$\mathrm{RMSE} = \sqrt{\frac1K\sum_{k=1}^K (a_k - p_k)^2}, \qquad \mathrm{NRMSE} = \frac{\mathrm{RMSE}}{\max_k |p_k - p_{pre}|} \tag{13.6}$$

with $K$ samples and $p_{pre}$ the pre-disturbance PSIM value. Dominant modes come from the matrix-pencil method [85] and are trusted only when $R^2 \ge 0.99$ and the signal-to-noise ratio is at least 10, because $R^2 = 0.9997$ has accompanied a 28 % damping miss.

| Quantity | Metric | Layer 1 ($\epsilon_{abs}$; $\epsilon_{rel}$) | Layer 2 | Basis |
|---|---|---|---|---|
| Voltage (p.u. or V) | Steady | 0; 0.2 % | 0; 0.6 % | Model-difference budget |
| Frequency | Steady | 0.005 Hz | 0.015 Hz | Budget |
| P, S of inverters and loads | Steady | 10 W; 0.5 % | 30 W; 1.5 % | Budget |
| Q of inverters and loads | Steady | 20 VAR; 1 % | 60 VAR; 3 % | Budget |
| Line current | Steady | 0.05 A; 0.5 % | 0.15 A; 1.5 % | Budget |
| Losses | Steady | 5 W; 2 % | 15 W; 6 % | Budget |
| Inverter loading; P sharing | Steady | 0.005; 0.3 points % | 0.015; 0.9 points % | Budget |
| f, V, P, Q, I | NRMSE | 0.05 | 0.15 | Convention |
| f, V, P, Q, I | Settling time | 0.05 s; 25 % | 0.15 s; 75 % | Convention |
| Frequency; voltage | Nadir/peak | 0.01 Hz; 0.002 p.u. | 0.03 Hz; 0.006 p.u. | Convention |
| Dominant mode | Decay rate; damped frequency | 0.5 s⁻¹ and 10 %; 0.2 Hz and 3 % | 1.5 s⁻¹ and 30 %; 0.6 Hz and 9 % | Convention |
| Dominant mode | Damping ratio | 0.03 | 0.09 | Convention |
| RoCoF | Maximum | Descriptive | Descriptive | No verdict |
| Recovery; transient class | Categorical | Must match | Must match | Convention |

Layer-1 steady thresholds are at least five times the expected model difference (up to $7\times10^{-5}$ relative in voltage, $4.3\times10^{-4}$ relative in Q and $10^{-5}$ Hz in frequency on the reference designs, all from the frequency-dependent reactance) plus the PSIM measurement resolution floor. Dynamic and modal thresholds are the author's engineering conventions, not literature values. Thresholds change only through a new policy version, never after results are seen. The prototype file `tolerance_policy_v1.json` with its `.lock.json` hash is the machine-readable form; work package 1.6.2 confirms it against Tabel 4.14 and locks it.

## 7. Layer-2 parameters (decided: cited design procedure, frozen before running)

| Element | Rule |
|---|---|
| Control structure | Cascaded voltage and current PI loops in the dq frame with the droop loop of Eq. 13.1–13.3 outside, following the inverter model of Pogaku et al. [26] (already cited in the manuscript). |
| LCL filter, PI gains, switching frequency, sampling delay | Values taken from a cited design procedure or from the published parameter table of the model followed, scaled to the design rating by a stated rule. The source, page and table are recorded in the input sheet for every value. **[VERIFY: open the source PDF and copy values; do not fill from memory.]** |
| Current limiter | Active (decided Q39). Limit value and type (reference saturation) declared in the sheet; every case records whether the limiter engaged. |
| DC side | Ideal DC voltage source (A2 kept on the DC side). |
| $\tau_{in}$ for indicator $r_{in}$ | Derived from the closed voltage-loop bandwidth of the chosen gains: $\tau_{in} \approx 1/(2\pi f_{bw,v})$, with $f_{bw,v}$ read from the designed loop. Diturunkan dalam penelitian ini; recorded in the sheet and passed as the optional M4a input. |
| Freeze | All layer-2-only values are written into the input sheet and hashed with the tolerance policy before the first layer-2 run (manuscript: unmodelled elements declared by the operator, shared parameters not tuned). |

## 8. Procedure (manuscript Gambar C.7a–C.7b)

1. Choose the reference designs (§4).
2. Fix the test families per module (§5).
3. Freeze the tolerance policy (§6).
4. Build each case in the app and export a RunRecord with engine kind REAL (FAKE records are refused).
5. Run the engine and the PSIM model from the same input: the input sheet is generated from the RunRecord snapshot, never hand-copied.
6. Extract the comparable PSIM quantities.
7. Compare under the frozen policy.
8. Attribute each error to a cause recorded before testing (§9). If a cause needs correction, fix it and re-run the affected cases; report improvement as $\rho_{k,c} = e'_{k,c}/e_{k,c}$ (manuscript Eq. 4.26).
9. Record results with RunRecord hash and engine version. If the engine version changes, return to step 4.

Deliverables per work package: 1.6.1 designs and case list; 1.6.2 frozen policy (hash-locked); 1.6.3 input sheets and the two PSIM models; 1.6.4 steady validation of M1/M2 (error table, cause notes); 1.6.5 dynamic validation of M4; 1.6.6 offline validation report without an aggregate score.

## 9. Error attribution

Causes recorded before testing (manuscript 3.8): (1) reactance not updated with frequency (A4); (2) line-inductor dynamics (A1); (3) measurement chain; (4) ideal-inverter assumption (A2), including the current limiter in layer 2; (5) engine defect; (6) PSIM set-up error. Errors not attributable to one of these are reported as anomalies; the class "model-fidelity difference" is never assigned automatically. Common-mode error (§1) remains a stated limitation.

## 10. Build and execution notes (from the prototype build guide, to be checked inside PSIM)

| Topic | Note |
|---|---|
| Execution | Manual through the PSIM GUI, CSV export plus a metadata sidecar per run; compared by the Python validation package. Move to scripted runs only if a PSIM command-line or scripting interface is confirmed in the installed licence. |
| Time step | Layer 1: $10^{-5}$ s or smaller. Layer 2: small enough to resolve PWM; set as a fraction of the switching period and recorded in metadata. [ASSUMPTION: value fixed when the switching frequency is chosen.] |
| Constant-PQ load | An ideal controlled current source feeding an inductive node was numerically unstable in the prototype's surrogate emulator; it needed a 1 µF/phase shunt at the load bus and a 20 ms low-pass on the load's dq voltages. Prefer a native constant-power element if PSIM 9.1 provides one. Any aid is declared in `unmodelled_elements`. |
| Load step | An ideal step rings the load-bus capacitor; a 1 ms ramp is used and declared. |
| Inverter trip (TS-02) | Opening a switch carrying line current produces a voltage spike in an ideal simulator; use a current-zero breaker or a declared snubber. Run TS-02 last. |
| Signals exported | Commanded frequency per inverter (not a PLL), P and Q per inverter, LL RMS bus voltages, line RMS currents, load power; one-cycle trailing means for export (declared, because they lag fast steps by about half a cycle). |
| Never | Tune shared parameters, hand-edit a CSV, reuse a run id for different content, or load surrogate-emulator output as PSIM data. |
| Order | SS-01 → SS-04, then SM, DR, TS-01, TS-03, TS-02 last. |

## 11. Second comparator (optional)

Simulink stays open as a second comparator if a later feature needs validation beyond PSIM. A Simulink model built from the same assumptions shares the same common-mode error; it adds independence only for set-up errors and solver behaviour.

## 12. Open points

| # | Item | Tag |
|---|---|---|
| 1 | Do the layer-1 numerical aids for the constant-PQ load (shunt C, voltage low-pass, step ramp) change the fidelity class to layer 2? The prototype guide left this to the operator. Recommendation: keep layer 1 if their steady effect is quantified below the layer-1 tolerance and declared; otherwise report under layer 2. | DECISION NEEDED |
| 2 | Layer-2 parameter source (design procedure or published table) and scaling rule. | [NEEDS SOURCE] |
| 3 | Current-limit value and type in layer 2. | [NEEDS SOURCE] |
| 4 | Native constant-power load element in PSIM 9.1.4.400. | VERIFY in PSIM |
| 5 | PSIM command-line or scripting interface in the installed licence. | VERIFY in PSIM |
| 6 | Resolution floor $p_{floor}$ per quantity, measured from PSIM output. | Work package 1.6.2 |

## Log

| Date | Change |
|---|---|
| 2026-11-01 | Created from the post-seminar design session (decisions Q22–Q25, Q38, Q39) and the manuscript; design and case values cross-checked against the prototype validation package. |
