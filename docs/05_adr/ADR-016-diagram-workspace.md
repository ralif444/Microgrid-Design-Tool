# ADR-016 — Diagram workspace layout, EN/ID language switch, dark theme

- Status: **Accepted**, approved by the user 2026-11-14 (shell built beside the current pages; Carbon kept and restyled through tokens). **Amended 2026-11-14:** the user decided that the redesign plan wins over the manuscript's UI description, stepper removal included: option B replaces option A (Doc 14 D15, KONFLIK user-decided).
- Drivers:
  - UI/UX audit `docs/ui-ux-audit.md` and the redesign decisions in `.scratch/ui-redesign/spec.md` (user, 2026-11-13)
  - Mockup `docs/design/redesign-2026-11-13/workspace-mockup.html` and its log `docs/check-screen-changes.md`
  - Manuscript 4.1.5 (p. 67), 4.3.1, 4.3.7 (p. 88); Doc 07 P1, §2, §8, §9 #1
  - ADR-005 (state), ADR-011 and ADR-012 (styling, Carbon, light theme only)

## Context
- **What the user decided (2026-11-13).** The practising engineer is the primary user. The screens become one diagram workspace: element tree left, single-line diagram centre, inspector right, results drawer bottom, in four areas Model, Check, Studies, Report. The UI language is switchable between English and Indonesian, with vocabulary and number format following the language. Light and dark themes are both required. Desktop only.
- **What the manuscript fixes (checked 2026-11-14).** Every screen shows the engine-kind badge (FAKE or REAL) and the eight-step guidance stepper (4.3.7: "Setiap layar menampilkan lencana jenis mesin FAKE atau REAL dan stepper panduan delapan langkah"). The UI has 17 static routes (4.3.7). Browser autosave is a backup only, never a saved Project (4.3.1). The manuscript does not fix the UI language or a theme.
- **What the docs fix beyond the manuscript.** Doc 07 §8 and §9 #1: English labels with an Indonesian glossary (user, 2026-10-17). ADR-011 and ADR-012 list "a dark theme is requested" as a revisit trigger.
- **Code facts (2026-11-14).** The frame is `frontend/components/AppShell.tsx` plus `PipelineStepper.tsx` (Carbon header). About 94 E2E locators use stepper link names. `SingleLineDiagram` already supports selection, keyboard activation and zoom. There is no language state and no dark token block.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Workspace that keeps the manuscript's frame.** The four areas group the eight stepper steps (Model = Loads, Sizing advice, Network, Constraints; Check = Power flow, Constraint check; Studies = Further analyses; Report = Report). The stepper and the engine badge stay visible on every screen; all 17 routes stay. Built at a new route beside the current pages; the default switches when the E2E suite passes. | No manuscript conflict; no Doc 14 KONFLIK; old pages remain a fallback; tests migrate in one place. | The stepper and the area tabs both sit in the header and must not compete. | Superseded 2026-11-14 by B |
| B. Workspace that replaces the stepper with the four area tabs | Simplest header. | Contradicts manuscript 4.3.7; needs a Doc 14 KONFLIK row and a thesis text change. | **Accepted 2026-11-14** (user decision; Doc 14 D15) |
| C. Restyle the current pages only | Least work. | Does not deliver the layout the user approved. | Rejected |

## Decision
1. **Layout: option B (amended 2026-11-14; was option A).** The workspace is the page frame and its four area tabs replace the eight-step stepper. The step screens are reached through the areas. The stepper's rules move to the areas: guidance, not a lock; M2 and further analyses blocked without a current M1 (FR-38, FR-40, FR-93); "Next: step" hints (FR-102). The 17 routes of Doc 07 §2 stay reachable. The inspector stays a side panel (FR-90, FR-91).
2. **Language: EN/ID switch.** Supersedes Doc 07 §8 "UI language" and §9 #1 (user, 2026-10-17). A dictionary and a language context, no new dependency; `<html lang>` follows the choice; number separators follow it through `Intl.NumberFormat`. Indonesian strings ship only after `.scratch/ui-redesign/issues/01-indonesian-vocabulary.md` is closed against the manuscript's terms. The Indonesian glossary (`components/glossary.ts`) stays.
3. **Theme: light and dark.** Answers the ADR-011 and ADR-012 revisit trigger. Values come from the mockup tokens (`docs/check-screen-changes.md`, contrast table). Carbon components stay; both themes are applied through `app/tokens.css` and its bridge to `--cds-*`. Theme and language preference are kept in `localStorage` as per-viewer conveniences, never in the Project file.
4. **Unchanged:** engine, Engine Port, API, data model, equations, Project file format, ADR-005 state model.

## Consequences
- Doc 07 §8 and §9 #1 are updated to point here. ADR-011 and ADR-012 stay accepted; their dark-theme trigger is answered by this ADR.
- E2E navigation moves into one helper in `tests/e2e/flows.py` before the shell changes.
- Order of work and the open items: `.scratch/ui-redesign/plan-workspace.md` and `plan-functional-items.md`.

## Revisit when
- The supervisor or examiners ask for the stepper back (then option A again, and Doc 14 D15 closes).
- The vocabulary issue shows that the manuscript's terms cannot carry the UI (then the switch ships English-only).
