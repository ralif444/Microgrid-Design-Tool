# ADR-006 — Status and error handling: one Status enum, HTTP 200 for outcomes

- Status: Accepted (2026-10-17); HTTP mapping DECIDED (, approved by user 2026-10-17, J2)
- Drivers: D2, D3; FR-17, FR-21, FR-22, FR-35, FR-36, FR-37, FR-38, FR-43, FR-44, FR-46, NFR-06, NFR-07

## Context
Every analysis must give an unambiguous verdict that separates "bad input", "no solution", "meaningless solution", "design violates constraints" and "analysis could not run" (settled decision 10). Every request must also yield a RunRecord regardless of outcome (FR-46). The prototype exercised similar status categories (reference only).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| One six-value Status enum in the body, HTTP 200 for all analysis outcomes | RunRecord can always be returned; one model across the engine boundary; client logic is uniform | HTTP status carries less information | **Chosen** |
| Map Status to HTTP codes (422, 500, ...) | Idiomatic HTTP | Error bodies would drop the RunRecord; mixes transport and domain failures | Rejected |
| Exceptions per failure type | Familiar in Python | Crosses the Engine Port as control flow; not machine-readable for the UI | Rejected |

## Decision
Values: INPUT_INVALID, SOLVER_FAILED, PHYSICALLY_INADMISSIBLE, INFEASIBLE, FEASIBLE, UNAVAILABLE; each with a machine `status_code` and a plain-language message. M1 returns FEASIBLE ("operating point found") on success and never INFEASIBLE; the design verdict comes only from M2. SWEEP_CAP_EXCEEDED is an INPUT_INVALID code, not an UNAVAILABLE reason; TIMEOUT, DEPENDENCY_NOT_MET and ENGINE_ERROR (unexpected engine exception; never SOLVER_FAILED, which means no convergence; RunRecord still created, error logged locally) are UNAVAILABLE reasons. Any analysis outcome is HTTP 200 with AnalysisResult + RunRecord. Framework request-validation failures on analysis endpoints are converted into INPUT_INVALID results, not raw 422. HTTP 4xx only for transport problems (unparseable JSON, unknown route incl. unknown analysis_type = 404 with no RunRecord, wrong method, unrecognised upload); 5xx means an app defect. Non-analysis endpoints (Project validate/migrate, RunRecord verify) return HTTP 200 with a FileCheckResult {accepted, code, message, details[]}, which is not a Status (shape in Doc 6).

## Trade-offs and consequences
- Positive: uniform handling in UI and tests; RunRecord exists for every request.
- Negative: generic HTTP monitoring tools see only 200; a custom handler must convert validation errors.
- Follow-up: contract test asserts all six Statuses with non-empty code and message (NFR-07, FR-35).

## Revisit when
- A non-UI client needs HTTP-level failure signals.
- A seventh Status is proposed (requires a Doc 3 change).
