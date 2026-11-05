# ADR-011 — Styling approach: design tokens and component styles

- Status: Accepted, option A approved by user 2026-11-03. Items 1, 4 and 6 superseded by ADR-012 (Carbon) on 2026-11-03.
- Drivers: D5, D6 (one developer, dependency minimalism); NFR-03 (offline); ADR-002 (static export only); ADR-005 (no dependency without proven need); Doc 7 §1 P2–P4, §5, §8.
- Inputs: `docs/design/ui_audit_2026-11-03.md` (top 10 problems), `frontend/app/tokens.css` (tokens; drafted as `docs/design/tokens.draft.css`).

## Context
Today the visual layer is 33 lines of global CSS over browser defaults. The audit found ten problems, among them:
- raw floats in result tables
- a run-on header with no stepper
- banner roles that share a colour
- text that is right-aligned
- no designed focus ring

The fix must be presentation-only:
- no change to the reducer, the API contracts or the data shapes
- English labels
- status always shown as colour + icon + word
- units on every numeric field and column
- tabular, right-aligned numbers
- a dashed "Advice" treatment
- text contrast of at least 4.5:1 and a visible focus ring

Constraints:
- static export
- no CDN and no remote fonts
- the current runtime dependencies are only `next`, `react` and `react-dom`

The E2E and client tests select by role, label and test id, not by class. Changing class names therefore keeps them working, but changing the DOM structure of a control (for example turning a native `<select>` into a custom listbox) would break them.

## Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Tokens as CSS custom properties + one global base sheet + CSS Modules per component** (Next.js built-in, zero new dependencies) | No install and no new toolchain (D5, D6). Works offline and with static export as-is. Tokens are plain CSS, so the print variant is one `@media print` block. Native controls (`<select>`, `<details>`, `<input type=number>`) keep their accessibility and keep the tests valid. Component styles are scoped, so screens cannot leak into each other. | Hand-written CSS for tabs, a toast and a dialog. Focus trapping and roving tabindex must be written and tested by hand (only Network tabs and the unsaved-changes confirm need them today). No ready component gallery. | **Recommended** |
| B. Tailwind CSS (build-time) + Radix UI primitives, optionally shadcn/ui copies | Fast to style. Radix gives tested keyboard and ARIA behaviour for tabs, dialog and popover. shadcn gives polished defaults. Tailwind works offline at build time. | New deps: Tailwind with PostCSS (dev), plus at least one `@radix-ui/*` package per primitive at runtime, and shadcn typically adds `class-variance-authority`, `clsx`, `tailwind-merge` and an icon set. That is a second styling language in the markup and long class strings in every table cell. Radix replaces native controls with custom DOM, so many label/role selectors in the 30 E2E tests would need review. The benefit at this size is unproven [NEEDS SOURCE for any comparative claim]. | Close alternative; take it if many custom interactive widgets are planned |
| C. Tokens + a single larger global stylesheet (no modules) | Smallest change from today; zero dependencies. | One file grows to many hundreds of lines with global class names; collisions and dead rules are hard to find. | Rejected: A has the same zero-dependency benefit with scoping |

## Decision
Option A:
1. `frontend/app/tokens.css` holds the tokens (neutral scale; roles success, negative, error, caution, neutral-attention, info, advisory; type scale; 4 px spacing; radii; borders; focus ring; print variant). It is imported once in `layout.tsx`.
2. `globals.css` becomes a base sheet:
   - element defaults
   - tables (text cells left; numeric cells `.num` right-aligned with `font-variant-numeric: tabular-nums`; unit in the column header)
   - `:focus-visible` ring
   - the print rules that already exist
3. Components that carry visual meaning get a co-located `*.module.css`: StatusBanner, AppHeader/stepper, EntityTable, the advisory panel, EngineBadge, and the M1/M2 result tables.
4. Status roles map one to one from `status-text.ts` roles:
   - `warning` → negative
   - `attention` → neutral-attention
   - `neutral` → info

   Icons stay inline (Unicode now, inline SVG later), so no icon dependency is added.
5. Number display uses one existing formatter (the `num` of K148, 6 significant digits) in every result table. This is presentation only; stored and exported values are unchanged.
6. Fonts: system stacks only; no `next/font/local` unless a bundled font is approved later.

## Trade-offs and consequences
- Positive: zero new dependencies; offline and static export unaffected; tests keep their selectors; the tokens also drive the print layout.
- Negative: keyboard behaviour of the custom widgets (tabs, toast, dialog) is our own code and needs its own tests. Visual polish depends on hand-written CSS.
- Not changed by this ADR: the reducer, the API, the data shapes, the routes, and the labels. Audit item 4 (results vanish after leaving a screen) needs a store change and is out of scope here; it would go through a Doc 9 entry.
- Follow-up: a screenshot check at 1440×900 and 1280×720 after each restyled screen; the existing 640 px / 200 % zoom E2E test stays.

## Revisit when
- More than about three custom interactive widgets are needed (combobox, popover, data grid with keyboard editing): then reconsider option B for the primitives only (Radix without Tailwind).
- A dark theme or a second brand is requested: the tokens already allow it, but component modules would need review.
