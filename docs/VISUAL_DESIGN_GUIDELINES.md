# Visual Design Guidelines — Microgrid Design Tool (v1)

> Paste this whole file into the Claude Code session that builds the app.
> It defines the look and feel only. It does not change data contracts, the reducer,
> the API, or screen behaviour. Where it conflicts with `docs/07_ui_ia.md` on
> *behaviour*, 07 wins; on *visual styling*, this file wins.
> Decided with the project owner on 2026-11-03.

## 0. How to use this file (instructions for Claude Code)

1. Read this file, then `docs/07_ui_ia.md`, `docs/05_adr/ADR-002`, `ADR-005`.
2. Before installing anything, write `docs/05_adr/ADR-011-carbon-design-system.md`
   (decision: adopt `@carbon/react` with a custom light theme, per §1) and show it to me.
3. Implement in this order and stop for review after each step:
   a. theme + fonts + global layout (§2–§5), b. a `/dev/components` page showing every
   component in §6–§8 in every state, c. screens one at a time (S-03, S-05, S-07, S-08, S-16 first).
4. Every step: `typecheck`, tests, then Playwright screenshots at 1440×900 and 1280×720
   (normal, empty, error, loading states). Critique them against §11 and fix before showing me.
5. Presentation-only diffs. If a visual change seems to need a logic change, ask first.

## 1. Decisions (locked)

| # | Decision |
|---|---|
| D1 | Use **IBM Carbon v11** via `@carbon/react` (+ `@carbon/icons-react`, `sass`). Custom **light** theme based on Carbon `white`. |
| D2 | **Primary / interactive colour = deep teal `#00737D`** (derived from the seminar-slide teal, darkened for contrast). Navy `#0B1F44` = primary text and header. |
| D3 | The **teal→green gradient** is a signature accent only: 4 px bar under the header, Start-page hero band, report cover. Never on buttons, headings, tables, or large panels. |
| D4 | **Brand colours never carry meaning.** Status uses Carbon support colours only, always with icon + word. Brand yellow and orange are **not used** on working screens. |
| D5 | **Warm page background `#F4F2EE`**, white layers for tables, panels, forms. |
| D6 | **IBM Plex Sans** for UI, **IBM Plex Mono** (or Plex Sans with tabular figures) for numeric columns. Sentence-case headings. No all-caps display type. Fonts self-hosted. |
| D7 | **Light theme only** in v1. Dark mode deferred. |
| D8 | App **wordmark only** in the header. University / department logos only on About (S-17) and the report cover (S-16), pending a check of UI visual-identity rules. |
| D9 | **Compact density** for editable data tables (`size="sm"`, ~32 px rows); default size elsewhere. |

Defaults filled in by Claude (owner may change): advisory tag colour = Carbon `purple` (§8);
chart series order (§9).

## 2. Hard constraints (do not break)

- Next.js **static export** only (no SSR, API routes, server actions). Carbon components are client
  components: put `"use client"` where needed.
- **Fully offline**: no CDN, no Google Fonts, no remote icons. After setup, open each route in
  Playwright and assert **zero requests to any host other than localhost**.
- English UI labels.
- Text contrast ≥ 4.5:1 (normal text), ≥ 3:1 (large text, icons, borders of inputs).
- Every action reachable by keyboard; visible focus everywhere.
- Every numeric field and column shows its unit.

## 3. Colour tokens

### 3.1 Brand palette (source: seminar slides; use only as specified)

| Name | Hex | Where allowed |
|---|---|---|
| `brand-teal-700` (primary) | `#00737D` | interactive colour (buttons, links, selected tab, focus on light bg) — 5.6:1 on white, 5.0:1 on `#F4F2EE` |
| `brand-teal-800` (hover) | `#005F67` | primary hover — 7.4:1 on white |
| `brand-teal-900` (active) | `#004B52` | primary active/pressed |
| `brand-teal-50` | `#E6F2F3` | selected table row, selected list item background |
| `brand-teal-300` | `#5DC4CC` | focus ring on the navy header only (7.9:1 on navy) |
| `brand-navy` | `#0B1F44` | header background, primary text (16:1 on white) |
| `gradient-start` | `#0E9AA7` | gradient only (3.4:1, **never text**) |
| `gradient-end` | `#7ED957` | gradient only (1.8:1, **never text, never status**) |
| `page-bg` | `#F4F2EE` | page background |
| ~~yellow `#FFD84D`~~, ~~orange `#F57C21`~~ | — | **not used in the app** (presentation material only) |

### 3.2 Carbon theme overrides

Start from Carbon `white` and override only these tokens. Keep every other Carbon token,
especially all `support-*` tokens, at Carbon defaults.

| Carbon token | Value |
|---|---|
| `background` | `#F4F2EE` |
| `layer-01`, `field-01` | `#FFFFFF` |
| `layer-02` | `#FAF9F7` |
| `text-primary` | `#0B1F44` |
| `text-secondary` | `#4A5468` (6.8:1 on page-bg) |
| `icon-primary` | `#0B1F44` |
| `interactive`, `button-primary`, `link-primary`, `focus`, `border-interactive` | `#00737D` |
| `button-primary-hover`, `link-primary-hover` | `#005F67` |
| `button-primary-active` | `#004B52` |
| `background-brand` | `#00737D` |
| `layer-selected-01`, `highlight` | `#E6F2F3` |

Implementation (preferred, Sass module config; verify token names against the installed
Carbon version and adjust if the compiler complains):

```scss
// src/styles/carbon.scss
@use 'sass:map';
@use '@carbon/react/scss/themes';
@use '@carbon/react/scss/theme' with (
  $theme: map.merge(themes.$white, (
    background: #f4f2ee,
    layer-01: #ffffff,
    layer-02: #faf9f7,
    field-01: #ffffff,
    text-primary: #0b1f44,
    text-secondary: #4a5468,
    icon-primary: #0b1f44,
    interactive: #00737d,
    button-primary: #00737d,
    button-primary-hover: #005f67,
    button-primary-active: #004b52,
    link-primary: #00737d,
    link-primary-hover: #005f67,
    focus: #00737d,
    border-interactive: #00737d,
    background-brand: #00737d,
    layer-selected-01: #e6f2f3,
    highlight: #e6f2f3,
  ))
);
@use '@carbon/react';
```

Fallback if module config fights the build: import Carbon normally and override the emitted
CSS custom properties (`--cds-background`, `--cds-interactive`, `--cds-button-primary`, …) on `:root`.

App-level tokens not in Carbon go in `src/styles/app-tokens.scss` as CSS custom properties
prefixed `--mdt-` (e.g. `--mdt-gradient`, `--mdt-header-bg`).

## 4. Typography

- Install `@ibm/plex-sans` and `@ibm/plex-mono` from npm; serve the font files from the static build.
  Make sure Carbon does **not** emit any `@font-face` pointing to a remote URL (check the built CSS).
- Use Carbon type tokens (`$heading-03`, `$body-01`, `$label-01`, `$helper-text-01`, …), not ad-hoc sizes.
- Page title: `heading-04` (28 px), sentence case. Section title: `heading-02`/`heading-03`.
  Body: `body-01` (14 px). No uppercase transforms except Carbon's own small labels.
- Numbers: `font-variant-numeric: tabular-nums;` in every numeric cell and result value,
  right-aligned. Units sit in the column header, e.g. `P (kW)`, or as a muted suffix in inputs.
- Hashes and IDs (RunRecord hash, element ids): Plex Mono, `code-01`.

## 5. Layout and shell

- **Header** (Carbon `Header`, 48 px): background `brand-navy`, white text. Left: app wordmark
  "Microgrid Design Tool" (Plex Sans SemiBold). Then Project name + unsaved dot. Right: Save, Open,
  Run history, About, and the **engine badge**: `Tag` "FAKE ENGINE" (type `warm-gray`, always visible) or
  "REAL ENGINE" (type `cool-gray`).
- **Signature bar**: directly under the header, `height: 4px; background: linear-gradient(90deg,#0E9AA7,#7ED957);`.
  This is the only gradient on working screens.
- **Pipeline stepper** under the bar (see §7), full width on a `layer-01` strip with a bottom `border-subtle-01`.
- Content: Carbon `Grid` (16 columns), max content width 1584 px, page padding 32 px (`$spacing-07`).
  Spacing only from Carbon spacing tokens (2, 4, 8, 12, 16, 24, 32, 40, 48 px).
- Corners: Carbon default (square). No custom rounded pills, no drop shadows except Carbon's own
  (modals, menus).
- **Start page (S-01)** only: a hero band (~160 px) with the gradient at low intensity
  (gradient over `brand-navy`, or gradient at ~15 % opacity over page-bg), white or navy text
  meeting contrast, then a plain "New Project / Open Project / Restore autosave" card row.

## 6. Component mapping

| UI need (07_ui_ia) | Carbon component | Notes |
|---|---|---|
| Editable tables (Buses, Lines, Loads, Inverters) | `DataTable` `size="sm"` | inline edit cells; unit in header; numeric columns right-aligned; row error shown under the row with `support-error` icon + text |
| Numeric input | `NumberInput` or `TextInput` + unit suffix | `hideSteppers` for engineering values; helper text for valid range |
| Q vs PF choice | `RadioButtonGroup` (inline) | the unused field becomes `disabled` |
| Tabs (Network: Buses/Lines/Inverters) | `Tabs` contained | selected tab underline = teal |
| Status banner (§7) | custom `StatusBanner` styled like `InlineNotification` | needs custom icons; see §7.2 |
| Transport errors | `ToastNotification` (bottom-right) | |
| Confirm dialogs (replace Project, unsaved) | `Modal` (danger variant only for destructive) | focus trap is built-in |
| Empty states | custom `EmptyState` | Carbon pictogram-free: icon 32 px + one line + primary action |
| Run buttons | `Button kind="primary"` | loading: `InlineLoading` inside the button area; navigation stays usable |
| Secondary actions | `Button kind="tertiary"` or `ghost` | max one primary button per view region |
| Badges (Near limit, Stale, Advice) | `Tag` | see §8 |
| Run history | `DataTable` with `TableToolbar` (filter, import) | hash in Plex Mono |
| Tooltips (Indonesian domain terms) | `Toggletip` or `Tooltip` on an info icon | |

## 7. Status presentation

### 7.1 Rule
Status = **colour + icon + word**, always. The headline names the Status in words; the plain
message and next-step hint follow (wording exactly as in 07_ui_ia §5). `status_code` only inside
the collapsible "Details". Banner sits in an `aria-live="polite"` region.

### 7.2 Mapping (Carbon support tokens and `@carbon/icons-react`)

| Status / reason | Role | Token (left border + icon) | Icon |
|---|---|---|---|
| FEASIBLE (any stage) | success | `support-success` | `CheckmarkFilled` |
| INFEASIBLE (M2) | negative result (design violates limits) | `support-caution-major` (Carbon orange) | `Misuse` |
| SOLVER_FAILED | calculation failure | `support-error` | `ErrorFilled` |
| PHYSICALLY_INADMISSIBLE | calculation failure | `support-error` | `WarningHex` (fallback `ErrorFilled`) |
| UNAVAILABLE / ENGINE_ERROR | calculation failure | `support-error` | `Tools` |
| INPUT_INVALID (incl. SWEEP_CAP_EXCEEDED) | caution | `support-warning` | `ListBulleted` |
| UNAVAILABLE / TIMEOUT | attention | `support-info` | `Time` |
| UNAVAILABLE / DEPENDENCY_NOT_MET | attention | `support-info` | `Link` |
| UNAVAILABLE / NOT_APPLICABLE | neutral | `border-strong-01` | `Information` |

Banner style: `layer-01` background, 3 px left border in the role colour, icon 20 px in the role
colour, headline `heading-compact-01`, message `body-01`. Check that `support-caution-major`
exists in the installed Carbon version; if not, use `#FF832B` for INFEASIBLE.
Verify each icon name exists in the installed `@carbon/icons-react`; substitute the closest and tell me.

### 7.3 Limiting-constraint table (M2)
Violated rows: left 3 px `support-caution-major` border + text "Violated by <margin> <unit>".
Near-limit rows: `Tag` "Near limit" (type `warm-gray`, with `WarningAlt` icon). Sort as 07 §5.1.

### 7.4 Stepper
Use Carbon `ProgressIndicator` (horizontal, `spaceEqually`): `complete` = done, `current` = this screen,
`invalid` + secondary label "Stale" = step whose result is out of date, `disabled` + secondary label
"Blocked" = not runnable. Steps stay clickable when their route is enabled (guidance, not a wizard lock).

## 8. Advisory content (SizingAdvice, SizingCheck)
- Panel: `layer-02` background, **1 px dashed `border-strong-01`** outline, no fill colour.
- Top-left `Tag type="purple"` "Advice" (PS) or "Sizing check · from the network" (M2).
- Never inside an editable design table. Accept / Edit values / Skip as `Button` primary / tertiary / ghost.
- Purple is chosen because it is neither a brand colour nor a status colour. (Owner may change.)

## 9. Charts
- No chart library is chosen yet; whichever is used must be bundled locally (no CDN).
- Series colours, in order: `#00737D` (teal), `#0B1F44` (navy), `#8A3FFC` (Carbon purple 60),
  `#D02670` (Carbon magenta 60), `#B28600` (Carbon yellow 50, lines only). Do not add Carbon
  teal 60 (`#007D79`): it is too close to the primary teal.
  Never use status colours for ordinary series.
- Feasibility markers (sweep, envelope): shape + colour + legend text: ● feasible (`support-success`),
  ✕ infeasible (`support-caution-major`), – unavailable (`border-strong-01`). Every plot has a
  table alternative.
- Axes: Plex Sans 12 px, `text-secondary`; gridlines `border-subtle-01`; axis titles include units.

## 10. Report (S-16) and print
- Screen view uses the app theme; the control strip is hidden in print.
- **Cover block** (first page only): gradient bar (8 px) on top, title in navy, Project name, date,
  engine kind + versions, UI / Departemen Teknik Elektro logos (top-right, small) if approved.
- Print CSS: white background (ignore `page-bg`), black/navy text, no gradients except the cover bar,
  tables do not split rows (`break-inside: avoid` on rows and figures), repeated table headers,
  status words always printed (grayscale must still be readable).
- Body type 10.5–11 pt, numbers tabular.

## 11. Do / Don't

| Do | Don't |
|---|---|
| One primary (teal) button per region | Teal or green on large backgrounds |
| Status = colour + icon + word | Colour-only status, or brand colours for status |
| Sentence-case headings in Plex Sans | All-caps heavy display headings like the slides |
| Flat surfaces, Carbon borders | Drop shadows, rounded pills, gradient cards |
| Units in every numeric header/input | Unit-less numbers |
| Right-aligned tabular numbers | Centered numbers in tables |
| Gradient only in header bar, Start hero, report cover | Gradient on buttons, headings, panels |
| Carbon spacing and type tokens | Magic pixel values |
| Self-hosted fonts and icons | Any request to a non-localhost host |

## 12. Review checklist (run before showing each step)

- [ ] No network requests outside localhost on any route (Playwright check).
- [ ] Contrast: all text ≥ 4.5:1; input borders/icons ≥ 3:1 (spot-check with a contrast tool).
- [ ] Keyboard-only walkthrough of Loads → Sizing → Network → Power flow → Constraint check → Report.
- [ ] Every Status in §7.2 rendered on `/dev/components` with correct icon, colour, word.
- [ ] Numeric columns right-aligned, tabular, units present.
- [ ] Only one gradient visible on working screens (header bar).
- [ ] 200 % zoom: no clipped controls; tables scroll horizontally instead of overflowing.
- [ ] Report print preview in grayscale is readable; no split table rows.
- [ ] `next build` still produces a static export with no API routes.
