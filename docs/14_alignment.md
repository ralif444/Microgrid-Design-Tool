# 14 — Alignment of Docs 01–11 with the final manuscript

> Doc 14 of the doc set (added 2026-11-01). Source of truth: `Seminar.pdf` (final seminar-proposal manuscript, 28-10-2026). This list records every known difference between the engineering docs (written 17–21 Oct 2026) and the manuscript, and its status. Rule: the manuscript wins; a user decision taken after the manuscript (2026-11-01) wins over the manuscript and is marked KONFLIK (user-decided).

## Ringkasan

Dokumen ini mendaftar semua perbedaan yang diketahui antara dokumen teknis (Doc 01–11, disusun 17–21 Oktober 2026) dan naskah seminar proposal final. Setiap butir memuat dokumen yang terdampak, isi naskah yang berlaku, dan status penyelarasannya. Doc 02, 03, dan 06 serta CLAUDE.md dan aturan agen diselaraskan pada putaran ini karena menjadi dasar Tahap 1.1. Dokumen lain (01, 04, 07, 08, 09, 10, 11, dan ADR) diselaraskan sebelum tahap yang membutuhkannya, dan butirnya tetap tercatat di sini. Satu keputusan pengguna setelah seminar menyimpang dari naskah, yaitu pembatalan larangan persamaan di dokumen rancangan, dan dicatat sebagai konflik yang sudah diputuskan. Fitur tambahan pascaseminar tidak dilebur ke dokumen inti pada putaran ini; fitur itu tetap di Doc 12 sampai Tahap 1.5 direncanakan.

---

## 1. Status legend

| Status | Meaning |
|---|---|
| APPLIED | Changed in the target doc on 2026-11-01. |
| PENDING-1.1 | Must be applied before stage 1.1 starts. |
| PENDING-x.y | Apply before the named stage. |
| NO CHANGE | Checked; doc already matches. |

## 2. Contract and data (Doc 03)

| # | Item | Manuscript | Status |
|---|---|---|---|
| A1 | PS parameters: m_inv (≥ 0, required), n (integer ≥ 1, required), r ∈ {0, 1} (required; r = 1 only if n ≥ 2), t_aut_h (integer 1–24, optional), eta_dc (0 < η ≤ 1, optional), dod (0 < DoD ≤ 1, optional). Violations → INPUT_INVALID. | 4.2.2, Eq. 4.2–4.4, 4.13 | APPLIED |
| A2 | PS output: S_L, S_inv, unit rating rounded up to 0.1 kVA, total installed; storage energy staged (E_ac → E_dc → E_nom, furthest stage whose parameters exist, named in the basis); computed only with LoadProfile and t_aut; warning when profile peak > ΣP_k. | 4.2.2 | APPLIED |
| A3 | SizingAdvice input_hash covers Loads, LoadProfile and PS parameters (RunRecord canonicalisation). | 4.2.2 | APPLIED |
| A4 | Inverter gets `tau_p_s`, `tau_q_s` (s), no default; required when M4a/M4b is requested, missing → INPUT_INVALID. Schema version bump. | 4.2.6, Tabel 4.10 | APPLIED |
| A5 | Inverter gets `p_setpoint_kw`, `q_setpoint_kvar` (P*, Q*) for reference steps on P* and Q*. | 4.2.6, 4.2.8 | APPLIED |
| A6 | DesignConstraints: no numeric defaults; every limit optional; an empty limit is reported "not evaluated" so an unchecked design never looks feasible. | 4.2.4, Tabel 4.9, A.1 #16 | APPLIED |
| A7 | M2 parameters m_inv, m_line (≥ 0, no default; for SizingCheck) and t_aut_h, eta_dc, dod (optional; storage stage); M2 output adds λ_c, λ_s with resolution (grid step 0.05, bisection to 0.005), λ_ub check, power-balance check, per-constraint normalised margin (Eq. 4.18), `not_evaluated` list, SizingCheck fields S_req, headroom, I_req and storage energies. | 4.2.4, Eq. 4.10–4.16 | APPLIED |
| A8 | M1 output adds ε_X (validity indicator, A4). | Tabel 4.6 | APPLIED |
| A9 | M3a step: relative or absolute, no default, exactly one required. | 4.2.5, Eq. 4.17 | APPLIED |
| A10 | M3b/M3d axis may be a shared scale factor over a set of elements (ratio between units kept); λ axis scales P and Q of all loads at fixed PF. | Tabel 4.10, Eq. 4.14 | APPLIED |
| A11 | Per sweep point: status, limiting constraint, key metrics including λ_c, ζ_min, Re λ_dom, losses, indicators; optional eigenvalues per point (root locus); M4a at every admissible point when requested. | 4.2.9, Tabel 4.10; Doc 12 §8 | APPLIED |
| A12 | M3a–M3d return FEASIBLE when the request completes; per-point/per-scenario Status lives in the payload. M3 does not return SOLVER_FAILED at request level. | 4.3.2 | APPLIED |
| A13 | M4a parameters: optional `tau_in_s`; outputs: stability class STABLE / MARGINAL / UNSTABLE (replaces `is_stable`), ζ_min, participation factors (only when the eigenvector matrix is well conditioned), indicators r_τ, κ, r_in, ε_X with evaluated flag and reason, label "validity not calibrated". | 4.2.6, 4.2.7, Eq. 4.20–4.21, 4.23 | APPLIED |
| A14 | M4b: reference step on P*, Q*, V* or ω*; load step/scaling permanent or finite duration; LOAD_SCALING on one or all buses; output adds transient class (RECOVERED_STABLE, CRITERIA_VIOLATED, UNSTABLE as FEASIBLE; simulation failure → SOLVER_FAILED; invalid configuration → INPUT_INVALID), Q trajectories, max RoCoF (descriptive). | 4.2.6 | APPLIED |
| A15 | Allowed Status per analysis type: PS {FEASIBLE}; M1 {FEASIBLE, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE}; M2 {FEASIBLE, INFEASIBLE}; M3a–d {FEASIBLE}; M4a/M4b {FEASIBLE, SOLVER_FAILED}; all types also INPUT_INVALID and UNAVAILABLE. Any other → UNAVAILABLE / ENGINE_ERROR. | 4.3.2 | APPLIED |
| A16 | `warnings` on every result (e.g. ENGINE_KIND_FAKE, PROFILE_PEAK_ABOVE_LOADS, RATING_MARGIN_SHORT). | 4.3.2, 4.2.2, 4.2.4 | APPLIED (Doc 03 §5.2 + Doc 06 §3.2) |
| A17 | Server derives r_ohm, x_ohm and both hashes and overwrites client values. | 4.3.5 | NO CHANGE (already in Doc 03 §3.3, Doc 06 §3.1) |
| A18 | RunRecord 17 fields; six canonicalisation rules; REPRODUCED iff status and result_hash equal; replay_of_record_id. | 4.3.5, Tabel D.2 | NO CHANGE |
| A19 | solver_config defaults: max_iterations 50; mismatch tolerance 10⁻³ W and 10⁻³ VAR; condition-number limit 10¹² (engine-internal). | 4.2.3 | APPLIED |
| A20 | Equations allowed in design docs (DR-08 cancelled). | — | KONFLIK (user-decided 2026-11-01; manuscript Tabel A.3 #8 says no equations); APPLIED to Doc 02, 03, 06 headers |

## 3. API (Doc 06)

| # | Item | Manuscript | Status |
|---|---|---|---|
| B1 | 15 endpoints unchanged. | 4.3.6 | NO CHANGE |
| B2 | 413 body limit initial 10 MiB (reviewed at WP 1.7.1). | 4.3.6 | APPLIED |
| B3 | MetaInfo limits initial values: TIME_BUDGET_S 30, SWEEP_CAP 1000, MARGIN_WARN 0.05, BODY_LIMIT_MIB 10; SCENARIO_CAP, M3A_PARAMETER_CAP, M4B_DURATION_CAP_S stay null until fixed; MetaInfo carries `indicator_threshold_version` (null until stage 1.6). | 4.1.3, 4.3.6, 4.2.7 | APPLIED |
| B4 | §4 per-analysis table: PS and M2 parameters, M4a `tau_in_s`, M3 status set {FEASIBLE}. | A1, A7, A12, A13 | APPLIED |
| B5 | `ENGINE_KIND_FAKE` warning on every Fake result (was [ASSUMPTION]). | 4.3.2 | APPLIED |
| B6 | Unsupported analysis type in a phase → UNAVAILABLE / NOT_APPLICABLE (not 404) when the route exists. | 4.5.1 | APPLIED |
| B7 | Contract suite: nine behaviours on both adapters, plus a defective Fake profile. | 4.3.2, 4.5.1 | APPLIED (Doc 08 §4.2, 2026-11-01) |

## 4. Requirements (Doc 02)

| # | Item | Manuscript | Status |
|---|---|---|---|
| C1 | FR-06/FR-07: PS parameters and staged storage energy. | A.1 #6–7, 4.2.2 | APPLIED |
| C2 | FR-16: no numeric defaults; empty limit "not evaluated". | A.1 #16 | APPLIED |
| C3 | FR-23: add ε_X. FR-24/25: not-evaluated constraints never counted as satisfied. | Tabel 4.6, 4.2.4 | APPLIED |
| C4 | FR-33: stability class; FR-34: four-kind catalogue, transient class. | A.1 #33–34 | APPLIED |
| C5 | Conventions: TIME_BUDGET 30 s, SWEEP_CAP 1 000, MARGIN_WARN 0.05 as initial values. | 4.1.3 | APPLIED |
| C6 | NFR-13: browser decided — latest stable Google Chrome. | A.2 #7 | APPLIED |
| C7 | DR-08 cancelled. | A20 | APPLIED (KONFLIK noted) |
| C8 | Counts stay 60 FR (38/21/1), 18 NFR, 9 DR; the manuscript tables print no IDs, the mapping is by content and order of Tabel A.1–A.3. | Lampiran A | NO CHANGE |

## 5. Other docs (not edited in this round)

| # | Doc | Item | Manuscript | Status |
|---|---|---|---|---|
| D1 | 01 brief | Project objectives and RM/T: final RM (5 + main) and Bloom levels replace RM-P/T-P wording. | 1.2–1.3 | PENDING-1.7 (thesis writing) |
| D2 | 04 architecture | 16 components of the local process incl. re-run orchestrator (added to break the RunRecord-service ↔ pipeline cycle); only the execution guard imports the Engine Port; import-linter + dependency-cruiser. | 4.3.1–4.3.2, Gbr 4.4b | APPLIED (2026-11-01) |
| D3 | 04 / ADRs | Ten decisions with margins and revisit triggers (Tabel 4.11): 10 MiB triggers for storage and stateless backend; 100 ms edit trigger for client state; 30 s trigger for execution model. | 4.4.2 | APPLIED (Doc 04 §10, ADR "Revisit when" lines, 2026-11-01) |
| D4 | 07 UI | 17 routes (10 Must, 6 Should, 1 Could); stability/transient class wording; indicator label "validity not calibrated"; constraints "not evaluated" display; PS parameter form (6 fields). | 4.3.7, 4.2 | APPLIED (2026-11-01, entry 1.2) |
| D5 | 08 verification | Seven test seams (Tabel 4.12); nine contract behaviours; defective Fake profile; DoD ten conditions; canonicalisation tests in WP 1.1.4; four-level engine V&V hierarchy; M5 procedure now in Doc 13. | 4.5.1–4.5.3 | APPLIED (2026-11-01) |
| D6 | 09 register | Close items resolved by the manuscript (time budget, sweep cap, margin warn, browser, defaults policy, disturbance catalogue); add Doc 12/13 open points. | 4.1.3 | APPLIED (Doc 09 §10, appended, 2026-11-01) |
| D7 | 10 roadmap | Phases P0–P4 → stages 1.1–1.7 with gates of Tabel 4.15, durations (1.1: 1–2 weeks; 1.2: 4–6; 1.5: 3–5; 1.7: 2–3), 39 work packages (Tabel B.1), six gate rules. | 4.5.5–4.5.6, Lampiran B | APPLIED (2026-11-01; gate rules G3–G6 [PERLU VERIFIKASI]) |
| D8 | 11 traceability | Map docs to final manuscript chapters (Bab 1–5) instead of proposal Bab I–III. | — | PENDING-1.7 |
| D9 | CLAUDE.md | Entry point names Doc 12–14 and Seminar.pdf; no-maths guardrail removed. | — | APPLIED |
| D10 | _agent_rules_docset.md | Addendum C (no equations) cancelled; Addendum A sources updated. | — | APPLIED |
| D11 | 07 / 03 / 06 | Merge of Doc 12 extensions (FR-61–FR-85, S-18, endpoint 16). | Doc 12 | PENDING-1.5 |
| D12 | Prototype `App.zip` | Validation package (cases, designs, tolerance policy, PSIM guide) is reusable prior art for stage 1.6; app code is reference only. | 4.3.8 | NO CHANGE (noted in Doc 13) |

## Log

| Date | Change |
|---|---|
| 2026-11-01 | Created; Doc 02, 03, 06, CLAUDE.md and agent rules aligned in the same session. |
| 2026-11-01 | Paket 0 of stage 1.1 (repo): D2, D3, D5, D6, D7 and B7 applied in the repository copies of Doc 04, 05_adr, 08, 09, 10. |
