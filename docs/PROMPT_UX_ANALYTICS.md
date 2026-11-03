# Prompt for Claude Code: UX and analytics round (U0–U7)

Paste everything below the line into Claude Code, started in the repo folder `Microgrid-Design-Tool` on the Windows laptop.

---

We are adding a UX and analytics round to App v1: KPI cards, an inspector panel, glossary tooltips, analytics charts on every M1–M4 screen and a hover/keyboard crosshair. It is presentation only. The engine, the payloads, the contract and the API stay frozen.

## Environment
Windows 11. `python` on PATH is ETAP's Python 3.8, so do not use it. Run tools with `uv run --python 3.13 python tools\<name>.py`. Do not use `npx`; use `frontend\node_modules\.bin\*`. Write long scripts to files instead of long heredocs.

## Read first, in this order
1. `docs/UX_ANALYTICS_GUIDELINES.md`: this round's guideline, with the user's decisions Q1–Q7, hard rules, the extension list U0–U7, the per-screen KPI and chart tables, and the work packages UX-0 to UX-12.
2. `CLAUDE.md`, `docs/HANDOFF_UI_DESIGN_SYSTEM.md` (§3.5 lessons, §4 status), `docs/05_adr/ADR-012-carbon-design-system.md`, `docs/gate_log.md` (last 15 rows).
3. `docs/03_glossary_contracts.md` §6 (payloads), `docs/07_ui_ia.md`, `docs/12_extensions.md` §1 (admission rule), `docs/09_register.md` (last D and K numbers).
4. Reference only, never copy: `docs/ref/zip-frontend-v5/` (old prototype frontend; see the guideline §11 for which files matter).
5. If `VISUAL_DESIGN_GUIDELINES.md` is not in the repo, ask me to paste it before UX-2.

## Working rules
- The rules in the guideline §1 are binding. Above all: the browser never computes an engine number; it only selects, counts, sorts, filters and rounds for display.
- Keep every existing accessible name, role and test id. The current E2E tests must pass without edits.
- Ask before any design decision that is not in the docs. Never invent values, definitions or references. Glossary text comes from Doc 3 or the manuscript only.
- FAKE results stay marked on every KPI, chart and inspector.
- Contract or store-behaviour changes only through a Doc 9 entry (rule G6).
- Every work package ends with: `tools\check.py`, `tools\test.py`, `tools\build_frontend.py`, E2E on Chromium and on Chrome, before/after screenshots, a review note, one gate-log row, then commit and push to `tahap-1.5`. End commit messages with the Claude Co-Authored-By line.
- Stop after each work package and wait for my confirmation before the next.

## First step
Commit `docs/HANDOFF_UI_DESIGN_SYSTEM.md`, `docs/UX_ANALYTICS_GUIDELINES.md` and this prompt file (`docs/PROMPT_UX_ANALYTICS.md`), and make sure `docs/ref/` stays ignored. Then run the full check and test suite once to confirm a green baseline.

## Then start with UX-0
Before writing anything, show me a short plan:
- the Doc 12 entries U0–U7 with the FR IDs you will use (check that FR-86 to FR-93 are free);
- the Doc 9 D-entry text;
- the Doc 7 and Doc 11 changes;
- the open points from guideline §12 that you could answer from the docs, and the ones that need me. Point 1 (U0: read the latest matching RunRecord vs new reducer state) is mine to decide; the guideline recommends reading the RunRecord.

UX-1 starts only after I confirm UX-0.
