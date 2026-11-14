# Plan: port the diagram workspace to the app

Status: ready-for-agent

Basis: `spec.md`, `docs/design/redesign-2026-11-13/workspace-mockup.html`, `docs/check-screen-changes.md`. Plan only; nothing here is implemented. Paths are relative to `frontend/` unless they start with `docs/` or `tests/`.

Fixed for every stage: presentation layer only. No change to the engine, the Engine Port, equations, data models or API contracts. Existing tests pass at the end of each stage. One branch per stage.

## What the code looks like today (verified 2026-11-14)

- Shell: `components/AppShell.tsx` (Carbon header) plus `components/PipelineStepper.tsx` (9 entries, 6 further routes). 20 routes under `app/`. Static export.
- State: `useReducer` in `store/reducer.ts` (ADR-005). Persistence is file save only.
- Check: `app/power-flow/page.tsx`, `app/constraint-check/page.tsx`, `components/M1Results.tsx`, `components/M2Results.tsx` (`ConstraintTable`, `nearLimit`, `margin_warn` from `/api/meta`), `components/ResultsDiagram.tsx`, `components/Inspector.tsx`, `components/useValidation.ts` (`m1Freshness`).
- Numbers: `components/format.ts` is `num` = 6 significant digits. No `Intl` anywhere.
- Language: none. `lang="en"` fixed in `app/layout.tsx`. `components/glossary.ts` holds Indonesian short definitions shown by `components/Term.tsx`.
- Theme: `app/tokens.css`, light only, bridged to Carbon `--cds-*`. Carbon is a dependency.
- Diagram: `components/sld/SingleLineDiagram.tsx` already has selection, keyboard activation, zoom and fit.
- Tests: 29 vitest files; 22 Python Playwright files in `tests/e2e/` with about 918 locator calls. Stepper link names are used about 94 times (for example "6 Constraint check (M2)" 25 times). `components/PipelineStepper.test.ts` depends on the 9-entry order.

## Decisions (user, 2026-11-14)

- ADR-016 accepted. Newest finding behind it: the manuscript itself (4.1.5, 4.3.7) requires the eight-step stepper and the engine badge on every screen and 17 routes. So the workspace keeps the stepper (compact, in the header) and all routes; the four areas group the steps. No Doc 14 KONFLIK needed.
- W4: new route beside the old pages.
- Carbon kept, restyled through tokens.

## Conflicts with the doc set (resolved by ADR-016)

| Your redesign decision | What the docs say now | Where |
|---|---|---|
| Diagram workspace, four areas | Persistent stepper of eight steps | `docs/07_ui_ia.md:12` (P1), `:45` |
| EN/ID language switch | English labels with Indonesian glossary, DECIDED 2026-10-17 | `docs/07_ui_ia.md:413,422` |
| Dark theme | Deferred; a revisit trigger | ADR-011 `:65`, ADR-012 `:97` |

Resolved: `docs/05_adr/ADR-016-diagram-workspace.md`; Doc 07 §8 and §9 #1 updated. The stepper row is not superseded (manuscript 4.3.7).

## Stages

Ordered so that the early stages do not touch the shell and keep every e2e locator valid.

### W1. Number formatting (small)

- Add per-quantity decimals to `components/format.ts` (power 2, percent 1, per-unit 4, degrees 2, hertz 3, ampere 1, loss 3; from `DP` in the mockup). Keep `num` for callers not yet moved.
- Use it in `M1Results.tsx`, `M2Results.tsx`, `kpi.ts`, the diagram overlay.
- Check: unit test in the existing `format` test file. E2E that assert printed numbers will need new expected strings; count them first.
- Locale separators wait for W5 (no language state yet).

### W2. Tokens and themes (small to medium)

- Set the "Quiet panel" values in `app/tokens.css`; add a dark block under `[data-theme="dark"]`. Keep Carbon and its bridge; do not replace components.
- Theme switch in the header; preference kept in `localStorage` (a per-viewer convenience, not project data).
- Check: contrast table in `docs/check-screen-changes.md` re-computed against the real tokens; by-eye pass of both themes.

### W3. Check screen, inside the current routes (medium)

Apply the seven mockup phases to `/power-flow/` and `/constraint-check/` without changing navigation:

- Status strip (solved, feasible, counts, key facts, freshness from `m1Freshness`).
- Margins table: columns and order from the mockup, using the engine's `margin` and `normalised_margin` and `margin_warn` from `/api/meta`. The mockup's derived margins are not carried over.
- Diagram overlay: status mark beside bus voltage, inverter loading bar, smallest-element-margin marker, in `ResultsDiagram.tsx`.
- Keep "Run M1" and the other accessible names the e2e suite uses until W4.

### W4. Workspace shell (large; the risky one)

- First, in `tests/e2e/`: move navigation into one helper in `flows.py` so the shell change is one edit, not 94. No app change in this step.
- New shell: header with the four area tabs and the compact eight-step stepper (manuscript 4.3.7), element tree, diagram, inspector, results drawer. Model = `/network/` content plus loads and constraints in the inspector; Check = W3. Reuse `SingleLineDiagram`, `Inspector`, `EntityTable`.
- Build it at a new route beside the old pages; switch the default and remove `PipelineStepper` only when the e2e suite passes on the new shell.
- Stepper rules that must survive: stale-M1 blocking (FR-38, FR-40, FR-93), "Next: step" guidance (FR-102), inspector as side panel (FR-90, FR-91).
- Done 2026-11-14 (W4a 8e053ef, W4b): `/workspace/` beside the step pages, opened by the header link "Workspace". Model: element list with add, editable inspector (bus, line, inverter, load, design limits; fields shared with the tables in `components/elementFields.ts`, delete rules in `useRowDelete`). Check: CheckStrip, M2 settings, results diagram, read-only inspector, results drawer (Margins, Power flow). Studies and Report link to their pages until W6. The default route and `PipelineStepper` are unchanged; the compact stepper waits for the default switch. Not in the workspace yet: catalogue pick and battery bank (still on `/network/`).

### W5. Language switch (medium; blocked)

- Dictionary plus a language context, no new dependency; `html lang` follows it; number separators follow it through `Intl.NumberFormat`.
- Blocked on `issues/01-indonesian-vocabulary.md` for the Indonesian strings. The English side can ship first with the switch hidden.

### W6. Studies and Report areas (not planned in detail)

- The six M3/M4 pages, `/runs/` and `/report/` first move under the new tabs unchanged.
- Any redesign of them gets its own mockup and approval first, as the Check screen did.

## Left for later, needs model or engine change

- Line current limit (ampacity) so lines get a status: X10 cable work.
- Power balance as an evaluated check.
- A test case that produces the "Near limit" state.

## Decisions needed from you

None open for W1 to W4. W5 waits on the vocabulary issue.
