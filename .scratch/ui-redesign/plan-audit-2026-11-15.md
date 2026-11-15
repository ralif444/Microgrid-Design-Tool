# Plan: audit 2026-11-15 follow-up (Catalogue, Sizing, battery bank, study inputs)

Status: Phase A and B done; rounds 2 and 3 done (2026-11-15); rest of "Later" not started

Basis: `docs/ui-ux-audit-2026-11-15.md` and the user's answers of 2026-11-15:

1. Shared inputs: m_inv keeps the O-8 split (Sizing and M2 each own one). t_aut: Sizing owns it. η_dc and DoD: Sizing owns them as design assumptions; a new battery bank pre-fills from Sizing, DoD from the module's recommended DoD when it has one, and can override. The battery result's basis says which value was used and where it came from.
2. Codes: words first, code small after. M-codes stay as suffixes; equation numbers stay in captions, basis and Report, not in form labels; assumption numbers once per screen; PS spelled out on first use. The Report keeps every code.
3. Inspector: keep 24rem / 19rem; labels above inputs inside the inspector, side labels back from 28rem via a container query. Network keeps side labels.

Rules: no engine, Engine Port, equation or Project file format change. The bank stores no "source" field; the source of η_dc and DoD is derived on screen by comparing the bank value with the Sizing value and the module's recommended DoD.

## Phase A: layout and copy (presentation only)
- A1 Field grid: `NumberField` gains `--field-cols` (stacked when `1fr`). Inspector edit form and bank/catalogue sections stack labels; container query restores side labels at ≥ 28rem. Fixes the 1024 px overflow (audit E1/D2).
- A2 Sizing form and Catalogue editor get a fixed label column. Catalogue values become a table: Value | Source (page or section), one caveat for "recorded only" rows instead of "(A2)" per row.
- A3 Hover: list buttons keep the text colour on hover/active (E4/D17).
- A4 Catalogue status: "Usable" / "Information only" + reasons with field labels instead of paths; Kind does not break; selected row marked.
- A5 Sizing: advice table header row (Quantity, Value, Basis), value emphasised, basis muted; "Add 1 inverter draft of …"; next-step text follows Accept/Skip; h1 "Sizing advice (power system parameters, PS)"; Basis lists n and r.
- A6 Sensitivity step radios get a `name`.

## Phase B: battery bank values (small logic, no file-format change)
- B1 New bank: η_dc from the latest Sizing settings; DoD from the module's recommended DoD, else Sizing. Labels lose ", optional" for η_dc and DoD; one hint line says where the pre-fill came from.
- B2 Battery result basis: per bank, η_dc and DoD with their source (Sizing advice, module datasheet, entered on the bank).
- B3 Battery banner: when no bank was evaluated, the headline says so instead of "Advice ready" (uses the payload outcomes).
- B4 Bank draft: functional state updates (E9).

## Round 2 (done)
- Phone width: labels stack above inputs below 40rem (`--field-cols` on :root); Catalogue values table becomes blocks with a source caption.
- Catalogue kept in this browser (`mgapp-catalog`) until its entries are deleted (O1).
- Sizing basis names m_inv as the Sizing field does; bank total without float noise.

## Round 3 (done)
- Study forms: label + select rows use the NumberField label column, one control per row; notes and tags under the control.
- Run buttons in words: "Run sensitivity", "Run small-signal analysis", "Run transient simulation", "Compare scenarios"; Scenarios get the "Missing:" line.
- One placeholder spelling: "Choose…".

## Later (not started)
- Sensitivity grouping, catalogue list via DataTable with key values, battery 7-column table first, bank draft guard (O2), inputs kept across navigation (O4).

## Checks
vitest, typecheck, rebuild, live pass at 1024 and 375 px on Catalogue, inspector bank, Sizing, Sensitivity, Battery.
