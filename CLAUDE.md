# Microgrid Design Web App

Local, single-user web app for early design of islanded AC microgrids with grid-forming droop inverters (steady-state and stability analysis). Source of truth: the final seminar-proposal manuscript `Seminar.pdf` (28-10-2026). Engineering doc set in `docs/`: Docs 01–11 (contracts, API, UI, architecture, tests, roadmap; Docs 02, 03, 06 aligned with the manuscript on 2026-11-01), Doc 12 (post-proposal extensions, merged at stage 1.5), Doc 13 (PSIM validation basis), Doc 14 (alignment list: what still differs from the manuscript). On any conflict the manuscript wins, except user decisions recorded in Doc 14 as KONFLIK (user-decided). For the UI, the redesign plan (`.scratch/ui-redesign/plan-workspace.md`, ADR-016 option B) wins over the manuscript, stepper removal included (Doc 14 D15).

Rules:
- The engine sits behind the Engine Port; the app never imports engine internals. Fake Engine first.
- Equations are allowed in design docs (2026-11-01); cite manuscript equation numbers instead of re-deriving.
- Never invent references, data, parameters or results; values from the manuscript or verified sources only.
- Fake Engine results are never reported as engine results.
- Assumptions A1–A6 and the out-of-scope list of the manuscript are fixed; extensions must not add equations, states or assumptions to the model (Doc 12 §1).

## Agent skills

### Issue tracker

Issues and specs are local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: glossary and contracts in `docs/03_glossary_contracts.md`, ADRs in `docs/05_adr/`. See `docs/agents/domain.md`.
