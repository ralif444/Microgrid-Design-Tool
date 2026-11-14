# Spec: UI redesign (diagram workspace)

Basis: `docs/ui-ux-audit.md` (2026-11-13). Mockup: `docs/design/redesign-2026-11-13/workspace-mockup.html`.

## Decisions (user, 2026-11-13)

- Primary user: practising engineer. Desktop only; no mobile layout.
- Language switch English / Indonesian; vocabulary and number format follow the language.
- Light and dark themes, switchable.
- Structure: diagram workspace. Four areas: Model, Check, Studies, Report.
- Visual direction "Quiet panel": calm grey, one accent, colour only when something is abnormal; status always paired with icon or text; no decorative or confusing symbols.
- Single-line diagram: keep the current app's symbol set and layout.
- Power flow and constraint check stay two separate checks (not merged into one action).
- Functional additions allowed: delete confirmation, autosave, locale-safe number input.
- Leave room for later additions: X10 cable and breaker elements on the diagram and in the element list, and further studies.

## Open

- `issues/01-indonesian-vocabulary.md`

## Plans (not implemented)

- `plan-workspace.md`: port the workspace to the app, stages W1 to W6
- `plan-functional-items.md`: number input, delete confirmation, autosave
