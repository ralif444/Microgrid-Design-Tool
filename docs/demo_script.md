# Demo script (WP 1.7.4)

A demonstration of App v1 from a clean copy, on the Real Engine, for the advisor. About 15 minutes. Rehearsed on 2026-11-03 (Doc 9 D-70) on Windows 11 with Google Chrome; the values quoted below are what the Real Engine (mgengine 0.4.0) returned in that rehearsal. Since 2026-11-05 (EX-7) the demo starts from the guided example; its M1 values, the M2 frequency margin and ζ_min were checked again on the Real Engine through the API, and λ_c and λ_s in the Report after **Run the whole example**.

Design D2 uses the Doc 13 §4 prototype values (to be confirmed or replaced at WP 1.6.1). The limits in step 3 are the reference-design study settings of Doc 3 §3.7, not values from a standard (manuscript 4.2.4).

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

Click **Open guided example (D2)**. The header shows **Example mode** with **Leave example mode**: design D2 of Doc 13 §4 with the Doc 3 §3.7 limits and the scenarios D2S and D2H already in the Project (Doc 12 X9, D-92). Every screen now carries a banner "Example mode: …" and a disclosure **What this step shows** with its source; the analysis forms are pre-filled, each value tagged "Example" with its source.

Two ways on:
- **Short (the run took under 2 s on the Real Engine on 2026-11-05):** on S-02 click **Run the whole example**. It runs PS → M1 → M2 → M3c → M4a → M4b in turn, lists M3a, M3b and M3d as "skipped: not set in the example", and opens the Report (FR-104, D-98). Then go to step 7.
- **Step by step:** follow steps 3–6, using the **Next:** link at the foot of each screen.

## 3. The limits are already set (S-06)

Open **4 Constraints**: 0.95 – 1.05 p.u., 49.75 – 50.25 Hz, inverter loading 1, read from the Project file. They are part of the design snapshot, so changing them after M1 marks M1 stale and M2 asks for M1 again (FR-48).

## 4. Power flow M1 (S-07)

Open **5 Power flow (M1)**, click **Run M1**. Show:
- banner FEASIBLE with "This is not yet a check against your limits";
- system frequency 49.87736 Hz, INV1 15.411 kW, INV2 9.632 kW (equal to the engine hand check, Doc 9 D-63 K124; the guided Project gives the same, `tests/project_file/test_guided_example.py`);
- the Power sharing table: both inverters flagged "Q–V droop not rating-proportional" (advisory);
- the validity indicators: ε_X evaluated, r_τ and κ "run small-signal (M4a)", caption "threshold not yet calibrated".

## 5. Constraint check M2 (S-08)

Open **6 Constraint check (M2)**: m_inv 0.2 and m_line 0.2 are pre-filled from the example (D-92 K230). Click **Run M2**. Show:
- FEASIBLE, with the margin table; frequency lower-limit margin about 0.127 Hz;
- **Not evaluated**: line currents and power balance have no limit, so they are listed and not counted as satisfied;
- λ_c 2.034 against λ_s 20.456 ("solution existence, not a stability limit");
- the advisory Sizing check, kept apart from the verdict.

Optional on the way: **Scenarios (M3c)** compares D2 base, D2S and D2H; **Sensitivity**, **Sweep** and **Envelope** show the NEEDS VALUE note, because the example leaves their step counts empty (D-92 K231).

## 6. Small-signal M4a (S-13)

Open **Small-signal (M4a)**, click **Run M4a**. Show: class STABLE, ζ_min 0.0973, dominant mode 11.72 Hz associated with INV2, participation factors, and the indicator panel now filled from M4a (r_in "tau_in not given"). On **Transient (M4b)** the presets DR-01, TS-02 and DR-02 of Doc 13 §5 fill the disturbance in one click.

## 7. Report and traceability (S-16, S-15)

Open **8 Report**: the line "Produced in example mode from the guided example D2.", verdict, limiting constraints, not-evaluated list, A1–A6 table with indicator values, traceability with RunRecord ids and hashes. **Print / Save as PDF** gives the printable version (FR-60). Open **Run history** to show one RunRecord per run, each with engine identity and hashes (FR-46, FR-47).

## 8. Optional

- **Leave example mode**: the forms lose their example values and the Project stays (FR-99); **Save** writes a normal Project file without the example settings.
- **Open example D2** on S-01 opens the same design without the guidance, limits or scenarios (FR-85).
- **Network** → **Diagram (read-only)**: three buses, two lines (FR-14).
- **Scenarios** → **Run N−1 check** (FR-80).
- **Save** the Project file, then open it again with **Open project file** (FR-54, FR-55).
- Restart without `MGAPP_ENGINE` to show the Fake Engine: every banner then carries "FAKE engine" (D-48 K20).

## What not to claim

Results are not yet validated against PSIM (stage 1.6, Doc 13); the indicator thresholds are not calibrated; limits are study settings, not standard values.
