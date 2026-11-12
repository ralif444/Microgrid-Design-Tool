# BESS-0 review (documents only, 2026-11-12)

Scope: Doc 12 (§2, §3.5, §3.6, new §3.14 with Eq. 12.14–12.18 and FR-116 – FR-121, §4, §5, §6, §7, §9 #4 and #33–#39, Ringkasan, Log), Doc 9 D-106 K303–K310 with supersession notes on D-59 K106 and D-62, ADR-015 (Proposed) and the ADR index, Doc 3 §9 #6, Doc 7 S-20 / §2.5 / §3 / §3.1, Doc 11 §3, seam-6 exceptions, guideline log.

Checks
- Every equation and rule is copied from `docs/BESS_FEATURE_GUIDELINES.md` §3; no new value, parameter or reference was added.
- The four [CONFIRM] points were put to the user before writing (2026-11-12): snapshot outside, no default DoD/η_dc/SoC, optional `battery_banks` without a schema bump, fictitious TEST ONLY data. All four took the recommendation.
- No KONFLIK entry (E9); Doc 14 unchanged. Doc 12 §9 #4 now says B3 is in v1 without a supervisor gate: this reverses the earlier "only with supervisor approval" note of Doc 12 §2 by user decision E9.
- Doc 4 and Doc 6 are not edited: as in the cable round, Doc 4 changes when the ADR is accepted and the branch is built (BESS-3); Doc 12 §6 carries the API row until the merge.
- `tools/check.py` passed; static seam 140 passed (ID coverage: FR-73 – FR-79 and FR-116 – FR-121 listed as exceptions).

Open for the gate
- ADR-015 Q1–Q6: accepted as recommended at the gate (user 2026-11-12, D-106 K309).
- Golden baseline of the API responses: to be saved at the start of BESS-1, before the first code change (guideline §10).
- Glossary sources for DoD, SoC, autonomy, C-rate (Doc 12 §9 #38).
