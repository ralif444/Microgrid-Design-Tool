# ADR-010 — Stateless backend; Project held client-side

- Status: Accepted, approved by user 2026-10-17 (orchestrator decision J1)
- Drivers: D2, D5, D6; NFR-09, NFR-12, NFR-16, FR-38, FR-46, FR-48, FR-50, FR-54, FR-55

## Context
No database in v1 (ADR-004). The backend must be testable at the API seam (D2) and restart-safe on a student laptop (D5). The dependency rule needs a valid M1 operating point (status FEASIBLE and snapshot hash equal to the current design, FR-38).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Stateless backend; open Project and RunRecords held in the browser; each request self-contained | Testable at the seam; restart-safe; matches no-DB; no server cleanup | Larger request bodies; browser must hold the data | **Chosen** |
| Server-side in-memory session store | Small requests | Lost on restart; hidden state complicates tests | Rejected |
| Server-side file workspace | Survives restart | Server writes to disk; path and cleanup concerns; against file export/import model | Rejected |

## Decision
The open Project (with its RunRecords) lives in the browser. Every analysis request carries: project snapshot, analysis_type, parameters, solver_config, and for dependent analyses for dependent analyses (M2, M3a-d, M4a-b) a `depends_on` reference to the M1 RunRecord: record_id, analysis_type, snapshot_hash, status, result_hash and result_payload (the operating point). The dependent RunRecord stores `depends_on` in its input, so re-running it is self-contained. Every RunRecord stores `result_hash` (SHA-256 of its canonical result). The service accepts the dependency only if status is FEASIBLE, snapshot_hash equals the current snapshot hash, and result_hash matches result_payload; otherwise UNAVAILABLE / DEPENDENCY_NOT_MET. Persistence = user exports and imports Project JSON and RunRecord files; the server writes nothing to disk in v1. Browser autosave (localStorage) is a convenience only [ASSUMPTION].

## Trade-offs and consequences
- Positive: any request is replayable; server restart loses nothing; no session management.
- Negative: request size grows with Project size; a closed tab without export loses work (mitigated by autosave and export prompts).
- Caveat: result_hash is tamper-evidence for a local single user, not security; a user can edit payload and hash together.
- Follow-up: none; Doc 3 §5.1 and §7 define `depends_on` and `result_hash`.

## Revisit when
- Request payloads become too large or slow.
- Multi-user or hosted use is introduced.
