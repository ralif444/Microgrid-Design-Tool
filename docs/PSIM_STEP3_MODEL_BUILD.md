# PSIM step 3: building the layer-1 model, block by block

> Companion to `docs/PSIM_BUILD_GUIDE.md` §4 (written 2026-11-22). Steps 1 and 2 are done: the 26 REAL records are in `validation/records/` and the parameter files in `validation/out/layer1/<case>/params.txt` (and `layer2/`). This file tells you which PSIM blocks to place and how to wire them so that the schematic is the engine model of Doc 13 §2 (Eq. 13.1–13.4) and nothing else. Element names follow the PSIM 9 library; where the exact name, menu path or field in 9.1.4.400 was not verified it is marked **[check in PSIM]**: find the element with that function and note its real name in your build log.

## Ringkasan

Bangun tiga skematik (D1, D2 tanpa reaktor, D2 dengan reaktor) sekali saja, hanya memakai nama parameter dari `params.txt`. Setiap kasus cukup mengganti file parameter. Bagian 1–3 menyiapkan kontrol simulasi, file parameter, dan daftar blok. Bagian 4 membangun satu inverter (sensor, P dan Q, filter, droop, sudut, sumber tiga fase). Bagian 5–8 membangun saluran, beban daya konstan, pengukuran bus, dan frekuensi sistem. Bagian 9–11 merangkai topologi, menjalankan SS-01 sebagai uji pertama, lalu kasus berikutnya.

---

## 0. Rules for the whole build

1. **Never type a number that is in `params.txt`.** Every R, L, gain, set point, initial value, step size and time is a parameter name. The only literal numbers in the schematic are √2, √3, 2π, 2π/3, 0, 1 and the simulation-control settings of §1.
2. **Names end in the element id**: `_INV1`, `_INV2`, `_LN1`, `_LR1`, `_L1`, `_B2`. Build INV1 completely, then copy it and replace `_INV1` by `_INV2` in every field (PSIM's find-and-replace or by hand; check every block).
3. **Use Labels for wiring** across the sheet (Elements → Other → Label [check in PSIM]): two nodes with the same label are connected. Label names used below: power nodes `B1a B1b B1c`, control signals `P_INV1`, `Pf_INV1`, `w_INV1`, …
4. **Probe names are the CSV column names** (§9). A wrong probe name gives `NOT_EXPORTED` in the compare.
5. **SI units everywhere**: V, A, W, VAR, Ω, H, s, rad/s. The control circuit carries plain numbers, so a power of 20 000 W is the number 20000.
6. Build **layer 1 first**. Layer 2 (guide §7) replaces only the source block of §4.6 after every layer-1 case passes.

## 1. Simulation control

Simulate → Simulation Control [check in PSIM]:

| Field | Value | Why |
|---|---|---|
| Time step | `1E-5` | Doc 13 §10, layer 1: 10⁻⁵ s or smaller |
| Total time | `t_end` | from the parameter file (5 s for SS, 3/4/5 s for the M4b cases) |
| Print time | `0` | export from the start; the initial state is compared |
| Print step | `50` | one output point every 50 steps = 0.5 ms (Doc 13 §5) [check in PSIM: the field counts time steps] |
| Load flag / save flag | off | every run starts from the M1 point in the file, not from a saved state |

If the total-time field does not accept a parameter name [check in PSIM], type the case's `t_end` and write it in the run metadata.

## 2. Parameter file

1. Place Elements → Other → Parameter File [check in PSIM] anywhere on the sheet.
2. Point it to the case file, e.g. `C:\Users\Rifky Alif\Documents\Microgrid-Design-Tool\validation\out\layer1\d1_M1\params.txt`.
3. The file starts with a `//` comment line. If PSIM rejects it [check in PSIM], do not edit the file: tell me and I change the generator.
4. A case change = point this element to another `params.txt`. Nothing else in the schematic changes.

## 3. Blocks you will need

| Function | PSIM element (library path) | Used in |
|---|---|---|
| Parameter file | Other → Parameter File | §2 |
| Label (named node) | Other → Label | everywhere |
| Ground | Power → Ground | sources, sensors |
| Resistor, inductor | Power → RLC Branches → Resistor, Inductor (or the three-phase RL branch) | §5 lines |
| Controlled voltage source | Sources → Voltage → controlled source driven by a control signal [check in PSIM: "Controlled Voltage Source" / VSCC] | §4.6 |
| Controlled current source | Sources → Current → controlled source driven by a control signal [check in PSIM] | §6 load |
| Voltage sensor | Other → Sensors → Voltage Sensor (gain 1) | §4.1, §7 |
| Current sensor | Other → Sensors → Current Sensor (gain 1) | §4.1, §7 |
| Math function block (expression of inputs and parameters) | Control → Other Function Blocks → Math Function Block [check in PSIM: may be called "Math Function" or "fx"; expression syntax x1, x2, …] | §4.2–4.6, §6–8 |
| Integrator with initial value | Control → Integrator (field "Initial Output Value") | §4.3, §4.5 |
| Summer, gain | Control → Computational Blocks → Summer, Proportional (only if you prefer them over the math block) | §4.3 |
| Step source (0 → 1 at a time) | Sources → Voltage → Step (V1 = 0, V2 = 1, T_step = `t_dist`), used as a control signal | §4.4, §4.8, §6 |
| Bidirectional switch + on/off controller | Switches → Bi-directional Switch; Other → Switch Controllers → On-Off Controller | §4.8 (TS-02) |
| Voltage probe (to SIMVIEW) | Other → Probes → Voltage Probe, node-to-ground; name = CSV column | §9 |

The math function block is used for every equation so the formulas read exactly as in Doc 13. If 9.1.4 has no multi-input math block, build the same formula from summers, multipliers, dividers, square-root and sine blocks; the formula, not the block, is what must match.

## 4. One inverter (build INV1, then copy for INV2)

Layer 1: an ideal three-phase voltage source, no filter, no inner loop, no limiter, no virtual impedance (Doc 13 §2). Signals below are for INV1 at its own bus (B1 on D1, D2-AB, D2-LF; INV1T on D2-LR, D2S, D2H). Write the bus name you are on in place of `<bus>`.

### 4.1 Power stage and sensors

1. Three controlled voltage sources, one per phase, their negative ends joined into a star point, the star point to ground.
2. From each source's positive end, a current sensor in series, then a Label `<bus>a`, `<bus>b`, `<bus>c`. **Sensor arrow from the source towards the bus**: current positive from inverter into the network (Doc 13 Eq. 13.4).
3. Three voltage sensors from `<bus>a/b/c` to ground. Outputs → labels `va_INV1`, `vb_INV1`, `vc_INV1`; current-sensor outputs → `ia_INV1`, `ib_INV1`, `ic_INV1`.

### 4.2 Active and reactive power (Eq. 13.4)

Two math blocks, inputs va, vb, vc, ia, ib, ic:

```
P_INV1 = va*ia + vb*ib + vc*ic
Q_INV1 = ((vb - vc)*ia + (vc - va)*ib + (va - vb)*ic) / sqrt(3)
```

Outputs → labels `P_INV1`, `Q_INV1`. These unfiltered values are also what you export (§9): the engine reports the network injection, not the filtered value.

### 4.3 Power filters (Eq. 13.1), with the M1 initial value

Build each as an integrator loop so the initial value is set exactly:

```
dPf = (P_INV1 - Pf_INV1) / tau_p_s_INV1     (math block, inputs P_INV1, Pf_INV1)
Pf_INV1 = integral(dPf), initial output = P0_INV1
dQf = (Q_INV1 - Qf_INV1) / tau_q_s_INV1
Qf_INV1 = integral(dQf), initial output = Q0_INV1
```

A first-order transfer-function block 1/(τs+1) is equivalent only if its initial state can be set to P0, Q0 [check in PSIM]; the integrator loop avoids the question.

### 4.4 Droop (Eq. 13.2) and the P* step

```
u_dist = step 0 → 1 at t_dist                     (one step source, shared by all blocks)
Pstar_INV1 = p_star_w_INV1 + dp_star_INV1*u_dist
Qstar_INV1 = q_star_var_INV1 + dq_star_INV1*u_dist
w_INV1 = w_star_rad_s_INV1 - mp_rad_s_per_w_INV1*(Pf_INV1 - Pstar_INV1)
V_INV1 = v_star_phase_v_INV1 - nq_v_per_var_INV1*(Qf_INV1 - Qstar_INV1)
```

`V_INV1` is the phase RMS voltage. `mp_…` and `nq_…` are already in three-phase totals (Doc 13 §3); do not multiply by 3 or √3. In every non-P* case `dp_star_INV1` is 0 in the file, so the same block serves every case.

### 4.5 Angle (Eq. 13.3, first part)

```
theta_INV1 = integral(w_INV1), initial output = theta0_INV1
```

θ grows to about 1 600 rad over 5 s; this is fine for a double-precision sine. Do not reset or wrap it.

### 4.6 Source signals (Eq. 13.3, second part)

Three math blocks, inputs `V_INV1`, `theta_INV1`, driving the three controlled sources of §4.1:

```
ea = sqrt(2)*V_INV1*sin(theta_INV1)
eb = sqrt(2)*V_INV1*sin(theta_INV1 - 2*pi/3)
ec = sqrt(2)*V_INV1*sin(theta_INV1 + 2*pi/3)
```

On INV2 multiply each by `(1 - trip_INV2*u_dist)` only if you use the switch-free trip of §4.8 option B.

### 4.7 Frequency output

```
f_INV1 = w_INV1 / (2*pi)
```

This is the commanded frequency (not a PLL), as the engine reports it.

### 4.8 Trip (INV2, used by TS-02 only)

The engine removes INV2 at `t_dist` and keeps its bus and line or reactor in the network (Doc 13 §5, guide §4.4).

- **Option A (preferred, as the guide):** one bidirectional switch per phase between INV2's current sensor and its bus label, each driven by an on-off controller whose input is `1 - trip_INV2*u_dist` (closed = 1). In every other case `trip_INV2` is 0 and the switch never opens. Opening a current-carrying ideal switch spikes the voltage: if the spike stops the run or rings, add a small RC snubber across each switch and declare it in `unmodelled_elements` (Doc 13 §10). Run TS-02 last.
- **Option B (no switch):** multiply ea, eb, ec by `(1 - trip_INV2*u_dist)`. This shorts INV2's terminals to the star point instead of opening them, which is **not** what the engine does; use it only if option A cannot run, and declare it.

After the trip, INV2's P, Q and f are no longer meaningful: the engine reports P = Q = 0 and no frequency (the script ignores `f_INV2` after the trip).

## 5. Lines and reactors

Per line, per phase: a resistor `r_<line>` in series with an inductor `l_<line>`, between the two bus labels, e.g. LN1 phase a: `B1a — R (r_LN1) — L (l_LN1) — B2a`. No shunt element. LR1 and LR2 are built exactly the same way (`r_LR1`, `l_LR1`, …). A three-phase RL branch with the same R and L per phase is equivalent.

Inductors start at zero current unless an initial-current field exists [check in PSIM]; you may enter `I0_<line>` there only if the field takes a phase value, not an RMS one, so leave it at zero unless you are sure. On a stable design the start-up transient dies out in about 1 s.

## 6. Constant-PQ load (L1 at B2)

PSIM 9.0 has no constant-power element; if 9.1.4.400 has one, note it, but use this build so the load is the engine's load exactly at every frequency (guide §4.3).

1. Three voltage sensors `B2a/b/c` to ground → `va_B2`, `vb_B2`, `vc_B2`.
2. Load set points with the step:

```
PL = p_L1 + dp_L1*u_dist
QL = q_L1 + dq_L1*u_dist
```

3. Three math blocks:

```
den = va_B2^2 + vb_B2^2 + vc_B2^2
ia_L = (PL*va_B2 + QL*(vb_B2 - vc_B2)/sqrt(3)) / den
ib_L = (PL*vb_B2 + QL*(vc_B2 - va_B2)/sqrt(3)) / den
ic_L = (PL*vc_B2 + QL*(va_B2 - vb_B2)/sqrt(3)) / den
```

4. Three controlled current sources, each from `B2a/b/c` to a common star point, the star point to ground, with the current flowing **out of the bus into the source** (the load absorbs power).
5. Check: with these currents Σ v·i = PL and Eq. 13.4 on the load gives QL, so the load draws exactly the sheet values.

**If the run fails at t = 0 or the load bus rings:** a current source fed only through inductors is stiff. Add, in this order and only as far as needed, the numerical aids of Doc 13 §10: (a) a small capacitor per phase from B2 to ground (start with 1 µF); (b) a low-pass on va_B2…vc_B2 before the load blocks. Write each aid and its value in the run metadata (`unmodelled_elements`). The case stays layer 1 only if the aid's steady effect, measured by running SS with and without it, is below the layer-1 tolerance (D-121).

## 7. Bus voltages, angles and line currents

For **every bus** (B1, B2, B3, INV1T, INV2T as present) three voltage sensors to ground, then:

```
V_<bus> = sqrt(va^2 + vb^2 + vc^2)                         (V line-to-line RMS, balanced set)
alpha_<bus> = (2*va - vb - vc)/3
beta_<bus> = (vb - vc)/sqrt(3)
A_<bus> = (180/pi)*atan2(beta_<bus>*alpha_B1 - alpha_<bus>*beta_B1,
                          alpha_<bus>*alpha_B1 + beta_<bus>*beta_B1)
```

`A_B1` is 0 by definition (export it anyway, as the constant 0). The single `atan2` gives the angle of the bus relative to **B1**, already wrapped to ±180°. If the math block has no `atan2` [check in PSIM], tell me and I give you the equivalent with `atan` and sign tests.

For **every line and reactor** three current sensors (one per phase, in series anywhere along the line, arrow from the `from` bus to the `to` bus), then:

```
I_<line> = sqrt((ia^2 + ib^2 + ic^2)/3)                    (A, phase RMS)
```

Why these formulas: they are exact for a balanced three-phase set at every instant, so there is no averaging window and no half-cycle lag (guide §8).

## 8. System frequency

```
D1:          f_sys = f_INV1
D2 family:   f_sys = (f_INV1 + (1 - trip_INV2*u_dist)*f_INV2) / (2 - trip_INV2*u_dist)
```

The engine's system frequency is the mean commanded frequency of the inverters in service; after the TS-02 trip it is INV1 alone. The transient class is judged on `f_sys`.

## 9. Probes = CSV columns

Place one voltage probe on each signal below, named exactly as written. These are the only columns the comparison reads.

| Design | Columns |
|---|---|
| D1 | `f_sys f_INV1 P_INV1 Q_INV1 V_B1 V_B2 A_B1 A_B2 I_LN1` |
| D2-AB, D2-LF | `f_sys f_INV1 f_INV2 P_INV1 Q_INV1 P_INV2 Q_INV2 V_B1 V_B2 V_B3 A_B1 A_B2 A_B3 I_LN1 I_LN2` |
| D2-LR, D2S, D2H | as D2-AB plus `V_INV1T V_INV2T A_INV1T A_INV2T I_LR1 I_LR2` |

SIMVIEW adds `Time` itself. Export from SIMVIEW as text or CSV [check in PSIM: File → Save As, text format]; do not edit the file.

## 10. Assemble the three schematics

| Schematic | Contents | Inverter buses |
|---|---|---|
| `D1.psimsch` | INV1, LN1, L1, buses B1 B2 | INV1 at B1 |
| `D2.psimsch` (D2-AB, D2-LF) | INV1, INV2, LN1, LN2, L1, buses B1 B2 B3 | INV1 at B1, INV2 at B3 |
| `D2LR.psimsch` (D2-LR, D2S, D2H) | as D2 plus LR1, LR2 and buses INV1T, INV2T | INV1 at INV1T, INV2 at INV2T |

Build D1 first. Make D2 by copying D1, adding INV2 (copy of INV1 renamed), LN2 and B3. Make D2LR by inserting the two reactor lines and terminal buses. Save each in `C:\Users\Rifky Alif\Documents\PSIM\projects\`.

**Checklist before the first run (per schematic):**

- [ ] Parameter File points to the right `params.txt`
- [ ] No literal number that exists in `params.txt`
- [ ] Every `_INV2` field renamed on the copied inverter (search the schematic for `_INV1` on the INV2 side)
- [ ] Current sensors: inverter → bus, from → to, load bus → load
- [ ] Integrator initial values: `P0_`, `Q0_`, `theta0_` of the right inverter
- [ ] All probes of §9 present and named exactly
- [ ] Simulation control as §1

## 11. First run: SS-01 on D1

1. Parameter file: `validation\out\layer1\d1_M1\params.txt`. Run.
2. Look at SIMVIEW before exporting. Values to expect at the end of the run (from that file): `f_sys` ≈ 49.840 Hz (`f0`), `P_INV1` ≈ 20 112 W (`P0_INV1`), `Q_INV1` ≈ 8 006 VAR, `V_B1` ≈ 433.07 V, `V_B2` ≈ 430.95 V, `I_LN1` ≈ 28.86 A. If the start is not flat or the end differs clearly, check §4.3 initial values, the `mp`/`nq` names and the sensor directions before anything else.
3. Export to `C:\Users\Rifky Alif\Documents\PSIM\output\SS-01_D1_L1_run01.csv` and write the metadata sidecar (guide §5 step 4).
4. Compare, from `validation\`:

```powershell
..\engine\.venv\Scripts\python -m m5 steady records\d1_M1.mgrun.json "C:\Users\Rifky Alif\Documents\PSIM\output\SS-01_D1_L1_run01.csv" 1
```

Every row should read PASS (angles REPORTED). Send me the output if anything fails.

## 12. Every other case

Change only the Parameter File path (and the total time if it is typed), run, export, compare with the command of guide §6. Folder names in `validation\out\layer1\` match the records: `d2-lr_M1` for SS-02 on D2-LR, `d2-lr_SM-01`, `d2_TS-02`, and so on. Order (Doc 13 §10): SS-01 → SS-04, then SM, DR, TS-01, TS-03, TS-02 last. On D2-AB expect the oscillation to grow even before 1 s (Doc 13 §5, D-123): that is the expected behaviour, not a build error.

## Log

| Date | Change |
|---|---|
| 2026-11-22 | Created; parameter files now define every disturbance name (zero when unused) so one schematic per topology runs every case. |
