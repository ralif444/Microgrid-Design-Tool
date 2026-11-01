# ADR-008 — Engine boundary: Engine Port + Fake Engine first + shared contract suite

- Status: Accepted (2026-10-17)
- Drivers: D1, D2, D3; NFR-07, NFR-08, NFR-10, NFR-11, NFR-14, FR-21, FR-35, DR-07

## Context
The calculation engine is a black box built after the proposal. The app must be built and tested before it exists, and the real engine must plug in without app changes. The engine boundary is one operation: AnalysisRequest -> AnalysisResult (Doc 3).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Engine Port (interface) + Fake Engine first + same contract suite for both adapters | Whole app testable now at the API seam; swap-safety is tested, not hoped for; engine internals never imported (NFR-10) | Fake Engine and port upkeep; canned results can hide integration problems | **Chosen** |
| Direct engine calls from services | Least code | App cannot be tested before engine exists; tight coupling | Rejected |
| Mocking at function level in tests | Quick | Tests tied to internals, not external behaviour; no shared contract | Rejected |

## Decision
Services depend on an Engine Port interface; adapters (Fake Engine, later Real Engine adapter) depend on the port, never the reverse. The Fake Engine is deterministic and can return every one of the six Statuses on demand. Both adapters must pass one Engine Port contract suite. Unit conversion for the engine is the Real Engine adapter's job. Engine selection is by startup configuration (FAKE | REAL), not per request; the Real Engine adapter is absent in v1 builds until P2.

## Trade-offs and consequences
- Positive: UI and API are developed against stable canned behaviour; engine maths is out of the web app's test scope.
- Negative: the Fake Engine proves the contract, not engine correctness (validated separately, offline M5).
- Negative: RunRecords made with the Fake Engine must not be mistaken for real results (`engine_kind` field in Doc 3).
- Follow-up: contract suite is written at P0 and becomes the P2 entry gate.

## Revisit when
- The real engine cannot be expressed through the single AnalysisRequest/AnalysisResult shape.
- Contract suite passes but integration at P2 reveals gaps in canned coverage.
