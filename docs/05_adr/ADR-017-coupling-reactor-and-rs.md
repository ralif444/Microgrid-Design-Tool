# ADR-017 — Coupling reactors as a line kind, and the app-side reactor sizing advice (RS)

- Status: **Accepted** by the user 2026-11-19 (spec `.scratch/coupling-reactor/spec.md`, decisions Q1–Q8; Doc 9 D-119). The reactor as a design element was approved by the supervisor 2026-11-19 (Doc 14 D20, Q5; Doc 9 D-120).
- Drivers:
  - Catalogue D2 is small-signal UNSTABLE under plain droop (Doc 9 D-118 K357; Doc 13 §4): short low-voltage cables are mostly resistive.
  - User decision 2026-11-19: realistic cases only; remedies (1) coupling reactors, (4) long feeders, (6) guidance; a sizing suggestion when a design is unstable.
  - CLAUDE.md and Doc 12 §1: no new equations, states or assumptions in the model; Engine Port unchanged.
  - ADR-014 and ADR-015: app-side analyses composed in the pipeline (`diagnostics.computed_by = "app"`).

## Context
A reactor in series with an inverter is an RL branch, which the model already has (a Line). What is missing is a way to enter it by its datasheet values (L in mH, R in mΩ), to keep it apart from cables (cable sizing must skip it), and a way to find the size that makes an unstable design stable.

## Options considered
| Option | Verdict |
|---|---|
| A. Reactor as a Line with `kind: "REACTOR"`, explicit terminal bus per inverter, stored as a 1 m line with derived per-km values (Q1, Q2). | **Chosen** |
| B. A hidden output-reactor field on the Inverter, folded into the engine model. | Rejected: changes the engine model and the Engine Port mapping. |
| C. A new element type in the snapshot. | Rejected: schema bump and engine mapping for what is already a line. |
| RS as a new engine analysis | Rejected: RS composes M1 and M4a; an engine change is not needed (Doc 12 §1). |

## Decision
1. **Line.kind** `"CABLE" | "REACTOR"`, optional; absent means a cable. The canonical snapshot omits null fields, so old files keep their hashes and `schema_version` stays 1. The real adapter maps only R, X and length, so the engine sees an ordinary line.
2. **Storage:** `length_km = 0.001`; `r_ohm_per_km` = R(mΩ) numerically; `x_ohm_per_km` = 2πf·L(mH). The form edits L and R; per-km values are never shown for a reactor.
3. **Catalogue kind REACTOR:** `inductance_mh`, `resistance_mohm`, `rated_current_a` required; `rated_voltage_v`, `impedance_percent` optional; per-field sources as for the other kinds. Values from datasheets only (base catalogue: BLOCK LR3 40-4/70, /80, /100; Schneider VW3A4556 with R derived from the printed losses as an upper bound, D-120).
4. **Cable sizing (CB)** skips REACTOR lines. The LINE_CURRENT constraint uses the reactor's confirmed rated current.
5. **RS, analysis type** on `POST /api/analyses/RS`, app-side branch as CB and BA: depends on an M1 RunRecordRef; parameters {damping_target_ratio, max_percent, reactor_x_over_r, reactors[]}; stage-1 code `REACTOR_SIZING_INVALID`; status FEASIBLE, INPUT_INVALID or UNAVAILABLE (TIMEOUT when the search overruns the time budget).
6. **RS method (design choice, no new model equation):** one reactor per inverter, the same share p of each inverter's own base impedance Z_b = V_LL²/S (Q3); bisection on p in (0, max_percent], 10 steps; each probe adds the terminal buses and reactor lines, runs M1 then M4a through the execution guard, and accepts p when M4a is STABLE with ζ_min ≥ ζ\* and M1 FEASIBLE within the design voltage limits. Per inverter the pick is the catalogue part with L ≥ needed and rated current ≥ the inverter rated current, smallest rated current first, then smallest L; the picks are confirmed with M1 and M4a.
7. **Outcomes:** BASE_NOT_EVALUATED, NOT_NEEDED, NOT_FOUND_BELOW_CEILING, VOLTAGE_LIMITED, NO_CATALOGUE_PART, NOT_CONFIRMED, FOUND. Advice only: the verdict of M4a is unchanged; the user applies and re-runs.
8. **No ζ\* default** (Q4): pre-filled from the M4a damping threshold when one was used.
9. **Apply** (UI) adds the terminal bus and the reactor line per inverter and moves the inverter after a confirmation; there is no undo stack in the app, so the confirmation replaces "one undo step" of the spec.

## Consequences
- OpenAPI and TS types gain the RS route, the enum value and `Line.kind`; unit suffixes `_mh`, `_mohm`, `_percent`.
- A Fake Engine RS run carries the Fake warning; RS is never reported as an engine result.
- The TRUMPF manual names an integrated virtual impedance without a value (spec §6a, Q8): the engine models the inverter without it, so results on TRUMPF designs are conservative. PSIM must model the inverter the same way (Doc 13).

## Review triggers
- The supervisor rejects the reactor element (Doc 14 D20): keep the analysis findings in the thesis, remove `kind` and RS.
- A published inverter output impedance becomes available: count it as a sourced line, not as an engine change.
