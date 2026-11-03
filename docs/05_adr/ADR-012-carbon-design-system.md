# ADR-012 — Carbon design system with a custom light theme

- Status: Accepted, option C approved by user 2026-11-03 (engine badge keeps the text "Engine: FAKE"; points 2–5 accepted as proposed). It supersedes ADR-011 decision items 1, 4 and 6 (own tokens, inline icons, system fonts). ADR-011 items 2, 3 and 5 still hold: the base sheet, scoped component styles, and the `num` formatter.
- Drivers: `VISUAL_DESIGN_GUIDELINES.md` v1 (decided with the project owner 2026-11-03, decisions D1–D9); ADR-002 (static export only); ADR-005 (no dependency without proven need); NFR-03 (offline); Doc 7 §1 P2–P4, §5, §8.
- Numbering: the guidelines ask for `ADR-011-carbon-design-system.md`, but ADR-011 already exists (styling approach, option A, accepted 2026-11-03). This record is therefore ADR-012.

## Context
- ADR-011 option A is implemented on `tahap-1.5`. It consists of:
  - tokens in `frontend/app/tokens.css`;
  - our own components (AppShell, PipelineStepper, StatusBanner, DataTable, NumberField, AdvisoryPanel, EmptyState, Toast);
  - five restyled screens: S-03, S-05, S-07, S-08 and S-16, up to commit bc049ec.
- The new guidelines lock a different look and feel:
  - IBM Carbon v11, through `@carbon/react`;
  - teal `#00737D` as the interactive colour and navy `#0B1F44` for text and the header;
  - a warm page background `#F4F2EE`;
  - IBM Plex fonts, self-hosted;
  - square corners and no drop shadows;
  - a teal→green gradient used only as a signature accent;
  - status colours taken from Carbon `support-*` tokens.
- Constraints that do not change:
  - static export only;
  - zero requests to any host other than localhost;
  - English labels;
  - status shown as colour + icon + word;
  - units on every number;
  - contrast of at least 4.5:1 for text and 3:1 for icons and input borders;
  - keyboard access everywhere.
- The 30 E2E tests and the client tests select elements by role, accessible name and test id, often with `exact=True`. These names act as contracts. A Carbon component that renders a different role or name for the same control breaks them, even when it looks right.

### Packages (checked on the npm registry 2026-11-03; not installed)
| Package | Version | Peer dependencies | Unpacked size |
|---|---|---|---|
| `@carbon/react` | 1.119.0 | react `^19.0.0` allowed, react-dom, react-is, sass `^1.33` | 5.3 MB |
| `@carbon/icons-react` | 11.91.0 | react `>=16` | 17.2 MB (tree-shaken in the build) |
| `@carbon/styles` | 1.118.0 (dependency of `@carbon/react`) | sass | 4.3 MB |
| `sass` | 1.107.1 | — | 6.1 MB (dev, build-time only) |
| `@ibm/plex-sans` | 1.1.0 | — | 4.1 MB |
| `@ibm/plex-mono` | 2.5.0 | — | 3.3 MB |

React 19.3.1 falls inside the peer range of `@carbon/react`. Next.js 16 supports Sass when the `sass` package is installed. Whether static export builds cleanly with Carbon's client components will be verified in step (a), not assumed here.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Keep ADR-011; re-skin the tokens to the new palette, fonts and corners | No dependency. Every test contract stays. Fastest. | Does not follow guideline D1, which the owner locked. Plex still needs `@ibm/plex-*` or copied font files. | Rejected by D1 |
| B. Full Carbon: use Carbon components everywhere the mapping in guideline §6 names one, including the `DataTable` render-prop and `ProgressIndicator` | Closest to the guideline text. Carbon's tested keyboard and ARIA behaviour for Tabs, Modal and Toast. | `ProgressIndicator` steps are buttons, not links, which breaks about 51 link selectors such as `link "1 Loads"` and the `href` navigation. The `DataTable` render-prop owns the row markup, so the per-row `<tbody>` with its test id and inline error row has to be rebuilt. | Rejected: changes behaviour and tests, not only looks |
| **C. Carbon theme and styles everywhere; Carbon components where they keep the role and name contracts; Carbon-styled markup of our own where they would not** | Matches D1–D9 visually. Tests keep their selectors. Uses Carbon's Sass theme, type and spacing tokens, icons and fonts. Components used as-is: Header shell, Button, Tabs, Tag, InlineNotification, ToastNotification, Modal, TextInput/NumberInput (`hideLabel` where the label is the cell's `aria-label`), RadioButtonGroup, InlineLoading, and the Table primitives (`Table`, `TableHead`, `TableRow`, …), which render plain table elements. | Two places stay custom-built: (1) the stepper keeps `<a>` links styled like `ProgressIndicator`; (2) the data table keeps our row structure, built from Carbon's Table primitives and classes rather than the render-prop `DataTable`. | **Recommended** |

## Decision (proposed: option C)
1. Install `@carbon/react`, `@carbon/icons-react`, `@ibm/plex-sans` and `@ibm/plex-mono` as runtime dependencies, and `sass` as a dev dependency. This is the only dependency change.
2. Theme:
   - The Carbon `white` theme with exactly the overrides in guideline §3.2, set through the Sass module configuration in `frontend/app/carbon.scss`. If the build rejects that, the fallback is overriding the emitted `--cds-*` properties instead.
   - App tokens that Carbon does not have go in `frontend/app/app-tokens.scss` as `--mdt-*` properties (gradient, header background).
   - `tokens.css` is removed once no rule uses it.
3. Fonts: Plex Sans and Plex Mono, served from the static build. Any `@font-face` with a remote URL is switched off and checked in the built CSS. A Playwright check opens every route and asserts that no request goes to a host other than localhost (guideline §2, §12).
4. Status mapping as in guideline §7.2. Main changes from today:
   - INFEASIBLE moves from the "negative" role to Carbon `support-caution-major` (orange) with the `Misuse` icon.
   - INPUT_INVALID uses `support-warning`.
   - Calculation failures share `support-error`, each with its own icon.

   The headline wording from Doc 7 §5 does not change.
5. Advisory content: `layer-02` background, a 1 px dashed `border-strong-01` outline, and a purple `Tag` reading "Advice" or "Sizing check · from the network".
6. Order of work, stopping for review after each step: (a) theme, fonts and global shell; (b) `/dev/components` with every state; (c) screens S-03, S-05, S-07, S-08, S-16. Each step runs typecheck, tests, E2E on Chromium and Chrome, screenshots, and the guideline §12 checklist.

## Points the owner must decide (not settled by the guidelines or the docs)
1. **Engine badge text.** Decided 2026-11-03: (b), keep "Engine: FAKE" inside the Tag. The guideline wants the `Tag` "FAKE ENGINE" / "REAL ENGINE". Two E2E tests assert that the text is exactly "Engine: FAKE". Choose one: (a) show "FAKE ENGINE" and update the two assertions, or (b) keep the text "Engine: FAKE" inside the Carbon `Tag`.
2. **Stepper.** Option C keeps links styled like `ProgressIndicator`; the real component would change navigation (see option B). Confirm.
3. **Header "About" link and the Start page "Restore autosave" card.** S-17 About and the browser autosave (Doc 7 §1 S-01, line 353) are not built. Adding them is new behaviour, not styling. Proposal: leave both out until the features exist.
4. **Logos (D8).** These wait on the visual-identity check. Proposal: no logos in this round; the cover block in the Report gets the gradient bar, the title and the meta line only.
5. **Rework.** The five screens already restyled under ADR-011 will be restyled again. Their selectors and layout stay; mostly classes and components change.

## Trade-offs and consequences
- Positive:
  - a recognised design system with tested Tabs, Modal and Toast;
  - consistent type and spacing tokens;
  - the owner's chosen identity.
- Negative:
  - five new runtime packages and one dev package, against ADR-005 "no dependency without proven need". The need here is the owner's locked decision D1, not a technical gap.
  - Carbon CSS adds weight to every page (size measured in step a).
  - Two kinds of component code exist side by side: Carbon components and our Carbon-styled ones.
- Not changed: reducer, API, data shapes, routes, labels and accessible names (except point 1 if the owner chooses (a)).

## Revisit when
- A Carbon upgrade changes token names or component markup that the tests depend on.
- A dark theme is requested (guideline D7 defers it).
- The visual-identity check allows logos.
