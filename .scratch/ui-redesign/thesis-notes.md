# Thesis notes: what the text must later cover

Status: ready-for-human

Noted 2026-11-14 at the user's request ("we will draft it later on with all of our new implementation, just note it for later"). Nothing here is drafted. Each item names where the manuscript (`Seminar.pdf`, 28-10-2026) and the app now differ, and where the decision is recorded. Values and figures for the text come from the app and the docs, never invented.

## Manuscript sections that no longer match the app

- **4.3.7 UI description.** The manuscript has an eight-step stepper on every screen and 17 routes. The app now has header area tabs (Model, Check, Studies, Report), a row of the area's screens, and an 18th route `/workspace/`, which is the landing page. Recorded as Doc 14 D15 (KONFLIK, user-decided 2026-11-14), ADR-016 option B, Doc 7 §9 amendment. The stepper's behaviour is kept elsewhere: stale-M1 blocking (FR-38, FR-40, FR-93) is shown on the Screens row (`step-6-blocked`) and in the Check area; the engine badge is unchanged.
- **Doc 14 D4** still lists 17 routes from 4.3.7; the thesis text and D4 should be updated together.

## New implementation to describe

- **Diagram workspace** (plan W4, `/workspace/`): element list, single-line diagram, inspector, results drawer. Model area edits buses, lines, inverters, loads and the design limits in the inspector, with the same fields, validation and delete rules as the tables (FR-11 bus guard, delete confirmation). New elements open in the inspector at once.
- **Check area** (plan W3/W4): CheckStrip, M2 settings, results diagram, results drawer (Margins, Power flow).
- **Catalogue entry and battery bank in the inspector** (W4c): the S-05 pick and bank forms in the inspector of their line or inverter, with a Now / Entry preview of what "Use in Project" overwrites and the bank's nominal energy (modules × module energy).
- **Studies and Report areas** (W6): the M3/M4 pages, cable sizing, battery adequacy, run history and the report under their own tabs.
- **Themes** (ADR-016 §3): light and dark, the "quiet panel" rules (grey by default, colour only for an abnormal state, status always icon plus text).
- **Language** (W5): EN/ID switch planned; groundwork in place (dictionary, `<html lang>`, decimal separator through `Intl.NumberFormat`), switch hidden until the Indonesian vocabulary is decided (`issues/01-indonesian-vocabulary.md`).
- **Narrow widths**: desktop only, but the workspace stacks so 200 % zoom (Doc 7 §8) never scrolls sideways.
- **Other features merged since the proposal** that the text must also cover: autosave/restore, example mode, sizing advice, cable and breaker sizing, battery adequacy, SLD, UX analytics. Their own guideline docs in `docs/` are the source.

## Not changed (say so in the text)

- Engine, equations, data model, assumptions A1–A6 and the out-of-scope list follow the manuscript.
- Fake Engine results stay labelled as such and are never reported as engine results.
