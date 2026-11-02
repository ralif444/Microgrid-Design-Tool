# Microgrid-Design-Tool

Local web app (App v1) for the early-stage design of islanded AC microgrids with droop-controlled grid-forming inverters. Design: `docs/` (start at `CLAUDE.md`). Single reference: the seminar-proposal manuscript.

## Requirements
- Python 3.13 and [uv](https://docs.astral.sh/uv/)
- Node.js 26.7.0 and npm (build only; not needed at runtime)
- Google Chrome (latest stable)

## Build once
```
cd backend && uv sync && cd ..
cd frontend && npm ci && cd ..
python tools/build_frontend.py
```

## Start (one command, NFR-02)
```
uv run --project backend mgapp
```
Serves the UI and the API from one process on http://127.0.0.1:8000 (loopback only, no authentication). Works offline.
Startup options (environment): `MGAPP_ENGINE=FAKE|REAL` (default FAKE; REAL from stage 1.4), `MGAPP_PORT` (default 8000), `MGAPP_FAKE_PROFILE` (test profiles: `default`, `m1-solver-failed`, `m1-inadmissible`, `m2-infeasible`, `m4a-indicators`).

## Development tasks
| Task | Command |
|---|---|
| Static checks (lint, types, import rules) | `python tools/check.py` |
| Tests per seam | `python tools/test.py [static contract api reproducibility project_file client e2e]` (e2e needs the frontend build and `playwright install chromium` once) |
| Generate OpenAPI and TS types | `python tools/gen.py` (`--check` to verify) |

If Node.js is not on `PATH`, set `MGAPP_NODE_DIR` to its `bin` directory.
