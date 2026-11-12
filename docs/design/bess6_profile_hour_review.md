# BESS-6 review (P11 hour axis LOAD_PROFILE_HOUR, S-10 hour mode, 2026-11-13)

Decisions: Doc 9 D-113 K333 – K338. The user took the recommendations for the axis shape (fixed fields 0/23/24), the λ > 1 warning (both adapters), M3b only, and the worst-hour direction per metric. The rest are agent decisions within Doc 12 FR-78, FR-79 and Eq. 12.9. No engine change.

What changed
- Server:
  - `domain/profile.py` (new): `HOUR_AXIS`, `has_daily_profile`, `table_total_kw`, `profile_lambdas` (Eq. 12.9) and `hour_peak_warning`. `services/battery/autonomy.py` now uses the same λ helper.
  - Validation: the hour kind is accepted only on M3b, only with fields 0/23/24 and a Load table with active power; otherwise SWEEP_RANGE_INVALID on `axis`. No LoadProfile gives PROFILE_LENGTH on `load_profile` (K334).
  - Real adapter: `convert.on_axis` maps hour h to λ_h and then takes the LOAD_SCALE branch; `studies.m3b` adds PROFILE_PEAK_ABOVE_LOADS. The Fake Engine adds the same warning (K336).
  - Fake profile `m3b-hours`: 24 placeholder hours (not engineering values), hour 22 SOLVER_FAILED.
- Client:
  - `AxisForm`: option "Profile hour (24 h, loads scaled by the load profile)" on S-10 only, and only when the design has a LoadProfile; From, To and Points are hidden (fixed range).
  - S-10 hour mode, detected from the run's own axis: x axis and table column "hour (h)", "First hour not FEASIBLE", table "Worst hour per key metric" (`components/profileHour.ts`, FEASIBLE hours only; frequency by distance from nominal; lowest is worst for voltage, λ_c, ζ_min; highest otherwise), and the λ > 1 warning as an alert.
- Docs: Doc 3 §6.5 and §9 #6 (APPLIED), Doc 7 S-10, Doc 12 log, Doc 9 D-113.
- Seam-6 exceptions: FR-78 and FR-79 removed; only FR-121 (golden script) remains of the battery ones.

Tests
- Contract, `tests/api/test_profile_hour.py`: 24 points with values 0 – 23 (both engines); on the Real Engine hour 18 equals LOAD_SCALE λ = 1.0 and hour 0 equals λ = 0.4; no profile → PROFILE_LENGTH; fixed range (3 cases); M3d refuses the hour kind; λ > 1 gives exactly one warning.
- Client: `profileHour.test.ts` (direction per metric, non-FEASIBLE hours skipped).
- E2E, `tests/e2e/test_profile_hour.py`: no hour option without a profile; worst hours 19, 19, 20, 21 and first hour not FEASIBLE 22 on `m3b-hours`; λ > 1 alert shown once.

Shots: `bess6_shots/s10_before.png` (three axis kinds, no hour option) and `bess6_shots/s10_after.png` (hour mode on `m3b-hours`).

Limits
- The GUI has no load-profile editor (FR-04 Should); the E2E opens a saved Project file with the profile added.
- The key-metric strip above still says "First infeasible value 22 h" next to the hour sentence; the plot joins the line through the failed hour as it does for any sweep.
- S-12 (M3d) does not offer the hour axis (K333); scenarios (M3c) are unchanged.
- The worst-hour view is a client summary of the payload, not a new engine quantity.
