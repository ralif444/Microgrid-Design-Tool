# X10-6: SLD breakers, report section, Catalogue kind BREAKER (2026-11-09)

Ticket 06 of `.scratch/cable-sizing/`. Sources: Doc 12 FR-113 – FR-115; guideline §6 (rows SLD, Report and Catalogue); Doc 9 D-103 K291, K292 and D-104 K293 – K296.

## Screenshots
Location: `x10-6-2026-11-09/{before,after}/{1440x900,640x900}/`. The setup is the same in every shot:
- the E2E two-bus design on the FAKE engine;
- the server started with `MGAPP_FEATURE_CABLE_SIZING=1`;
- the table file `FAKE_cable_tables_TEST_ONLY.json`, which is fictitious;
- in the after shots only, a test catalogue: conductor E1 (CU, PVC, 3 cores, 10 mm²) and breaker E2 ("FAKE MCB standard", MCB, 20 A).

No value is real sizing advice or vendor data.

| File | Before | After |
|---|---|---|
| `s18-catalogue` | No breaker kind. | "+ Add breaker entry"; breaker E2 open, with the product standard, class, I_n with its page, curve and poles, and the note "used only for the cable sizing match (experimental)". |
| `s08-diagram` | S-08 diagram after a CB run, with no symbols. | A 10 × 10 breaker square on LN1 (near B1, its from bus) and on the INV1 and INV2 stubs. INV1 has focus, so its card shows class, I_n, cable size and I_Z. The legend gains "Circuit breaker (sizing result)". |
| `s05-network` | No symbols. | The same breakers on S-05. |
| `s16-report` | No CB section. | A new section 8, "Cable and overload sizing (experimental)", with the scope note (K-07), the caveat, the method id, the table set with its full SHA-256, the RunRecord id, the PUIL edition KONFLIK (K-08) and the results table. The report SLD figure has no breakers (K295). |
| `s19-match` | — | The INV1 factor row on S-19: "cable E1 (10 mm²); breaker E2. A check only." |

## Changes
- **Contract (D-104 K293, K296).** `ConductorValues` gains `material`, `insulation`, `cores` and `size_mm2`, all optional. A new kind `BREAKER` has `BreakerValues` {standard, class, in_a, curve, poles}.
  - The guard reports "standard is missing", "class is missing" or "sources.in_a (page or section) is missing".
  - OpenAPI and TS types are regenerated. In the unit-suffix test, `mm2` became a unit and `cores` and `poles` became unitless counts.
- **Catalogue screen.** The new fields and "+ Add breaker entry" show only when the flag is on (FR-105). Class, material and insulation are chosen from a list.
- **SLD (FR-113, K295).**
  - `BreakerSymbol` in `symbols.tsx` draws the breaker. `SldSvg` places it: 18 units from the from-bus end along a Line, or at the middle of an Inverter stub.
  - Each breaker can be focused and has its own hover and focus card.
  - The symbols come from `useSldModel().breakers`: the session CB run on the current design (K291), only with the flag on, and only for elements with outcome SIZED.
  - The report figure draws none.
- **Report (FR-114).** `CableReportSection` renders only with the flag on and a current session run. Its catalogue match column is a check only.
- **S-19.** The "Catalogue match" row now shows the match (K294), computed in the browser from the usable entries.
- **Tests.**
  - E2E: `sld_shows_breaker_symbols_after_run` (which also covers the report section), the catalogue match, and no BREAKER kind when the flag is off.
  - Catalogue file: BREAKER roundtrip, the guard reasons, and the enum checks on the new conductor fields.
  - Unit (vitest): `breakerMarks`, and `catalogueMatch` picking the nearest larger cable.
  - FR-113 – FR-115 leave the seam-6 exceptions. FR-106 stays an exception, because saving the settings in the Project is deferred by user decision (D-103 K287).

## Critique and open points
1. **The cores rule is an agent choice.** Multicore matches entries with 3 or more cores, and single-core matches 1 core. The docs say "same cores" only. Confirm or change this rule.
2. **The inverter stub is short (17 units).** The breaker square nearly touches the busbar. It is readable at 100 % but tight at fit-to-view on wide designs.
3. **The Line breaker sits at the from-bus end only.** The guideline says one per sized line, and the user's guide mentions "each Line end". A second symbol at the to-bus end was not drawn.
4. **At 640 px the report table scrolls sideways,** like the other report tables. The print layout was not checked.
5. **The breaker card does not repeat the outcome** (it is always SIZED) or the standard. The S-19 row has both.
