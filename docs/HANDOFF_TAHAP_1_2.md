# Handoff — App v1, Tahap 1.2 "Fitur utama aplikasi"

State on 2026-11-01. Repository `ralif444/Microgrid-Design-Tool`, branch `tahap-1.2` (from `tahap-1.1`). This file is the repo copy of the claude.ai Project note `claude/HANDOFF_TAHAP_1_2.md`; the repo is the source of truth.

## Status
- `tahap-1.1`: paket 0 and WP 1.1.1–1.1.6 done; exit gate 1.1 conditional PASS; PR #1 to `main` open.
- `tahap-1.2`: entry gate 1.2 recorded; Doc 07 aligned (Doc 14 D4).
- Gate results: `docs/gate_log.md`.

## User decisions (2026-11-01)
- Doc 03 contract frozen for stage 1.2 (Doc 9 D-43); changes only via ADR or register entry (G6).
- Fake profiles: default, m1-solver-failed, m1-inadmissible, m2-infeasible; add only when an E2E flow needs it, recorded in the gate log (D-44).
- Gate rules G3–G6 confirmed.
- Q-23: R > 0 stays in the app; the Tabel 4.8 oracle (R = 0) runs at engine level only (WP 1.3.1).

## Carried condition for exit 1.2
Run the E2E flows on the Windows 11 laptop with Google Chrome stable and log the version in `docs/gate_log.md`.

## Next work packages (manuscript Tabel B.1)
1. WP 1.2.1 Load entry and PS: S-01–S-04, Project store edit actions, `/api/projects/validate`, PS form (six fields).
2. WP 1.2.2 Network, constraints, M1, M2: S-05–S-08, stale-M1 flag, not-evaluated list.
3. WP 1.2.3 RunRecord, Project file, report: `/api/projects/import`, `/api/run-records/verify`, `/api/run-records/rerun`, re-run orchestrator, Project file service, S-15, S-16.
4. WP 1.2.4 Key-flow E2E F1–F3; FAKE badge and ENGINE_KIND_FAKE warning.

Exit 1.2 (Tabel 4.15): all Must pass; REPRODUCED on Fake; complete report.

## Working notes
- Commands: `python tools/check.py`, `python tools/test.py [seam]`, `python tools/gen.py [--check]`, `python tools/build_frontend.py`; start `uv run --project backend mgapp`.
- Never use `npx`; use `frontend/node_modules/.bin/*` (tools do this).
- If Node.js is not on PATH, set `MGAPP_NODE_DIR` to its bin directory.
- E2E: Python Playwright (pinned in `backend/uv.lock`); run `uv run playwright install chromium` once.
- Manuscript reference: put `Seminar.pdf` at `docs/ref/Seminar.pdf` (git-ignored).
- Each work package ends with passing tests, a commit, a push and a gate-log row.
