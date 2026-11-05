# SLD-2: single-line diagram layout (2026-11-03)

Step SLD-2 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8, FR-94; ADR-013; Doc 9 D-77).

No screen draws the SLD yet. "Before" is therefore not applicable, and the app bundle is unchanged (1 629 499 bytes of JavaScript): `elkjs` is only imported by `components/sld/layoutSld.ts`, which no page uses yet. The pictures in `sld-2-2026-11-03/` are layout sketches, not app screenshots. The test helper draws the computed boxes, bars, routes and attachment points with placeholder shapes. The real symbols follow in SLD-3.

## Changes
- `elkjs` **0.12.0** is installed with an exact pin.
  - `package-lock.json` gains only `node_modules/elkjs`.
  - A dependency-cruiser rule, `elkjs-only-in-sld`, rejects any import of elkjs from outside `components/sld/`. This was checked with a throw-away file and the rule reported the violation.
- `components/sld/layoutSld.ts`, `layoutSld(model) → SldLayout`, is async. elkjs is loaded on first use with a dynamic `import()`.
  - Nodes are the Buses. Box width is max(140, 70 × (max(inverters, loads) + lines) + 40). Height is the inverter tier, the bar and the load tier.
  - Lines are oriented away from the nearest inverter Bus (BFS hops). Buses are given to ELK in model order: sources first, then by distance, then by id. With the fixed seed, this puts inverter Buses on top.
  - Each Line end moves from the box border onto its busbar, and every segment stays orthogonal.
  - Inverters (above) and Loads (below) take evenly spread slots on the bar. The slot nearest each Line attachment is dropped, on both sides of the bar. That keeps a stub from lining up with a conductor.
  - Isolated Buses sit in a "Not connected" row under the graph.
  - Elements that cannot be placed go to `unplaced`, so the renderer can list them and none is silently dropped. These are Lines to a missing Bus or both ends on one Bus, and Inverters or Loads on a missing Bus.
- `components/sld/fixtures.ts` holds topology-only fixtures: radial 3-bus, 2 inverters on one bus, meshed 4-bus loop, isolated bus, 20-bus radial, and a 50-bus / 60-line generator. They have no numeric values, because the layout reads none.

## Tuning by screenshot
1. **D2, first run:** LN1 left B1 at the inverter's x, so the stub and the conductor read as one wire. Fixed by treating Line attachments on both sides of the bar as obstacles.
2. **20-bus radial:** one column, about 3 900 px tall.
   - I tried ELK's `wrapping.strategy: MULTI_EDGE`. It folded the radial into columns, but it also routed every small graph through long loops over the top, and the isolated-bus test failed. I reverted it.
   - Long feeders are left to the fit-to-view and zoom of SLD-4 (guideline §9).

## Critique
1. **Meshed loop:** LN2 and LN4 cross and run in parallel 14 px apart, with labels close together. That is legible but tight. Label placement and collision handling belong to SLD-3 and SLD-4.
2. **Tall radials:** a 20-bus feeder needs fit-to-view (SLD-4). The report figure (SLD-6) may have to be split, as guideline §7 allows.
3. **Attachment width:** the box-width rule counts Lines as attachments. The guideline says "70 × attachments + 40" without defining "attachments". I read it as every item that needs a slot on the bar (D-77 K170).

## Tests
- Client: `components/sld/layoutSld.test.ts`, 14 tests:
  - For D1, D2, D2S, D2H and the five fixtures: no overlapping boxes; every Line routed; each end on one of its busbars; every segment orthogonal; every Inverter and Load placed.
  - Identical coordinates for shuffled input.
  - Inverter Bus above, and the isolated row with its caption.
  - Unplaced elements listed.
  - Slot spreading.
  - 50 Buses / 60 Lines in under 300 ms: 122 ms warm, in Node on the reference laptop.
- Results:
  - check passed
  - engine 53, Python 441, client 66
  - E2E 34 on Chromium and 34 on Chrome
