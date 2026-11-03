# ADR-013 — Single-line diagram layout and its dependencies

- Status: **Accepted**, option A and the elkjs exception approved by the user 2026-11-03 ("Setuju, pakai elkjs").
- Drivers:
  - `docs/SLD_FEATURE_GUIDELINES.md` v2 §A2, §A3, §4, §9, §12
  - Doc 2 FR-14 (diagram, Should)
  - Doc 7 §6.3, §9 #4
  - Doc 12 X8 (FR-94 – FR-98)
  - D-72 K150 (no new npm dependency in the UX round)
  - ADR-002 (static export), ADR-005 (no dependency without proven need)
  - NFR-03 (offline)
- Numbering: ADR-012 is the Carbon design system. The guideline's v1 asked for ADR-012 for this decision; v2 §A1 moves it here.

## Context
- **Today.** S-05 draws `components/NetworkDiagram.tsx`: Buses on a circle, Lines as straight segments, and an isolated Bus dashed with "not connected". It has no inverter or load symbols, no orthogonal routing and no result overlay.
- **What the SLD needs (guideline §4.2):**
  - Buses as layout nodes and Lines as edges, sorted by id.
  - Buses with an Inverter preferred in the top layer.
  - Orthogonal edge routing.
  - Inverters above and Loads below each busbar. These are placed by our own code, not by the layout engine.
  - An isolated-Bus row, and connected components side by side.
- **Determinism (R4).** The same topology must give the same picture, including when the input lists are shuffled.
- **Size target (§9).** 50 Buses and 60 Lines in under 300 ms. The four example Projects (D1, D2, D2S, D2H) have 2 to 3 Buses and 1 to 2 Lines.
- **Meshed networks.** These must lay out. Doc 3 allows any Line between any two Buses, so loops are valid designs.
- **Offline (R7, NFR-03).** No CDN, worker URL or font fetch at run time.
- **Today's bundle.** The JavaScript in `frontend/out` totals 1 629 499 bytes (measured 2026-11-03 at commit 18368db).

## Packages (checked on the npm registry 2026-11-03; nothing installed)
| Package | Version | Published | Licence | Unpacked size | Size of the file the app would bundle |
|---|---|---|---|---|---|
| `elkjs` | 0.12.0 | 2026-07-17 | EPL-2.0 OR GPL-3.0-or-later | 8 046 232 B | `lib/elk.bundled.js`: 1 609 707 B raw, 466 974 B gzip -9 |
| `elkjs` | 0.12.1 / 0.13.0 | both 2026-10-28 | same | 8 230 510 B (0.12.1) | 0.12.1 `elk.bundled.js`: 1 646 241 B raw, 477 465 B gzip -9 |
| `d3-hierarchy` | 3.1.3 | — | ISC | 104 974 B | `dist/d3-hierarchy.min.js`: 14 755 B |
| `@floating-ui/react` | 0.27.20 | already in `package-lock.json` (Carbon dependency, spec `^0.27.4`) | MIT | — | already in the bundle through Carbon |

Notes:
- The 0.12.1 and 0.13.0 releases are six days old. The proposal pins **0.12.0**, which has been out for over three months.
- Static check of `elk.bundled.js` 0.12.0: it contains no `fetch(` and no `importScripts`. It contains `new Worker` twice. That code runs only when a `workerUrl` is passed, and the bundled build runs in the main thread without one. The SLD-7 external-request guard confirms this in the browser; it is not assumed.
- The EPL-2.0 licence is file-level weak copyleft. Bundling the unmodified file in a local app is allowed. The thesis should name the licence in its tool list.

## Options considered
| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. `elkjs` layered layout** (`elk.direction=DOWN`, orthogonal routing, model-order strategy) | Handles radial and meshed networks: layered layouts break cycles before layering. Minimises crossings and routes edges around nodes. One engine for every topology. | **+1.61 MB raw / 0.47 MB gzip**, about as much JavaScript again as the whole app today. The API is async (`layout()` returns a Promise). A new runtime dependency, against D-72 K150. Determinism needs a fixed seed and sorted input; that is proven by the SLD-2 shuffled-input test, not assumed. | Recommended by the guideline. Acceptable only as an explicit exception (below). |
| B. Extend a single-row BFS order with "overpass" lanes. The repo has no such layout: today's is the circle. The idea is the prototype's `orderBusesForDiagram`, reference only. | Zero dependencies. A pure function, easy to test. | One horizontal row. Lines that skip over neighbours need lanes, which get unreadable once a Bus has more than two Lines or the network is meshed. Width grows with the Bus count, so 50 Buses do not fit the page. | Rejected for meshed networks and §9 size |
| C. `d3-hierarchy` tree layout | Small (14.8 kB). Deterministic. Synchronous. | Trees only: `stratify` rejects cycles and several roots. A meshed network needs a spanning tree plus hand-routed extra edges, which cross nodes. No orthogonal routing. | Rejected: meshed handling is a hack |
| D. Small zero-dependency layered layout of our own: BFS layers from the inverter Buses, a few barycentre sweeps to order each layer, orthogonal routing in the channel between layers, and same-layer Lines routed through a lane above the layer | No dependency. Synchronous and deterministic by construction. Sized for this tool's networks. | Crossing minimisation is heuristic only. No routing around nodes inside a layer. Long Lines that skip layers get a bend per channel. Our own code to test and maintain [ASSUMPTION: roughly 150–300 lines plus tests; not measured]. | **Fallback** if the exception is declined |

## Decision
1. **Layout: option A**, `elkjs` **0.12.0**, pinned exactly in `package.json` like every other dependency.
   - The app imports `elkjs/lib/elk.bundled.js`, so no worker file has to be served.
   - It is loaded with a dynamic `import()` inside `layoutSld.ts`, so only the screens that draw the SLD (S-05, S-07, S-08, S-16) fetch the chunk.
   - The layout options are those of guideline §4.2. Spacing is tuned by screenshot at SLD-2.
   - Input lists are sorted by id before layout, and the seed is fixed.
2. **Exception to D-72 K150.** K150 rules out a new npm dependency *for the UX round (X0–X7)*. The SLD is a separate feature (Doc 12 X8), so this exception covers only `elkjs`, only for `components/sld/`. A dependency-cruiser rule keeps every other module from importing it. Confirmed by the owner 2026-11-03 (guideline §12 point 5).
3. **`@floating-ui/react` 0.27.20 becomes a direct dependency** at the version already locked, so the SLD tooltip (FR-94) does not depend on a transitive package. No new code enters the bundle.
4. **If point 2 is declined:** option D. The limits listed above are stated in the review note of SLD-2. Option A can replace D later behind the same `layoutSld(model) → SldLayout` function.

## Consequences
- The bundle grows by about 0.47 MB gzip, but only for the four SLD screens. Other screens load nothing new.
- `layoutSld` is async. The diagram renders after the Promise resolves. The tables never wait for it. A layout failure shows Doc 7 §6.3 "Diagram could not be drawn; the tables still work."
- The test seams are unchanged:
  - Unit tests for `layoutSld` run under vitest in Node. The bundled build works there too.
  - The existing E2E `tests/e2e/test_network_diagram.py` must pass unchanged.
- The contract is unchanged (G6). Positions are computed on every render and never stored. Doc 3 §3.2 `diagram_x`/`diagram_y` stay unused.

## Revisit when
- A design over 50 Buses misses the 300 ms target.
- The owner allows drag-to-rearrange (guideline §12 point 3), which would use the stored `diagram_x`/`diagram_y`.
- elkjs needs a security or bug-fix release, or option D turns out good enough to drop the dependency.
