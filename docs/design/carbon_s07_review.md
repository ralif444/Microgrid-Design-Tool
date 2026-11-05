# Carbon step (c): S-07 Power flow (2026-11-03)

Presentation only. All labels, accessible names and test ids are unchanged.

## Screenshots
Location: `carbon-s07-2026-11-03/{before,after}/{1440x900,1280x720}/`. "Before" is commit 3e16a97 (S-05). The states are the same as in the ADR-011 review:
- empty with readiness warnings
- empty after a run
- error: INPUT_INVALID, and a transport failure shown as a toast
- loading: the request is held
- normal: D2 FEASIBLE, as a full page and as the top of the page
- stale

## Changes
- **Readiness warnings:** shown in the INPUT_INVALID banner look, with ListBulleted in yellow-60 and text in text-primary. They used to be a yellow tint with yellow text.
- **"No problems found.":** shown with CheckmarkFilled in `support-success`.
- **Shared classes.** The banner look and the all-clear line were copied in three screen modules (S-03, S-05, S-07). They are now one global pair, `.problems` and `.all-clear`, in `globals.css`. The module copies are gone.
- **Busy Run button:** keeps its teal fill with a white spinner and a progress cursor, like Carbon InlineLoading in the button area (§6). It used to look like a disabled gray button. The button stays disabled, and its name stays "Running...".
- **Status banner, results tables, Power sharing advisory, toast and freshness Tag:** these come from the shared components restyled in step (b).

## Critique
1. **Two lists after a failed run.** When the run returns INPUT_INVALID, readiness lists the same problems as the banner. This is existing behaviour: readiness is the check before a run (Doc 7 P6), the banner is the run result. Both are kept.
2. **One primary button.** Run M1 is the primary button of the head region (§11). "Continue to the constraint check (M2)" stays a plain link at the end of the page.
3. **Toast is Carbon's high-contrast (dark) style.** The guideline names `ToastNotification` without a variant, so this is Carbon's default.

## Tests
- check passed
- engine 53, Python 441 and client 35 passed
- E2E: 30 on Chromium and 30 on Chrome
- After the busy-button CSS, the zoom, M1-slice and should-gap E2E files were re-run, since they include the "Running..." check: 8 passed.
