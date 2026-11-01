# ADR-005 — Frontend state: React built-in store (Context + reducer)

- Status: Accepted, approved by user 2026-10-17 (derived from orchestrator decision J7)
- Drivers: D4, D5, D6, D7; FR-08, FR-10, FR-30, FR-45, FR-55

## Context
The open Project and its RunRecords are held client-side (ADR-010) and must survive navigation across pipeline screens (D4). The server is stateless and every call is explicit, so there is nothing to cache or synchronise from the server. Screens also have local UI state (form drafts, selection, in-progress flag).

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| React built-in (Context + reducer), one Project store + per-screen local state | Zero extra dependency (D5, D6); the prototype used no state library (dependencies: next, react, zod) | Hand-written patterns; re-render care as Project grows | **Recommended** |
| Small store library (e.g. Zustand) | Less boilerplate, selective subscriptions | One more dependency; benefit unproven at this scale [NEEDS SOURCE for any comparative claim] | Close alternative |
| Server-state cache library (e.g. TanStack Query) | Caching, retries | Server holds no state; calls are explicit; little to cache | Rejected |

## Decision
One client-side Project store is the single source of truth for the open Project and its RunRecords, built on React Context + reducer, plus per-screen local state. No server-state cache library. **The margin between built-in and a small store library is weak**; built-in is recommended only for dependency minimalism.

## Trade-offs and consequences
- Positive: no new dependency; state shape mirrors the Project schema (Doc 3).
- Negative: possible re-render cost and boilerplate if the Project grows; undo/redo not provided.
- Follow-up: keep store access behind a small interface so a library can be swapped in without touching screens [ASSUMPTION].

## Revisit when
- Network-editor interaction shows performance problems or reducer code becomes hard to maintain.
- Undo/redo or multi-tab editing becomes a requirement.
