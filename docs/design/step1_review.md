# ADR-011 step 1: core components (2026-11-03)

Presentation only. No reducer, API, data shape or label change. Test selectors are kept, which is why the "*unsaved" text and "Engine: FAKE" are unchanged.

## What was built
| Component | File | States shown in `/dev/components/` |
|---|---|---|
| AppShell | `components/AppShell.tsx` (replaces `AppHeader.tsx`) | live header: brand, Project name, unsaved flag, Run history, Catalogue, Save, Open, engine badge (REAL / FAKE / unreachable) |
| PipelineStepper | `components/PipelineStepper.tsx` | new project; design entered with M1 missing; M1 and M2 done; design edited after M1 (stale, blocked) |
| StatusBanner | `components/StatusBanner.tsx` | all 16 rows of Doc 7 §5, including the Fake note, an issue list and Details |
| DataTable | `components/DataTable.tsx` | editable (Enter moves down, Escape restores the value on focus), row error, empty, derived read-only column |
| NumberField | `components/NumberField.tsx` | normal, empty, error, disabled; unit suffix; forms align with `--field-label` |
| AdvisoryPanel | `components/AdvisoryPanel.tsx` | dashed outline + "Advice" chip |
| EmptyState | `components/EmptyState.tsx` | with an action |
| Toast | `components/Toast.tsx` | transport error, fixed and inline |
| Buttons | `app/globals.css` | secondary, primary (form submit), busy ("Running..." with a spinner), disabled |

Supporting pieces:
- Tokens: `app/tokens.css`.
- Base sheet: `app/globals.css`.
- Icons: `components/Icon.tsx` (inline SVG, no dependency).
- Number display: `components/format.ts` (`num`, moved from `M2Results.tsx`).
- Fix: `<html lang="en">`, because the UI is English (Doc 7 §8); the A1–A6 statements keep `lang="id"`.

## Screenshots
**Before:** `audit-2026-11-03/<size>/`
**After:** `step1-2026-11-03/<size>/`
Sizes: 1440x900 and 1280x720.

| View | Before | After |
|---|---|---|
| Gallery (every state) | none | `gallery.png`, `gallery-fold.png`, `gallery-table-focus.png` (visible focus ring) |
| Start | `00-start-empty.png` | `00-start-empty.png` |
| M1 after run | `06-power-flow-after-run.png` | `06-power-flow-after-run.png` |
| M2 after run | `07-constraint-check-after-run.png` | `07-constraint-check-after-run.png` |
| Stale design, stepper blocked | none | `09-sweep-stale-fold.png` |

## Critique of the first pass, and what was fixed
1. **NumberField forced a 12rem label column.** On Sweep this spread "From / To / Points" across the row. The default is now the natural label width, and a form opts into alignment with `--field-label`.
2. **Stepper flags were too long.** "blocked: M1 stale" wrapped the stepper onto two rows at 1280 px. The flag now reads "blocked" or "stale"; the reason stays in the accessible name.
3. **Row errors showed the raw field key** (`length_km:`). They now use the column header ("Length:").

## Known gaps, left to step 2 (per screen)
- Result tables outside M2 (M1, Sizing check, Report) still print raw floats, and their text cells are not yet split from numeric ones. They are still on the old global tables and move to DataTable with `numeric` columns in step 2.
- The M2 margin table still shows units in its cells (audit item 6).
- Screens still use `.advice` and their own tables. AdvisoryPanel and DataTable are adopted one screen at a time.
- Results still vanish after leaving a screen (audit item 4). This needs the store, so it is outside this work.
- Number inputs show a decimal comma ("0,02") on this machine. A check with `lang="id"` and `lang="en"` showed the comma in both cases, so the Windows display locale causes it, not this change. The values sent are unchanged.
