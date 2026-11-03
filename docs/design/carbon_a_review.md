# Carbon step (a) review: theme, fonts, global shell (2026-11-03)

First step of ADR-012 option C (visual guidelines v1 §2–§5). Presentation only: no reducer, API
or data-shape change. The engine badge keeps the text "Engine: FAKE" (owner decision). Every
accessible name and test id the E2E suite uses is unchanged.

Screenshots: `carbon-a-2026-11-03/{1440x900,1280x720}/` show these states:
- start without a project (empty)
- project D2 (normal)
- M1 request held (loading)
- M1 done (stepper with done steps)
- M1 stale with M2 blocked
- `/api/meta` aborted (engine unreachable, error)

`640-project.png` shows the 640 px width, which is 200 % zoom of a 1280 px window.

Before screenshots: the ADR-011 shell appears in the earlier `s0x-*/after/` folders. No separate
before set was taken.

## Changes
- **Packages** (ADR-012 table): `@carbon/react` 1.119.0, `@carbon/icons-react` 11.91.0, `@ibm/plex-sans` 1.1.0 and `@ibm/plex-mono` 2.5.0, plus `sass` 1.107.1 as a dev dependency.
- **Theme:** `app/carbon.scss` builds the Carbon `white` theme with the guideline §3.2 overrides. Spot-checked in the compiled CSS:
  - background `#F4F2EE`
  - interactive `#00737D`
  - text `#0B1F44`
  - layers white
- **Fonts:** IBM Plex Sans and Mono come from `@ibm/plex-*`. Their `.woff2` files are bundled into `_next/static/media`. Carbon's own `@font-face` is switched off. The built CSS contains no remote `url()`.
- **Tokens:** `tokens.css` keeps its names, but the values now point at `--cds-*`. Radii and shadows are 0 / none. New `--mdt-*` tokens hold the header colours and the gradient. The `--role-*` status colours are untouched; they are reworked in step (b).
- **Header:** Carbon `Header` in navy, with:
  - wordmark
  - project name with an unsaved dot
  - Run history and Catalogue links
  - Save and Open buttons outlined in white
  - engine Tag (warm-gray FAKE, cool-gray REAL, red unreachable)

  The header stays in the page flow and may wrap. Carbon's version is fixed and one row high, which would scroll sideways at 640 px.
- **Gradient bar:** a 4 px signature bar (#0E9AA7→#7ED957) under the header, the only gradient on screen.
- **Stepper:** links styled like a Carbon ProgressIndicator:
  - a 2 px rule above each step, teal when the step is done or current
  - a numbered circle, filled teal with a check when done
  - a dashed circle when stale, a dotted circle when blocked, beside the existing word flag
- **Tags:** Carbon tags are square, per guideline §5 (no pills).
- **Cleanup:** removed the old `.engine` badge rules from `ui.module.css`.

## Found and fixed while reviewing
- **Header overlapped the stepper.** In the first build the header was still `position: fixed`, was not navy, and covered steps 1–7, so clicks were intercepted. Cause: Turbopack emits Carbon's CSS chunk after the AppShell module, and the single class `.header` lost to `.cds--header`, which has the same specificity. Fixed with the doubled selector `.header:global(.cds--header)`. The tag radius rule uses the same doubling.
- **Header printed.** The same chunk order let Carbon's `display: flex` beat the global print rule `header { display: none }`. The E2E test `test_fr_60_report_print_layout` caught it. Fixed with a print rule in the header module.
- **Contrast comments in `tokens.css`** were estimates. They are now computed with the WCAG 2.x formula:

  | Colour | Use | Contrast | Note |
  |---|---|---|---|
  | white on navy | header text | 16.2:1 | |
  | `#D6DBE4` on navy | muted header text | 11.7:1 | comment said 12:1, corrected |
  | `#5DC4CC` on navy | focus ring | 7.9:1 | |
  | white on `#1D3461` | header hover | 12.2:1 | |
  | teal on white | links and buttons | 5.6:1 | |
  | teal on page | links and buttons | 5.0:1 | |
  | `#4A5468` on page | secondary text | 6.8:1 | |
  | `#4A5A7A` on navy | divider | 2.35:1 | decorative only, never text |

## Checklist (guideline §12, the parts step (a) covers)
- **Offline:** the E2E `page` fixture aborts and fails on any non-localhost request. `test_zoom` opens all 16 routes, so every route is covered on Chromium and Chrome.
- **Light theme only:** no dark-mode rules were added.
- **Sentence-case headings:** unchanged.
- **Square corners, no shadows:** done through the tokens and the Tag rule.

## Open, for later steps
- Status colours and icons (§7.2), the banner and the advisory style are step (b). The stale and blocked flags still use the old `--role-*` colours.
- `carbon.css` is about 1.2 MB because it carries every Carbon component. `@use` per component could trim it, but it is not done; it only matters for local load time.
- The number fields show `0,44` (decimal comma) in the Playwright Chromium on this laptop. This step does not touch the number fields. The cause was not investigated here.
