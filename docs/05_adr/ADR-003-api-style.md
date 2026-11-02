# ADR-003 — API style: JSON over HTTP, resource/action, OpenAPI-first

- Status: Accepted (2026-10-17); endpoint grouping DECIDED (approved by user 2026-10-17), final list in Doc 6
- Drivers: D2, D3, D5, D6; NFR-09, NFR-15, FR-17, FR-42, FR-46

## Context
The primary test seam is the HTTP API with the Fake Engine (D2). Contracts must be schema-first (D3). Execution is synchronous with no job identifiers (FR-42), and the backend is stateless (ADR-010), so every call is explicit and self-contained.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| JSON over HTTP, resource/action style, OpenAPI generated from schemas | Plain, testable with any HTTP client; OpenAPI feeds Doc 6 and TS types; fits D6 | Verbs for actions (analyses) are not strictly RESTful | **Chosen** |
| GraphQL | Flexible queries | No need: few fixed shapes; extra tooling (D5, D6) | Rejected |
| WebSocket / SSE | Push progress | No async in v1 (ADR-007) | Rejected |
| RPC over a single endpoint | One route | Weaker OpenAPI description and per-route test clarity (D2, D3) | Rejected |

## Decision
Endpoints are grouped as: `POST /api/analyses/{analysis_type}`; `POST /api/projects/validate` and `/import` (check + forward migration in one call); `POST /api/run-records/verify` and `/rerun`; `GET /api/health`; `GET /api/meta` (versions). The OpenAPI description is generated from the Pydantic schemas (ADR-001) and TypeScript types are generated from it (ADR-002). Final endpoint list belongs to Doc 6.

## Trade-offs and consequences
- Positive: one schema source for validation, documentation and types; each endpoint is directly testable at the seam.
- Negative: action-style routes are not pure REST; accepted.
- Follow-up: NFR-15 check that fails when a schema changes without the description changing.
- Follow-up: HTTP vs domain Status mapping is in ADR-006.

## Revisit when
- **Manuscript trigger (Tabel 4.11):** Asynchronous execution is adopted. Margin: not thin. Threshold values are the author's initial values, re-checked at WP 1.7.1 (aligned 2026-11-01, Doc 14 D3).
- Async execution or progress streaming is adopted (ADR-007).
- Another client (not the bundled UI) needs a different API shape.
