# ADR-004 — Storage: versioned Project JSON file, no database

- Status: Accepted (2026-10-17)
- Drivers: D5, D6; NFR-12, NFR-16, NFR-01, FR-54, FR-55, FR-56, FR-57, FR-49, FR-50

## Context
Single user, single machine, no authentication (settled decisions 7, 12). Reproducibility depends on files that can be exported, attached to a thesis and re-imported (NFR-01). A Project must be portable between machines (NFR-12). Persistence is performed by the user through the browser, not by the server (ADR-010).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Versioned JSON file (Project; RunRecord as separate file) | Portable, human-inspectable, matches file-based reproducibility; no extra component (D5) | No querying; whole file loaded | **Chosen** |
| SQLite | Mature, queryable | Single user plus file-based reproducibility makes a database unnecessary weight; needs export step anyway | Rejected |
| Browser-only storage as the system of record | Zero export friction | Lives in one browser, can be cleared, not portable, not attachable | Rejected as record; allowed as autosave convenience [ASSUMPTION] |

## Decision
A Project is one JSON document with `schema_version`, holding the network, Loads, LoadProfile, DesignConstraints, Scenarios, accepted SizingAdvice and the RunRecord list (FR-54). A RunRecord is also exportable as a single file (FR-49). Migrations are forward-only (FR-56); an unmigratable or newer-than-supported file is rejected with a clear message and nothing is overwritten (FR-57, NFR-16).

## Trade-offs and consequences
- Positive: no database to install, migrate or back up; files are the unit of reproducibility.
- Negative: large RunRecord lists enlarge the Project file; no concurrent-edit protection (single user).
- Negative: forward-only migration means old app versions cannot open new files.
- Follow-up: keep migration fixtures per version (FR-56 tests).

## Revisit when
- Multi-user, hosted deployment, or Project files become too large to handle in the browser.
- Cross-project queries over RunRecords become a requirement.
