# Prompt for Claude Code: automatic single-line diagram (SLD)

Use this **after UX-2 is confirmed**, in the same repo session or a new one started in `Microgrid-Design-Tool`. Paste everything below the line.

---

UX-2 is done. Before UX-3 we build the automatic single-line diagram. It replaces the circle diagram on S-05 and adds result overlays on S-07 and S-08, a figure in the report and SVG export. Like the UX round, it is presentation only: the engine, the payloads, the contract and the API stay frozen.

## Environment
Same as the UX round: Windows 11, `uv run --python 3.13 python tools\<name>.py`, no `npx` (use `frontend\node_modules\.bin\*`), long scripts written to files.

## Read first, in this order
1. `docs/SLD_FEATURE_GUIDELINES.md`, **§A first**: it lists what changed since v1 was written and wins over the rest of the file.
2. `docs/UX_ANALYTICS_GUIDELINES.md` §1 (hard rules, still binding), `docs/12_extensions.md` §3.10 (X0–X7, FR-86 – FR-93), Doc 9 D-72 and D-73, ADR-012.
3. `docs/03_glossary_contracts.md` §3 and §6.2–6.3, `docs/07_ui_ia.md` §2, §5, §6.3, `tests/e2e/test_network_diagram.py`.
4. Reference only, never copy: `docs/ref/zip-frontend-v5/components/network/` and `components/results/Inspector.tsx`.

## Working rules
- Nothing invented for display. The browser computes no physics; it uses the same selection helpers S-08 uses (`nearLimit`, violated rule, smallest normalised margin).
- `tests/e2e/test_network_diagram.py` and every other existing E2E must pass without edits (guideline §A11).
- Tooltip and inspector read the same element rows from `buildSldModel`.
- One SVG exporter, shared with X7.
- No symbol for anything the model doesn't have (breakers, transformers, grid, battery). No IEEE clause or figure numbers anywhere.
- Ask before any design decision that is not in the docs.
- Every step ends like the UX packages: check, tests, frontend build, E2E on Chromium and Chrome, before/after screenshots in `docs/design/sld-<step>-<date>/`, review note, gate-log row, commit and push to `tahap-1.5`, with the Claude Co-Authored-By line.
- Stop after each step and wait for my confirmation.

## First step: SLD-0 (documents only, no install, no code)
Commit `docs/SLD_FEATURE_GUIDELINES.md` and `docs/PROMPT_SLD.md` if they are not committed yet. Then show me drafts of:
- `docs/05_adr/ADR-013-sld-layout.md`: options A (elkjs), B (extend the BFS row layout), C (d3-hierarchy), and optionally a small zero-dependency layered layout. Include bundle size measured from the npm package, offline behaviour, determinism and meshed-network handling. State elkjs as an explicit exception to D-72 K150 and `@floating-ui/react` as a direct dependency at the locked version.
- Doc 12 X8 with FR IDs from FR-94 (check they are free), the Doc 9 D-entry, and the Doc 7 §6.3, Doc 10 and Doc 11 changes, including "UX-4 absorbed into SLD-4" and "UX-3 resumes after SLD-7".
- Answers to guideline §12 open points 2, 3, 4 and 6 if the docs settle them; points 1 and 5 are mine.

SLD-1 starts only after I confirm SLD-0.
