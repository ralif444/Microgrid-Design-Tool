# Prompt for Claude Code: example mode (guided example)

Paste everything below the line into Claude Code, started in `Microgrid-Design-Tool` on the Windows laptop.

---

Next feature: **example mode**. A guided example Project (design D2) pre-fills every analysis screen with sourced values, so a user can press Run on each step and see the whole pipeline from PS to the Report. It is presentation and workflow only: the engine, the payloads, the Project file schema, the RunRecord schema, the API and the Engine Port stay frozen.

## Environment
Same as before: Windows 11, `uv run --python 3.13 python tools\<name>.py`, no `npx` (use `frontend\node_modules\.bin\*`), long scripts written to files.

## Read first, in this order
1. `docs/EXAMPLE_MODE_PRD.md`: the whole PRD. §3 hard rules, §6 values table and §12 decisions matter most.
2. `docs/UX_ANALYTICS_GUIDELINES.md` §1 (still binding), `CLAUDE.md`, `docs/gate_log.md` (last 15 rows), Doc 9 D-64, D-70, D-71, D-72.
3. `docs/03_glossary_contracts.md` §3.7, §3.10, §6.1–6.9; `docs/13_psim_modeling.md` §4–§5; `docs/07_ui_ia.md` §2, §3; `docs/demo_script.md`.
4. The current forms: `frontend/app/{sizing,constraint-check,sensitivity,sweep,scenarios,envelope,small-signal,transient}/page.tsx` and the K149 refill on S-08.

## Working rules
- Never invent a value. A field is prefilled only if §6 marks it SOURCED, or AUTHOR and I confirmed it at EX-0. Everything else stays empty with the PRD's note.
- No result numbers in guidance text.
- Example settings never enter the canonical snapshot, the Project file or a RunRecord. Outside example mode nothing changes.
- Keep every existing accessible name, role and test id; all existing tests pass without edits.
- Ask before any design decision that is not in the docs.
- Every work package ends as before: check, tests, frontend build, E2E on Chromium and Chrome, before/after screenshots in `docs/design/ex-<step>-<date>/`, review note, gate-log row, commit and push to `tahap-1.5` with the Claude Co-Authored-By line. Then stop and wait for my confirmation.

## First step: EX-0 (documents only, no code)
Commit `docs/EXAMPLE_MODE_PRD.md` and this prompt file (`docs/PROMPT_EXAMPLE_MODE.md`). Then show me:
- the §6 values table as a checklist, one row per value, so I can confirm, replace or empty each AUTHOR value and give or refuse each NEEDS VALUE (decisions EX-D3 and EX-D4);
- my choices for EX-D1, EX-D2 and EX-D5;
- drafts of Doc 12 X9 with FR-99 – FR-104 (check the IDs are free), Doc 9 D-92, and the Doc 7 and Doc 11 changes.

Record my answers in D-92. EX-1 starts only after I confirm EX-0.
