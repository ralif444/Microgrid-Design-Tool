# ADR-007 — Execution model: synchronous with time budget and sweep cap

- Status: Accepted (2026-10-17)
- Drivers: D5, D6; FR-42, FR-43, FR-44, FR-45, NFR-04

## Context
Local, single user (settled decisions 7, 12). Analysis durations are unknown until the real engine exists. A synchronous model keeps the API seam simple and testable with the Fake Engine.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Synchronous request/response + `TIME_BUDGET` + `SWEEP_CAP` + `TIMEOUT` | One request, one response (FR-42); no job state; trivial to test | Long analyses blocked by the budget; cap limits sweep size | **Chosen** |
| Async job queue (job id, polling or push) | Handles long runs, progress | Adds a worker, job state and endpoints; unnecessary for single user | Rejected for v1; upgrade path below |
| Background threads + polling | No external broker | Still needs job state and polling endpoint; concurrency bugs for little gain | Rejected |

## Decision
Each analysis is one synchronous call. `TIME_BUDGET` (~30 s [ASSUMPTION], to be measured) is enforced by the application service around the Engine Port call; an overrun returns UNAVAILABLE with reason TIMEOUT and still creates a RunRecord (FR-43). Sweep and envelope requests above `SWEEP_CAP` ([ASSUMPTION] value) are rejected as INPUT_INVALID / SWEEP_CAP_EXCEEDED before the engine is called (FR-44). The enforcement mechanism is an implementation detail, not designed here.

## Trade-offs and consequences
- Positive: no job infrastructure; deterministic tests with a delayed Fake Engine.
- Negative: sync call blocks a server worker during a run; acceptable for one user. Values of budget and cap are unmeasured.
- Upgrade path (future, not designed): (1) add submit/status/result endpoints returning a job id; (2) run the Engine Port call in a worker, keeping the same AnalysisRequest/AnalysisResult shape; (3) have the UI poll or stream progress, using FastAPI async features (ADR-001).

## Revisit when
- Measured real-engine runtimes regularly exceed `TIME_BUDGET`.
- The cap blocks sweeps the user legitimately needs.
