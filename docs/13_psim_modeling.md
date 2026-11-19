# 13 — PSIM modelling basis for offline validation (M5)

> Doc 13 of the doc set (added 2026-11-01, streamlined 2026-11-19, D-121). Inputs: final seminar-proposal manuscript (`Seminar.pdf`; Tabel 3.4, subbab 3.8, 4.5.3, Tabel 4.13–4.14, Gambar C.7a–C.7b, work packages 1.6.1–1.6.6), Doc 8 §7, sources in `docs/CASE_DATA_SOURCES.md` §2 and §4. The manuscript wins on any conflict. No PSIM run has been executed yet; the user builds and runs the PSIM models. Equations are allowed (user decision 2026-11-01).

## Ringkasan

Dokumen ini menjelaskan dasar pemodelan PSIM untuk memvalidasi mesin perhitungan secara luring (M5). PSIM berperan sebagai pembanding, bukan sumber kebenaran: perbandingan antarmodel adalah validasi yang relatif lemah dan galat bersama antara mesin dan model PSIM tetap mungkin. Validasi memakai dua lapis: lapis 1 adalah model rata-rata yang strukturnya setara dengan mesin (menguji galat numerik serta asumsi A1 dan A4), lapis 2 adalah model pensakelaran rinci dengan PWM, filter LCL, kalang dalam, tunda pengukuran, dan pembatas arus (menguji asumsi inverter ideal A2). Sebelas kasus dalam empat keluarga dijalankan pada rancangan acuan dari katalog: D1, D2 apa adanya (D2-AB, tidak stabil sinyal kecil), D2-LR (D2 dengan reaktor kopling, stabil), D2S dan D2H (dibebani di atas D2-LR), serta D2-LF (panjang penyulang acuan). Kasus dinamik dijalankan pada D2-AB sebagai kasus ketidakstabilan dan pada D2-LR sebagai perbandingan numerik penuh. Setiap kasus dibangun dari RunRecord REAL yang sama dengan masukan mesin, tanpa penyetelan parameter bersama; ambang lulus dan kriteria settling dibekukan sebelum PSIM dijalankan.

---

## 1. Role of PSIM and limits of the evidence

| Item | Statement | Source |
|---|---|---|
| Role | PSIM is a comparator, not ground truth. | Manuscript 3.8, Tabel 3.4 |
| Strength | Model-to-model comparison is a relatively weak form of validation; PSIM is a reference simulator, not field measurement. | Manuscript 3.8 [49] |
| Residual limitation | A common-mode error shared by the engine and the matched PSIM model (same simplifying assumptions) cannot be detected and is reported even when results agree. | Manuscript 3.8 [69]; Doc 8 §7 |
| Position in the V&V hierarchy | Level 3 (layer 1) and level 4 (layer 2) after level 1 (analytical oracle and hand calculation) and level 2 (literature cases). | Manuscript Tabel 3.4 |
| Outside the app | M5 runs as an offline script; no PSIM interface exists in the app (Won't). | Manuscript 4.1.2 |
| Tool and machine | PSIM Professional 9.1.4.400, Acer Nitro 16 (Ryzen 5 7535HS, 16 GB), Windows 11. | Manuscript Tabel 3.5 |

## 2. The two layers

| | Layer 1 — matched average model | Layer 2 — detailed switching model |
|---|---|---|
| Purpose | Isolate numerical error and the network assumptions A1 (quasi-static network) and A4 (frequency-independent X). | Isolate the effect of the ideal-inverter assumption A2 and of the measurement chain. |
| Inverter | Ideal three-phase controlled voltage source per inverter, driven by the same droop law and first-order power filters as the engine (Eq. 13.1–13.3). No PWM, no inner loop, no limiter, no virtual impedance (§4). | Two-level three-phase VSI with PWM, LCL output filter, cascaded voltage and current PI control in dq, the same outer droop loop (Eq. 13.1–13.3), sampling/measurement delay, current limiter. Ideal DC source (A2 kept on the DC side). |
| Lines and reactors | Series R and L per phase, $L = X/\omega^*$; no shunt. | Same as layer 1. |
| Loads | Constant PQ (controlled current source or a native constant-power element, declared). | Same as layer 1. |
| Structural differences that remain | Line-inductor dynamics (engine: algebraic network, A1); reactance follows actual frequency because L is fixed (engine: X fixed, A4). | All of layer 1, plus LCL, PWM, inner loops, delays and limiter (engine: ideal source, A2). |
| Tolerance | Model-difference budget (manuscript Tabel 4.14, layer-1 column), §6. | Three times layer 1 (convention). |
| Parameter tuning | None: shared parameters are the sheet values. | None for shared parameters; layer-2-only parameters are declared and frozen before the run (§7). |

**Outer droop loop, identical in both layers** (manuscript Eq. 2.1, 2.7, 4.5), for inverter $i$:

$$\tau_{P,i}\,\dot P_{f,i} = P_i^{meas} - P_{f,i}, \qquad \tau_{Q,i}\,\dot Q_{f,i} = Q_i^{meas} - Q_{f,i} \tag{13.1}$$

$$\omega_i = \omega_i^* - m_{p,i}\,(P_{f,i} - P_i^*), \qquad V_i = V_i^* - n_{q,i}\,(Q_{f,i} - Q_i^*) \tag{13.2}$$

$$\dot\theta_i = \omega_i, \qquad v_{a,i} = \sqrt2\,V_i\sin\theta_i,\; v_{b,i} = \sqrt2\,V_i\sin(\theta_i - \tfrac{2\pi}{3}),\; v_{c,i} = \sqrt2\,V_i\sin(\theta_i + \tfrac{2\pi}{3}) \tag{13.3}$$

with $P^{meas}$, $Q^{meas}$ the three-phase totals at the inverter terminal (W, VAR; positive from inverter to network), $V$ the phase RMS voltage (V), $m_p$ in rad/(s·W) and $n_q$ in V/VAR referred to three-phase totals, as in the engine. Measurement in PSIM:

$$P = v_a i_a + v_b i_b + v_c i_c, \qquad Q = \frac{(v_b - v_c)\,i_a + (v_c - v_a)\,i_b + (v_a - v_b)\,i_c}{\sqrt3} \tag{13.4}$$

Three-phase totals avoid the per-phase conversion ($m_p^{phase} = 3\,m_p$); if a per-phase power block is used, the conversion is applied in the input sheet, never by hand.

## 3. Parameter map, engine ↔ PSIM

| Engine / contract quantity (unit) | PSIM element and value | Note |
|---|---|---|
| Nominal line voltage $V_{LL}$ (kV) | $V^* = V_{LL}/\sqrt3$ phase RMS (V) in the droop block | 440 V LL → 254.03 V phase (manuscript Tabel 4.7). |
| Nominal frequency $f^*$ (Hz) | $\omega^* = 2\pi f^*$ | 50 Hz. |
| $k_{P,i}$ (Hz/kW), $k_{Q,i}$ (kV LL/kvar) | $m_p = 2\pi\cdot10^{-3}\,k_P$ rad/(s·W), $n_q = k_Q/\sqrt3$ V(phase)/VAR | Doc 9 D-54 K74. D1: $m_p$ 5.000×10⁻⁵, $n_q$ 5.000×10⁻⁴. D2 INV1: 4.18879×10⁻⁵, 3.38712×10⁻⁴. D2 INV2: 6.28319×10⁻⁵, 5.08068×10⁻⁴. Entering $k_Q$ unconverted makes the voltage droop √3 too large. |
| $\tau_{P,i}$, $\tau_{Q,i}$ (s) | Two separate first-order low-pass filters | Not a PLL, not second order. |
| $P_i^*$, $Q_i^*$ | Droop block inputs | 0 in all cases except reference steps. |
| Cable line $r$, $x$ (Ω/km), length (km) | $R = r\,\ell$, $L = x\,\ell/\omega^*$ per phase | |
| Reactor line (`kind` REACTOR): L (mH), R (mΩ) per phase | Series R and L per phase, the datasheet values directly | ADR-017. BLOCK LR3 40-4/100: 0.30 mH, 1.43 mΩ; /70: 0.42 mH, 5.39 mΩ. |
| Load $P_k$, $Q_k$ (kW, kvar, three-phase) | Constant-PQ element or controlled current source | Declared in metadata `load_model`. |
| Rating $S_{r,i}$ (kVA) | Informative in layer 1 (no limiter); limiter base in layer 2 | Layer 1 must not saturate; check before running. |
| $\tau_{in}$ (s), optional M4a input | Derived from layer-2 inner-loop gains (§7) | Feeds indicator $r_{in}$ (manuscript 4.2.7). |
| Initial state | Equilibrium from the engine M1 (angles, $P_f$, $Q_f$, f, bus voltages, line currents) | Verified flat before the disturbance. |

**Engine outputs available for comparison** (M4b, engine 0.5.0, Doc 3 §6.9, D-121): system frequency, frequency per inverter, bus voltage (LL RMS) and angle per bus, P and Q per inverter, phase RMS current per line, max RoCoF and the transient class. Angles are referred to the first bus (B1, or INV1T on the reactor designs), as in M1; PSIM angles are referred to the same bus before comparing. M1 gives the same quantities at the operating point plus losses and loading.

## 4. Reference designs

Built from base-catalogue products (user decision 2026-11-19, Doc 9 D-116; Doc 14 D19). Rules:

- **Inverters**: TRUMPF TruConvert AC 3025 ×2 (50 kVA) for D1 and D2 INV2, ×3 (75 kVA) for D2 INV1; ratings and droop ranges from the base-catalogue entries (DERIVED from the operator's manual).
- **Droop**: one share of each unit's rating, so the sharing follows the ratings (Doc 12 Eq. 12.10–12.13): P–f 1 % and Q–V 10 % (catalogue maximum); $k_P = D_P f_n / (100\,S_r)$ Hz/kW, $k_Q = D_Q V_n / (100\,S_r)$ kV/kvar (TRUMPF manual pp. 107–108, $P_N = Q_N = S_r$). D1: 0.80 % and 9.84 %.
- **Loads**: D1 20 kW + 8 kvar; the D2 family at 21.74 % P and 8.70 % Q of 125 kVA.
- **Lines**: First Cable N2XY 0.6/1 kV 4 × 16 mm² (R 1.466 Ω/km at 90 °C, X 0.0748 Ω/km, 108 A in air at 30 °C), the smallest catalogue cable covering the largest unit's rated current (98.4 A). R/X ≈ 19.6.
- **Reactors** (D-119, ADR-017): one BLOCK LR3 40-4 line reactor per inverter, the parts the reactor sizing advice RS picks on D2.
- **Inverter model**: the TRUMPF manual names an integrated virtual impedance without a value; the engine and both PSIM layers model the inverter without it. The real unit adds damping of unknown size, so the as-built result is conservative for this product (thesis limitation).

| Design (file) | Topology | Lines and reactors | Load at B2 | Purpose |
|---|---|---|---|---|
| D1 (`d1`) | INV1@B1 — B2; INV1 50 kVA, $k_P$ 0.007958 Hz/kW, $k_Q$ 0.000866 kV/kvar | N2XY 4×16, 30.47 m | 20 kW, 8 kvar | Baseline, single inverter |
| D2-AB (`d2`) | INV1@B1 — B2 — INV2@B3; INV1 75 kVA ($k_P$ 0.006667, $k_Q$ 0.000587), INV2 50 kVA ($k_P$ 0.01, $k_Q$ 0.00088) | B1–B2 30.47 m, B2–B3 35.07 m (keep the line \|Z\| of the earlier designs) | 27.17 kW, 10.87 kvar (23.4 % of 125 kVA) | As built: sharing in proportion to rating; the instability case |
| D2-LR (`d2-lr`) | D2 with a terminal bus per inverter: INV1@INV1T — LR1 — B1, INV2@INV2T — LR2 — B3 | as D2, plus LR1 LR3 40-4/100 (0.30 mH, 1.43 mΩ, 100 A), LR2 LR3 40-4/70 (0.42 mH, 5.39 mΩ, 70 A) | as D2 | Stable counterpart; full numeric dynamic cases |
| D2S (`d2s`) | as D2-LR | as D2-LR | 65.22 kW, 26.09 kvar (2.4 ×) | Stressed |
| D2H (`d2h`) | as D2-LR | as D2-LR | 108.7 kW, 43.48 kvar (4.0 ×) | Near the limit |
| D2-LF (`d2-lf`) | as D2-AB on benchmark feeder lengths | B1–B2 175 m, B2–B3 140 m (CIGRE LV benchmark residential feeder; D-120) | as D2 | Realistic lengths without reactors |

All designs: 440 V LL, 50 Hz, $\tau_P = \tau_Q = 0.05$ s, $P^* = Q^* = 0$. The example Projects in `frontend/public/examples/` hold these values with each catalogue reference. The guided examples D2 and D2-LR carry the §5 disturbances as Transient presets and the §6 settling bands.

**Real Engine results (2026-11-19).**

| Design | M1 f (Hz) | Lowest bus (p.u.) | M4a | ζ_min (mode) |
|---|---|---|---|---|
| D1 | — | — | STABLE | — |
| D2-AB | 49.89088 | 0.9878 | UNSTABLE | −0.336 (+25.3 ± j71.0 s⁻¹, 11.3 Hz) |
| D2-LR | 49.89085 | 0.9842 (B2) | STABLE | 0.218 (6.15 Hz) |
| D2S | 49.73629 | 0.9609 | STABLE | 0.223 |
| D2H | 49.55684 | 0.9321 | STABLE | 0.229 |
| D2-LF | 49.88899 | 0.9729 | UNSTABLE | −0.044 (3.76 Hz) |

D2-AB is unstable because the short, strongly resistive cables couple the two inverters too tightly (participation mainly δ of INV2 and the P filters; every catalogue cable is unstable at the D2 lengths; N2XY 4×16 becomes stable only between 152 m and 305 m per line, D-118). **User decision 2026-11-19: keep the cable and validate the instability.** D2-LF shows that benchmark lengths alone do not stabilise D2 (every split of the 315 m feeder tried: ζ_min −0.044 to −0.010). Under the guided-example limits (0.95–1.05 p.u., 49.75–50.25 Hz) D2S and D2H are INFEASIBLE on frequency, so SS-03 and SS-04 are numeric comparisons only.

**Hand case R-1 (one reactor line, D2-LR, M1).** LR1 carries $P = 16.3723$ kW, $Q = 6.47077$ kvar from INV1T at 0.436204 kV. $I = S/(\sqrt3\,V) = 17.6046/(\sqrt3 \cdot 0.436204) = 23.301$ A (engine 23.3011 A). $X = 2\pi \cdot 50 \cdot 0.30\times10^{-3} = 0.0942478$ Ω. Losses $3I^2R = 3 \cdot 23.301^2 \cdot 0.00143 = 2.329$ W (engine 2.3292 W); reactive absorption $3I^2X = 153.5$ var (engine 0.15351 kvar). Voltage INV1T → B1: 0.436204 → 0.434766 kV (0.33 %).

## 5. The eleven cases

| Case | Family | Designs | Disturbance (at $t = 1$ s unless steady) | Run end | Compared quantities | Metric |
|---|---|---|---|---|---|---|
| SS-01 | Steady | D1 | — | 5 s | V, f, P, Q, S, I, losses | Eq. 13.5 |
| SS-02 | Steady, P sharing | D2-AB, D2-LR, D2-LF | — | 5 s | as SS-01, plus P sharing; on D2-LR also the two reactor lines | Eq. 13.5 |
| SS-03 | Steady, stressed | D2S | — | 5 s | as SS-01 | Eq. 13.5 |
| SS-04 | Steady, near limit | D2H | — | 5 s | as SS-01 | Eq. 13.5 |
| SM-01 | Small signal | D2-AB, D2-LR | Load step +3 % at B2 (+0.815 kW, +0.326 kvar) | 3 s | Dominant mode | Matrix pencil: decay or growth rate, damped frequency |
| SM-02 | Small signal | D2-AB, D2-LR | $P^*$ step on INV1, +2.14 % of rating (+1.607 kW) | 3 s | as SM-01 | as SM-01 |
| DR-01 | Dynamic response | D2-AB, D2-LR | Load step +10 % (+2.717 kW, +1.087 kvar) | 4 s | f(t) system and per inverter, V(t), P(t), Q(t), I(t) | Eq. 13.6; settling, overshoot, RoCoF (descriptive) |
| DR-02 | Dynamic response | D2-AB, D2-LR | $P^*$ step on INV1, +2.86 % of rating (+2.143 kW) | 4 s | as DR-01 | as DR-01 |
| TS-01 | Transient | D2-AB, D2-LR | Load +300 % (+81.51 kW, +32.61 kvar) | 5 s | Envelope, recovery, final state | Categorical (class must match) |
| TS-02 | Transient | D2-AB, D2-LR | INV2 trip (breaker opens, permanent; line stays connected) | 5 s | as TS-01 | Categorical |
| TS-03 | Transient | D2-AB, D2-LR | Large $P^*$ step on INV1, +21.43 % of rating (+16.071 kW) | 5 s | as TS-01 | Categorical |

Load steps are a % of the D2 load and $P^*$ steps a % of the INV1 rating (D-116); D2-LR has the same load and ratings, so the step values are the same. The 3 % small-signal step is chosen because at 1 % the voltage deviation falls below the resolution floor (manuscript 4.5.3).

**Engine transient classes with the §6 settling bands (Real Engine 0.5.0, 2026-11-19).**

| Design | SM-01 | SM-02 | DR-01 | DR-02 | TS-01 | TS-02 | TS-03 |
|---|---|---|---|---|---|---|---|
| D2-AB | UNSTABLE | UNSTABLE | UNSTABLE | UNSTABLE | UNSTABLE | RECOVERED_STABLE | UNSTABLE |
| D2-LR | RECOVERED_STABLE | RECOVERED_STABLE | RECOVERED_STABLE | RECOVERED_STABLE | CRITERIA_VIOLATED | RECOVERED_STABLE | RECOVERED_STABLE |

On D2-AB the TS-02 trip leaves INV1 alone, which has no inverter-to-inverter mode, so it recovers. On D2-LR the +300 % load step settles, but the frequency falls below the study limit of the guided example (49.75 Hz; the step brings the load to the D2H level, 49.557 Hz in M1), so the class is CRITERIA_VIOLATED. The design limits come from the Project (Doc 3 §3.7), the bands only decide whether the response settled.

**D2-AB rules (instability case, D-118).** SM-01 and SM-02 compare the *unstable* dominant mode: growth rate σ (> 0) and damped frequency, fitted by matrix pencil on the window from the disturbance until the first saturation, network loss or 10 % deviation, against the M4a eigenvalue and the engine's M4b ring-up. Since engine 0.5.0 (D-121) M4b integrates past the disturbance and reports the growing oscillation until the network solution is lost (SM-01: at 1.5975 s); before that fix it stopped at the disturbance instant. The decay-rate tolerance of §6 applies to σ. DR and TS on D2-AB are categorical: the class must match; NRMSE and settling are reported only for a case that settles in both tools. If PSIM settles where the engine diverges, that is a finding about assumption A1 (quasi-static network), recorded under §9, not a tolerance miss.

**D2-LR rules (D-119).** Full numeric comparisons per §6: SM against the M4a mode (ζ_min 0.218, 6.15 Hz) and the M4b ring-down, DR with NRMSE and settling, TS categorical.

**Output alignment.** The engine output step is $\tau/20$ = 2.5 ms; the disturbance instant appears twice (before and after the step), and the after-step row is used. PSIM runs at its own time step (§10) and is exported at 0.5 ms or finer, then linearly interpolated onto the engine time grid; series are aligned at the disturbance instant (Eq. 13.6).

## 6. Comparison rules, tolerance policy v1 and settling convention

Steady quantities, with $a$ the engine value, $p$ the PSIM value and $p_{floor}$ the resolution floor (manuscript Eq. 4.24):

$$e_{abs} = |a - p|, \qquad e_{rel} = \frac{|a - p|}{|p|}\ \ (|p| > p_{floor}), \qquad \text{pass} \iff |a - p| \le \epsilon_{abs} + \epsilon_{rel}\,|p| \tag{13.5}$$

Angle errors are reported as absolute only, referred to the first bus (§3). Time series (manuscript Eq. 4.25):

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

Layer-1 steady thresholds are at least five times the expected model difference: the frequency-dependent line reactance, recomputed on the catalogue designs by re-solving M1 with $x$ scaled by $f/f^*$, gives at most $3.5\times10^{-6}$ relative in voltage, $2.5\times10^{-5}$ in Q, $7\times10^{-6}$ in losses and $5\times10^{-8}$ Hz on the cable designs, and $1.8\times10^{-4}$, $9.1\times10^{-4}$, $3.6\times10^{-4}$ and $3\times10^{-6}$ Hz on the reactor designs (all worst on D2H), a margin of at least eleven; plus the PSIM resolution floor. Dynamic and modal thresholds are the author's engineering conventions, not literature values.

**Settling convention (user decision 2026-11-19, D-121).** Settling is judged by the engine (Doc 3 §6.9) and the same rule is applied to the PSIM series: frequency band ±0.05 Hz and voltage band ±0.0088 kV LL (0.02 p.u. of 0.44 kV) around the final value, held over a final window of 0.5 s. This is a declared "2 % style" convention of the author: no standard value for inverter-based islanded microgrids was found (ISO 8528-5 performance classes are for generating sets and paywalled; CASE_DATA_SOURCES §2.4). The bands are frozen with the policy.

**Freeze.** Thresholds and the settling convention change only through a new policy version, never after results are seen. Work package 1.6.2 confirms them against Tabel 4.14 and locks them with a hash.

## 7. Layer-2 parameters (cited design procedure, frozen before running)

| Element | Rule |
|---|---|
| Control structure | Cascaded voltage and current PI loops in the dq frame with the droop loop of Eq. 13.1–13.3 outside, following the inverter model of Pogaku et al. [26] (already cited in the manuscript). |
| LCL filter, PI gains, switching frequency, sampling delay | From a cited design procedure or a published parameter table, scaled to the design rating: convert L, C, R to p.u. on the source base and apply to $S_n$, $V_{LL}$ of the case; recompute PI gains from bandwidth targets, do not copy them. Source, page and table recorded in the input sheet for every value. Status of the sources: CASE_DATA_SOURCES §2.1 (open p.u. LCL values READ from He et al. 2025; Pogaku 2007 table closed access, to be read through university IEEE Xplore access). **[VERIFY: copy values from the source PDF; never from memory.]** |
| Current limiter | Active (decided Q39). Limit value and type (reference saturation) declared in the sheet; every case records whether the limiter engaged. TRUMPF limits READ (CASE_DATA_SOURCES §2.2); limiter type not published. |
| DC side | Ideal DC voltage source (A2 kept on the DC side). |
| $\tau_{in}$ for indicator $r_{in}$ | $\tau_{in} \approx 1/(2\pi f_{bw,v})$, with $f_{bw,v}$ the closed voltage-loop bandwidth of the chosen gains; recorded in the sheet and passed as the optional M4a input. |
| Freeze | All layer-2-only values are written into the input sheet and hashed with the tolerance policy before the first layer-2 run. |

## 8. Procedure (manuscript Gambar C.7a–C.7b)

1. Choose the reference designs (§4).
2. Fix the test families per module (§5).
3. Freeze the tolerance policy and the settling convention (§6).
4. Build each case in the app and export a RunRecord with engine kind REAL (FAKE records are refused).
5. Run the engine and the PSIM model from the same input: the input sheet is generated from the RunRecord snapshot, never hand-copied.
6. Extract the comparable PSIM quantities and resample them onto the engine grid (§5).
7. Compare under the frozen policy.
8. Attribute each error to a cause recorded before testing (§9). If a cause needs correction, fix it and re-run the affected cases; report improvement as $\rho_{k,c} = e'_{k,c}/e_{k,c}$ (manuscript Eq. 4.26).
9. Record results with RunRecord hash and engine version. If the engine version changes, return to step 4.

Deliverables per work package: 1.6.1 designs and case list; 1.6.2 frozen policy (hash-locked); 1.6.3 input sheets and the two PSIM models; 1.6.4 steady validation of M1/M2; 1.6.5 dynamic validation of M4; 1.6.6 offline validation report without an aggregate score.

## 9. Error attribution

Causes recorded before testing (manuscript 3.8): (1) reactance not updated with frequency (A4); (2) line-inductor dynamics (A1); (3) measurement chain; (4) ideal-inverter assumption (A2), including the current limiter in layer 2; (5) engine defect; (6) PSIM set-up error, including a declared numerical aid (§10). Errors not attributable to one of these are reported as anomalies; "model-fidelity difference" is never assigned automatically. Common-mode error (§1) remains a stated limitation.

## 10. Build and execution notes (to be checked inside PSIM)

| Topic | Note |
|---|---|
| Execution | Manual through the PSIM GUI, CSV export plus a metadata sidecar per run. `PsimCmd` is documented in the PSIM 9.0 guide (§6.6); move to scripted runs only once it is confirmed in the installed 9.1.4.400 licence. |
| Time step | Layer 1: $10^{-5}$ s or smaller. Layer 2: a stated fraction of the switching period, recorded in metadata. |
| Constant-PQ load | PSIM 9.0 has no constant-power load element (build it from a controlled current source, guide §4.8.1); check 9.1.4.400. A controlled current source into an inductive node may need numerical aids: a small shunt C at the load bus, a low-pass on the load's dq voltages, a ramped load step. |
| Numerical aids (user decision 2026-11-19, D-121) | A case stays layer 1 only if each aid's steady effect is measured below the layer-1 tolerance (§6) and declared in `unmodelled_elements`; otherwise the case is reported under layer 2. |
| Inverter trip (TS-02) | Opening a switch carrying current produces a voltage spike in an ideal simulator; use a current-zero breaker or a declared snubber. Run TS-02 last. |
| Signals exported | Commanded frequency per inverter (not a PLL), P and Q per inverter, LL RMS bus voltages and angles, line RMS currents, load power; any averaging window declared (a one-cycle mean lags fast steps by about half a cycle). |
| Never | Tune shared parameters, hand-edit a CSV, or reuse a run id for different content. |
| Order | SS-01 → SS-04, then SM, DR, TS-01, TS-03, TS-02 last. |

## 11. Open points

Numbers are kept so that references elsewhere stay valid.

| # | Item | Status |
|---|---|---|
| 1 | Layer-1 numerical aids for the constant-PQ load. | DECIDED (D-121): §10 rule |
| 2 | Layer-2 parameter values (LCL, PI gains, switching frequency). | [NEEDS SOURCE]: Pogaku 2007 table via the user's IEEE access; open p.u. values from He et al. 2025 available (§7) |
| 3 | Current-limit type in layer 2. | [NEEDS SOURCE]: TRUMPF values READ, type not published |
| 4 | Native constant-power load element in PSIM 9.1.4.400. | VERIFY in PSIM (user) |
| 5 | `PsimCmd` in the installed licence. | VERIFY in PSIM (user) |
| 6 | Resolution floor $p_{floor}$ per quantity, measured from PSIM output. | Work package 1.6.2 |
| 7 | M4b on D2-AB stopped at the disturbance instant. | DONE (D-121): engine 0.5.0 integrates per output sample; D2-AB grows until the network is lost |
| 8 | Settling criteria for the M4b classes. | DECIDED (D-121): §6 |
| 9 | Output alignment; I(t), per-inverter f and angles missing from M4b. | DONE (D-121): outputs added (§3), resampling rule (§5) |
| 10 | Angle reference bus. | DONE (D-121): the first bus, as in M1 (§3) |
| 11 | D2-LF feeder lengths. | DONE (D-120): CIGRE LV benchmark; replace with site lengths if a site is chosen |
| 12 | Supervisor approval of the reactor as a design element. | APPROVED 2026-11-19 (D-120) |

## Log

| Date | Change |
|---|---|
| 2026-11-19 | Streamlined (D-121): prototype history removed; designs D2-AB, D2-LR, D2-LF named in the case table; engine 0.5.0 M4b fix and outputs; engine class table; output alignment rule; settling convention; layer-1 aids rule; §11 (second comparator) dropped; open points 1, 7–10 closed. |
| 2026-11-19 | D2-LF on CIGRE LV benchmark lengths (D-120); coupling reactors, D2-LR, D2S and D2H re-based, hand case R-1 (D-119, ADR-017); catalogue designs, D2 instability and the decision to validate it (D-116, D-118). |
| 2026-11-01 | Created from the post-seminar design session (decisions Q22–Q25, Q38, Q39) and the manuscript. |
