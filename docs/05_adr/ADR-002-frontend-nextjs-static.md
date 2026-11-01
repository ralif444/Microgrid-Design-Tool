# ADR-002 — Frontend: Next.js (React + TypeScript), static export only

- Status: Accepted (2026-10-17)
- Drivers: D2, D3, D4, D5, D6, D7; FR-14, FR-45, FR-58, NFR-02, NFR-03, NFR-15

## Context
The UI needs an interactive network editor and a multi-step pipeline with state kept across steps (D4). Frontend and backend must not silently disagree on contracts (D3). Locally the app must run as one process with one command (D5, NFR-02) and work offline (NFR-03). A reference prototype exists in this stack (D7), not binding.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Next.js, static export | React components suit editor and multi-screen pipeline (D4); TS types generated from OpenAPI (D3); file-based routing maps to the screen inventory (Doc 7); prototype familiarity (D7) | "Overkill" objection; two languages and toolchains for a solo developer | **Chosen**, with constraints below |
| Streamlit / Dash | Strongest simpler alternative: fastest to build, no JavaScript. **Better fit for a throwaway demo** | Script re-runs per interaction, awkward for multi-step state and editable diagram (D4); UI and logic in one process, no HTTP seam and no Engine Port separation (D2); implicit data contract (D3) | Rejected (D4, D2, D3) |
| Vite + React SPA | Technically equivalent to static-export Next.js, slightly simpler | Same two-toolchain cost | Rejected on D7 (prototype conventions reusable as reference) and file-based routing only. **Weak margin.** |
| Server templates + htmx (Django/Jinja) | One language | Weaker for rich client-side diagram editing (D4) | Rejected |
| Electron / PyQt | Native feel | Contradicts the web-based product definition; packaging weight (D5) | Rejected |

## Decision
Next.js with static export only. No server-side rendering, no Next.js API routes, no server actions. The build output is static files served by the FastAPI process (ADR-001), so locally there is one process and one command. All logic stays behind the single HTTP API seam (ADR-003).

## Trade-offs and consequences
- Positive: generated types keep contracts aligned; one served build; offline-capable.
- Negative: two languages and two toolchains for one developer; mitigated by generated types and a single served build.
- Negative: Next.js features beyond static export go unused; Vite would be lighter.
- Follow-up: CI check that the build uses export mode and contains no API routes (Doc 8).

## Revisit when
- Static-export constraints block a required feature, or the Vite margin becomes decisive (e.g. prototype conventions turn out not to be reused).
- A hosted or multi-user deployment is ever requested.
