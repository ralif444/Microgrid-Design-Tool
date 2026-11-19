# Demo script (WP 1.7.4)

A demonstration of App v1 from a clean copy, on the Real Engine, for the advisor. About 15 minutes. Rehearsed on 2026-11-03 (Doc 9 D-70) on Windows 11 with Google Chrome; the values quoted below are what the Real Engine (mgengine 0.4.0) returned in that rehearsal. Since 2026-11-05 (EX-7) the demo starts from the guided example; its M1 values, the M2 frequency margin and ζ_min were checked again on the Real Engine through the API, and λ_c and λ_s in the Report after **Run the whole example**.

Design D2 uses the base-catalogue values of Doc 13 §4 (D-116); the values below were re-checked on the Real Engine through the API on 2026-11-19 (D-118). Navigation follows the workspace (area tabs Model, Check, Studies, Report; Doc 14 D15). The limits in step 3 are the reference-design study settings of Doc 3 §3.7, not values from a standard (manuscript 4.2.4).

## 0. Prepare (once, needs the internet)

```
git clone --branch tahap-1.5 https://github.com/ralif444/Microgrid-Design-Tool
cd Microgrid-Design-Tool
cd backend && uv sync && cd ..
cd frontend && npm ci && cd ..
uv run --python 3.13 python tools/build_frontend.py
```

## 1. Start (one command, offline from here)

PowerShell:
```
$env:MGAPP_ENGINE = "REAL"; uv run --project backend mgapp
```
Open http://127.0.0.1:8000 in Chrome. Point at the header badge **Engine: REAL**.

## 2. Open the guided example (S-01)

Click **Open guided example (D2)**. The header shows **Example mode** with **Leave example mode**: design D2 of Doc 13 §4 with the Doc 3 §3.7 limits and the scenarios D2S and D2H (load levels on the as-built D2) already in the Project (Doc 12 X9, D-92). Every screen now carries a banner "Example mode: …" and a disclosure **What this step shows** with its source; the analysis forms are pre-filled, each value tagged "Example" with its source.

Two ways on:
- **Short (the run took under 2 s on the Real Engine on 2026-11-05):** in the Model area click **Run the whole example**. It runs PS → M1 → M2 → M3c → M4a → M4b in turn, lists M3a, M3b and M3d as "skipped: not set in the example", and opens the Report (FR-104, D-98). Then go to step 7.
- **Step by step:** follow steps 3–6, using the **Next:** link at the foot of each screen.

## 3. The limits are already set

In the Model area select **Design limits** in the element list: 0.95 – 1.05 p.u., 49.75 – 50.25 Hz, inverter loading 1, read from the Project file. They are part of the design snapshot, so changing them after M1 marks M1 stale and M2 asks for M1 again (FR-48).

## 4. Power flow M1 (S-07)

Click **Run M1**, then open the **Check** area. Show:
- banner FEASIBLE with "This is not yet a check against your limits";
- system frequency 49.89088 Hz, INV1 16.368 kW, INV2 10.912 kW: P shared 75 : 50 in proportion to rating, f = 50 − 0.006667 × 16.368 (`tests/project_file/test_guided_example.py`);
- the Power sharing table: no "Q–V droop not rating-proportional" flag (equal per-unit droop, D-116 K346); Q is 6.257 and 4.619 kvar, not exactly 75 : 50, because of the line voltage drop;
- the validity indicators: ε_X evaluated, r_τ and κ "run small-signal (M4a)", caption "threshold not yet calibrated".

## 5. Constraint check M2 (S-08)

In the **Check** area: m_inv 0.2 and m_line 0.2 are pre-filled from the example (D-92 K230). Click **Run M2**. Show:
- FEASIBLE, with the margin table; frequency lower-limit margin about 0.141 Hz;
- **Not evaluated**: line currents and power balance have no limit, so they are listed and not counted as satisfied;
- λ_c 2.278 against λ_s 32.59 ("solution existence, not a stability limit");
- the advisory Sizing check, kept apart from the verdict.

Optional on the way: **Scenarios (M3c)** compares D2 base, D2S and D2H; **Sensitivity**, **Sweep** and **Envelope** show the NEEDS VALUE note, because the example leaves their step counts empty (D-92 K231).

## 6. Small-signal M4a (S-13)

In **Studies**, open **Small-signal (M4a)** and click **Run M4a**. Show: class **UNSTABLE**, ζ_min −0.336, dominant mode 11.30 Hz (eigenvalue +25.3 ± j71.0 s⁻¹) with δ of INV2 and the P filters participating, and the indicator panel filled from M4a (r_in "tau_in not given"). Explain it: the real N2XY cable has R/X ≈ 19.6 and the lines are short, so the two droop inverters are coupled too tightly; this is the finding the PSIM validation checks (Doc 13 §4, §5; user decision 2026-11-19). On **Transient (M4b)** only TS-02 (INV2 trip) runs to the end; the other presets stop at the step with "network solution lost" (Doc 13 open point 7).

## 6a. Coupling reactors (S-13, X11; Real Engine only, ADR-017)

Below the UNSTABLE result the **Coupling reactors** panel shows the fixed guidance. Enter a damping target (for example 0.05) and a search ceiling (for example 10 %); the X/R is pre-filled from the catalogue reactors. Click **Size coupling reactors**: outcome FOUND at about 1.39 % of each inverter's base impedance, INV1 needs about 0.114 mH (BLOCK LR3 40-4/100), INV2 about 0.171 mH (BLOCK LR3 40-4/70); the confirming run with those parts is STABLE, ζ_min 0.218, 6.15 Hz, lowest bus 0.984 p.u. (Doc 9 D-119). Click **Apply to the design**, then **Apply**: the diagram gains INV1T and INV2T with coil symbols. Re-run M1 and M4a: STABLE, and the panel goes away. The same design is the example **D2-LR** on S-01. To show that realistic feeder lengths alone are not enough, open **D2-LF** (CIGRE LV benchmark lengths, 175 m and 140 m): M4a stays UNSTABLE (ζ_min −0.044; D-120). Leave example mode first if the guided example is open, or do this part after step 7.

## 7. Report and traceability (S-16, S-15)

Open the **Report** area: the line "Produced in example mode from the guided example D2.", verdict, limiting constraints, not-evaluated list, A1–A6 table with indicator values, traceability with RunRecord ids and hashes. **Print / Save as PDF** gives the printable version (FR-60). Open **Run history** to show one RunRecord per run, each with engine identity and hashes (FR-46, FR-47).

## 8. Optional

- **Leave example mode**: the forms lose their example values and the Project stays (FR-99); **Save** writes a normal Project file without the example settings.
- **Open example D2** on S-01 opens the same design without the guidance, limits or scenarios (FR-85).
- **Network** → **Diagram (read-only)**: three buses, two lines (FR-14).
- **Scenarios** → **Run N−1 check** (FR-80).
- **Save** the Project file, then open it again with **Open project file** (FR-54, FR-55).
- Restart without `MGAPP_ENGINE` to show the Fake Engine: every banner then carries "FAKE engine" (D-48 K20).

## What not to claim

Results are not yet validated against PSIM (stage 1.6, Doc 13); the indicator thresholds are not calibrated; limits are study settings, not standard values.
