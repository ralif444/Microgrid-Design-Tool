# W2 token mapping (applied 2026-11-14)

Status: done

Basis: ADR-016 §3, mockup tokens (`docs/check-screen-changes.md`), current `frontend/app/tokens.css` and `frontend/app/carbon.scss`, Carbon `white` and `g100` themes and `@carbon/colors` (values read from `node_modules` on 2026-11-14). Nothing here is applied.

How the app is themed today: `carbon.scss` merges a custom map into Carbon's `white` theme (warm page `#f4f2ee`, navy text `#0b1f44`, teal accent `#00737d`); `tokens.css` reads the resulting `--cds-*` values and adds a navy header, a gradient bar and seven status roles. Only one `:root` block; no dark theme.

Plan: replace the light map with the mockup values, add a dark map built on Carbon `g100`, emitted under `[data-theme="dark"]`; give the roles a dark counterpart; drop the navy header and the gradient (mockup rule: no gradients). Component modules keep their token names.

## 1. Carbon theme map

| Carbon token | Today (light) | Proposed light (mockup) | Proposed dark (mockup) |
|---|---|---|---|
| background (page) | #f4f2ee | #f7f8f9 surface | #252c33 surface |
| layer-01 (tables, panels) | #ffffff | #ffffff raised | #2c343c raised |
| layer-02 (sunken) | #faf9f7 | #f7f8f9 surface | #252c33 surface |
| field-01 (inputs) | #ffffff | #ffffff raised | #2c343c raised |
| text-primary, icon-primary | #0b1f44 | #1b2733 ink | #e6eaed ink |
| text-secondary | #4a5468 | #5b6875 ink-2 | #9aa6b2 ink-2 |
| border-subtle-01 | Carbon | #d6dade rule-2 | #39434c rule-2 |
| border-strong-01 (input edge) | Carbon #8d8d8d | #5b6875 ink-2 (phase 7: 5.70:1) | #9aa6b2 ink-2 |
| interactive, button-primary, link-primary, focus, border-interactive | #00737d | #1f5fbf act | #7fb0f5 act |
| text-on-color (on buttons) | Carbon | #ffffff act-ink | #10202f act-ink |
| layer-selected-01, highlight | #e6f2f3 | #dfe9f8 act-soft | #2b3d55 act-soft |
| diagram canvas (app token) | — | #e4e7ea canvas | #1c2227 canvas |
| button-primary-hover / -active, link-primary-hover | #005f67 / #004b52 | **open, see Q2** | **open, see Q2** |

## 2. Status roles (`--role-*`)

Mockup rule: colour only when something is abnormal; status always icon + word.

| Role (used for) | Today fg / bg | Proposed light | Proposed dark | Source |
|---|---|---|---|---|
| negative (INFEASIBLE, violated rows) | #8a3800 / #fff2e8 | #b53b0b / #fbe6dc | #f0834a / #4a2c1e | mockup bad, bad-soft |
| caution (INPUT_INVALID, near limit) | #684e00 / #fcf4d6 | #8a5a0b / #f6ead0 | #e0b050 / #443619 | mockup warn, warn-soft |
| success (FEASIBLE) | #0e6027 / #defbe6 | **Q3** | **Q3** | — |
| error (SOLVER_FAILED, ENGINE_ERROR, field errors) | #a2191f / #fff1f1 | keep | red-30 #ffb3b8 / red-90 #520408 | @carbon/colors |
| attention (stale M1, dependency) | #0043ce / #edf5ff | **Q4** | **Q4** | — |
| info (not evaluated, notes) | ink-2 / #f4f4f4 | #5b6875 / #f7f8f9 | #9aa6b2 / #252c33 | mockup |
| advisory (SizingAdvice, SizingCheck) | #6929c4, dashed | keep | purple-30 #d4bbff | @carbon/colors |

Icon and edge colours follow the fg value of each role unless the contrast check below fails.

## 3. Header

| | Today | Proposed |
|---|---|---|
| Header background | navy #0b1f44 | surface (light #f7f8f9 / dark #252c33) with a rule-2 bottom border, as in the mockup |
| Gradient bar under the header | #0e9aa7 → #7ed957 | removed |

## 4. Switch and storage

- `data-theme` on `<html>`, set before first paint by an inline script reading `localStorage` (try/catch; default light); the switch sits in the header Settings menu as in the mockup.
- Print keeps the existing `@media print` block (grayscale), whatever the theme.

## 5. Checks at implementation

- Re-compute the contrast table of `docs/check-screen-changes.md` for every role pair in both themes (text 4.5:1, UI 3:1); any failure is fixed by the next darker or lighter step of the same hue and listed.
- Screenshots of S-05, S-07, S-08, S-16 in both themes; E2E unchanged (no selector depends on colour).

Spot check done 2026-11-14 (all pass 4.5:1): red-30 on dark raised 7.45, red-30 on red-90 8.98, purple-30 on dark raised 7.42, green-30 on dark surface 8.27, #0e6027 on light surface 7.26, white on blue-70 7.79.

## Questions for you

1. Approve the theme map in §1 and dropping the navy header and the gradient (§3)?
2. Hover and pressed shades of the accent are not in the mockup. Proposal: Carbon blue-70 #0043ce / blue-80 #002d9c for light, blue-30 #a6c8ff / blue-20 for dark. Or give your own.
3. FEASIBLE: quiet grey (ink-2 with the check icon and the word), or keep a green (light #0e6027 / dark green-30 #6fdc8c)?
4. Stale M1: the mockup used the warn colour for the stale chip. Use warn for the attention role too, or keep blue?

## Answers (2026-11-14)

1. Approved: §1 map; navy header and gradient bar removed.
2. Carbon blues: blue-70 / blue-80 (light), blue-30 / blue-20 (dark).
3. FEASIBLE quiet grey (ink-2, check icon, word).
4. Attention role = warn amber (same values as caution).

Contrast fixes made at implementation (hover row #e8ebee / #343c44, dark selected #273750) and the dark-only additions (danger button, chart series) are listed in `docs/check-screen-changes.md`, "App tokens after W2".
