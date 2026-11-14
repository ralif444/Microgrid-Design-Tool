# Plan: functional items (delete confirmation, locale-safe number input, autosave)

Status: ready-for-agent

Basis: `spec.md` ("Functional additions allowed"). Plan only; nothing here is implemented. Paths are relative to `frontend/` unless they start with `tests/`.

Decisions (user, 2026-11-14): delete asks for confirmation (dialog, no undo; Doc 07 §7 also says no undo in v1). Autosave asks before restoring. Unanswered points take the planned default: the dialog covers every removal (element, scenario, battery bank); run records stay out of the draft.

None of the three needs the new shell. They can ship before `plan-workspace.md` W4, each on its own branch, in the order below (smallest and safest first).

## F1. Locale-safe number input

Today: `components/NumberField.tsx:49-53` and `components/DataTable.tsx:79` use `<input type="number" step="any">` with `valueAsNumber`. The browser accepts only its own locale's decimal separator, so "0,44" fails on an English browser and "0.44" can fail on an Indonesian one.

Change:
- One shared parse function (in `components/format.ts`): accepts a dot or a comma as the decimal separator, trims spaces, returns null for empty, rejects anything else (including a value with both separators, which is ambiguous) with the existing field error.
- Both inputs become `type="text" inputmode="decimal"` and call it.
- Display of the typed value stays as typed until blur.

Check: unit test for the parser ("0.44", "0,44", "", "1.234,5", "abc", "-0,5", "1e-3"). E2E `fill()` calls keep working with text inputs.

Risk: loses the browser's spinner arrows and built-in `min`/`max` hints; validation already comes from the server (`useValidation`).

## F2. Delete confirmation

Today: the "Delete <name>" button in `components/EntityTable.tsx:80-92` dispatches `rowRemoved` at once. A bus with dependents is already refused (FR-11). Deleting an inverter also removes its battery bank (`store/reducer.ts:199-200`). There is no undo.

Change:
- Carbon `Modal` (danger variant, already a dependency) in `EntityTable.tsx`: names the element, states what goes with it (the bank, for an inverter), buttons "Delete" and "Cancel", focus starts on "Cancel".
- Same dialog for scenario and bank removal (`scenarioRemoved`, `bankRemoved`) if you want it there too.

Check: one unit test for the message text per element type. E2E tests that click "Delete INV1" / "Delete E2" gain one confirm click; do it in the `flows.py` helper.

Not planned: undo. It would replace the dialog but needs reducer history; say so if you prefer it.

## F3. Autosave

Today: no persistence except file save (`components/ProjectFileMenu.tsx`). A reload loses the project; the only guard is a `beforeunload` warning while `unsaved`.

Change:
- On every state change, debounced, write the project part of the store (`project`, `design`, `sizingAdvice`, `scenarios`, `batteryBanks`) to `localStorage` under one key that carries the project-file schema version.
- On start (`app/page.tsx`), if a draft exists, offer "Restore unsaved work from <time>" or "Discard". Loading goes through the same file check as Open, so a draft is validated like a file.
- The `unsaved` flag and file save keep their meaning: autosave is crash recovery, not a second save. Draft is cleared on file save, on discard, and on leaving example mode. Example mode is not autosaved.
- Storage errors (quota, private window) are caught; the app keeps working without autosave and says so once.

Open points:
- `runRecords` can be large. Plan: leave them out of the draft (results are re-runnable; stale markers already handle it). Alternative: include and cap.
- No ADR needed: autosave is already required by the manuscript (4.3.1: backup in browser local storage, never a saved Project) and specified in Doc 04 §3 and Doc 07 S-01 and §7; it was never built.

Check: unit test for write, restore, version mismatch (draft ignored) and storage failure. One e2e: edit, reload, restore.

## Decisions needed from you

1. F2: confirmation dialog (planned) or undo instead.
2. F2: also confirm scenario and bank removal?
3. F3: ask before restoring (planned) or restore silently.
4. F3: leave run records out of the draft (planned) or include them.
