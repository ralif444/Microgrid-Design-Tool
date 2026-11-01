# ADR-001 — Backend: FastAPI (Python)

- Status: Accepted (2026-10-17)
- Drivers: D1, D2, D3, D5, D6, D7; NFR-15, NFR-10, NFR-02, FR-17, FR-35

## Context
The future engine will be written in Python (NumPy/SciPy ecosystem), so the backend should call it in-process (D1). The confirmed test seam is an explicit HTTP API with a Fake Engine (D2, NFR-09). Data contracts are schema-first with units and validation (D3, NFR-15). Local, single user, one start command (D5, NFR-02). The prototype already uses this stack, which lowers learning risk but is not binding (D7).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| FastAPI | Python (D1); request/response models declared as Pydantic schemas = validation at the boundary (D3); OpenAPI description generated from them (D2, D3, NFR-15); can generate frontend types | Async-first features unused in v1 | **Chosen** |
| Flask | Viable, mainstream (D6) | Validation and API description need extra libraries | Rejected (weaker on D3) |
| Django / DRF | Mature, well documented | ORM- and database-centric; unnecessary with no database (settled decision 8) | Rejected (D5) |
| Streamlit / Dash | Single language, fastest to build | No HTTP API seam (D2); see ADR-002 | Rejected here, argued in ADR-002 |

## Decision
Use FastAPI as the only backend framework. Request and response models are Pydantic schemas; the OpenAPI description is generated from them. The same process serves the static frontend build (ADR-002). Comparative claims about performance or popularity are not used in this decision [NEEDS SOURCE if added to the proposal].

## Trade-offs and consequences
- Positive: engine called in-process with no language bridge; contract and validation come from one schema source; API description feeds Doc 6 and frontend types.
- Negative: async-first features of FastAPI are unused in v1 because execution is synchronous (ADR-007). Accepted, because they are the upgrade path to a job queue.
- Negative: Pydantic validation errors must be converted to INPUT_INVALID results (ADR-006).
- Follow-up: pin framework and Pydantic versions at P0 [ASSUMPTION].

## Revisit when
- The Real Engine adapter cannot run in-process with the web server (e.g. incompatible runtime or blocking behaviour).
- Async execution is adopted (see ADR-007 upgrade path).
