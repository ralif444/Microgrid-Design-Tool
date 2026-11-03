# Carbon step (b) review: shared components and `/dev/components` (2026-11-03)

Second step of ADR-012 option C, covering guideline §6–§8. Presentation only: no reducer, API or
data-shape change. Every accessible name and test id used by the E2E suite is unchanged.

## Screenshots
Location: `carbon-b-2026-11-03/{1440x900,1280x720}/`.
- `gallery-full.png`: the full gallery.
- One `sec-*.png` per section:
  - status mapping
  - tags
  - banners
  - advisory
  - buttons
  - toast
  - stepper
  - data table

The gallery holds each state side by side:
- normal
- empty
- error: every failure Status, the row error, the field error and the toast
- loading: the busy button

## Changes
- **Status roles** (`tokens.css`), rebuilt on guideline §7.2. Every role has four parts:
  - `edge`: the §7.2 token
  - `icon`: at least 3:1 on white
  - `fg`: Carbon 70 step, at least 7:1
  - `bg`: Carbon 10 step

  All values come from `@carbon/colors` 11. The old `-border` names stay as aliases until step (c).

  INFEASIBLE moves from red to orange (`support-caution-major`). INPUT_INVALID moves to `support-warning`. The calculation failures share `support-error` and are told apart by icon.
- **Icons:** `Icon` keeps its API and now renders `@carbon/icons-react`. The §7.2 icons:

  | Status | Icon |
  |---|---|
  | FEASIBLE | CheckmarkFilled |
  | INFEASIBLE | Misuse |
  | SOLVER_FAILED | ErrorFilled |
  | PHYSICALLY_INADMISSIBLE | WarningHex |
  | ENGINE_ERROR | Tools |
  | INPUT_INVALID | ListBulleted |
  | TIMEOUT | Time |
  | DEPENDENCY_NOT_MET | Link |
  | NOT_APPLICABLE | Information |

  All of them exist in the installed version, so none was substituted. Other icons in use:
  - Near limit: WarningAlt
  - Blocked: Locked
  - Not run yet: CircleDash
- **StatusBanner:** styled like an InlineNotification:
  - `layer-01` background
  - 3 px left edge in the role colour
  - 20 px icon in the role colour
  - word and text in text-primary

  Error rows keep a double edge so they still differ in grayscale print.
- **AdvisoryPanel:** 1 px dashed `border-strong-01` outline on `layer-02`, with a purple Carbon Tag. The tag reads "Advice" by default and "Sizing check · from the network" on the M2 Sizing check (§8).
- **Tags:**
  - M1 freshness: green "current", warm-gray "stale", cool-gray "not run yet".
  - Near limit: warm-gray with WarningAlt (§7.3).
  - Stepper flags: "Stale" (warm-gray) and "Blocked" (cool-gray), per §7.4.
  - Tags with an icon use size `md`, because Carbon's `sm` Tag does not draw the icon.
- **Toast:** Carbon `ToastNotification` (kind error, role alert), with the shadow removed (§11).
- **Empty state:** 32 px icon, solid border on layer-01. It was dashed, but dashed now means advisory (§8).
- **Native buttons:** look like Carbon buttons. The default is tertiary (teal outline); submit and `.primary` are primary teal. Field and row errors use the error role.
- **Theme fix:** `theme.theme()` emitted Carbon white's Button component tokens (blue) after the map values, so primary buttons turned blue. The three `button-primary*` tokens are now set again from the same theme map, with no new value.

## Found and fixed while reviewing
- **Hydration risk.** A Carbon Tag renders a `<div>`. Inside a `<p>` (the advisory head, two gallery rows) that is invalid nesting, which breaks hydration of the static export. These containers are now `<div>`s. No hydration error appears in the console.
- **Icon colour.** Carbon icons use `fill="currentColor"`, so their colour is set with `color`, not `fill` inheritance. Status words keep text-primary; only the icon carries the role colour. The word alone would fail 4.5:1 for success and info.
- **Contrast** (WCAG 2.x formula). On white, the colours used as icons are:

  | Colour | Contrast |
  |---|---|
  | success #24A148 | 3.35:1 |
  | error #DA1E28 | 5.0:1 |
  | info blue #0043CE | 7.8:1 |
  | orange-60 | 5.0:1 |
  | yellow-60 | 5.0:1 |
  | border-strong-01 | 3.3:1 |

  The text colours use the 70 step and measure 7.7–7.9:1. The INFEASIBLE and INPUT_INVALID edges stay below 3:1. They are decorative; the icon and the word carry the meaning (ADR-012, deviation 1).

## Not changed here (step c or later)
- The screens still carry their own role-tinted boxes (fake note, hints, the Report verdict). They follow the new role values but not yet the banner layout.
- The 3 px orange left edge on violated rows of the M2 table (§7.3) needs a row-class hook in DataTable. It belongs with S-08.
- The stepper wraps into two rows at 1280 px with uneven step widths. Carbon's `spaceEqually` behaviour is not reproduced.
- Run history `TableToolbar`, `Modal`, `Tabs` and `NumberInput` come in with their screens.
- **Not caused by this change** (the Next version and the routes are unchanged; not re-checked on an older build): Next 16 prefetches `<route>/__next.<route>.__PAGE__.txt`, but the static export writes `<route>/__next.<route>/__PAGE__.txt`. That makes 16 prefetch 404s per page, while navigation still works. It was seen in the gallery console and is worth its own fix.
