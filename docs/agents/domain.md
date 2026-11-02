# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

Layout: **single-context**. This repo adapts the default layout: the glossary lives in the doc set, not in a root `CONTEXT.md`, and ADRs live in `docs/05_adr/`, not `docs/adr/`.

## Before exploring, read these

- **`docs/03_glossary_contracts.md`**: the domain glossary and data contracts (EN + Indonesian terms, entities, units, validation rules, Engine Port contract). It plays the role of `CONTEXT.md` and is the source of truth for names.
- **`docs/05_adr/`**: read ADRs that touch the area you're about to work in. Start from `docs/05_adr/README.md` (index).
- Supporting: `docs/02_prd.md` (requirement IDs FR-xx / NFR-xx / DR-xx), `docs/04_architecture.md` (layers, Engine Port), `docs/06_api.md`, `docs/07_ui_ia.md`.

If any of these files don't exist, **proceed silently**. Don't flag their absence.

## File structure

```
/
├── CLAUDE.md
├── docs/
│   ├── 01_brief.md … 11_traceability.md
│   ├── 03_glossary_contracts.md   ← glossary (CONTEXT.md role)
│   ├── 05_adr/                    ← ADR-001 … ADR-0NN, README.md index
│   └── agents/                    ← this config
└── .scratch/                      ← local issue tracker
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term exactly as defined in `docs/03_glossary_contracts.md` (e.g. Project, Bus, Line, Load, LoadProfile, Inverter, DesignConstraints, SizingAdvice, SizingCheck, Scenario, AnalysisRequest, AnalysisResult, RunRecord, Status, Engine Port, Fake Engine). Don't drift to synonyms.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Scope guardrail

The doc set contains no engine maths (no equations, solver design or accuracy claims). Any such content is "→ skripsi scope" and must not be added to these docs.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-007 (synchronous execution), but worth reopening because…_
