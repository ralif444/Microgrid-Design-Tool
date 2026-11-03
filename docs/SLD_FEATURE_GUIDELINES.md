# Feature Guideline: Automatic Single-Line Diagram (SLD)

> Paste this whole file into the Claude Code session that builds the app.
> Companion to `VISUAL_DESIGN_GUIDELINES.md` (Carbon theme). Behaviour and data names follow
> `docs/03_glossary_contracts.md` (frozen contract) and `docs/07_ui_ia.md` (S-05 diagram panel, FR-14).
> The old prototype (`docs/ref/zip-frontend-v5/components/network/NetworkDiagram.tsx`, `layout.ts`,
> `DraftTopologyPreview.tsx`, `components/results/Inspector.tsx`; gitignored) is **reference only**: reuse its ideas
> (what information is shown, "nothing invented for display"), not its field names or units.
> Written 2026-11-03. **v2 (2026-11-03): aligned with the repo at commit `39cb9e1` (UX-1 done); see §A.**

## A. Alignment with the repo (v2 changes, read first)

v1 was written for stage 1.2. Since then the Carbon theme (ADR-012) and the UX round (Doc 12 X0–X7, FR-86 – FR-93, D-72, D-73) landed. Where v1 and this section disagree, this section wins.

| # | v1 said | v2 (current repo) |
|---|---|---|
| A1 | ADR-012 for the layout choice | **ADR-013** (`docs/05_adr/ADR-013-sld-layout.md`). ADR-012 is the Carbon design system. |
| A2 | Install elkjs after the ADR | elkjs is a **new npm dependency**, which D-72 K150 rules out *for the UX round*. The SLD is a separate feature, so ADR-013 must state the exception explicitly and the user must confirm it (SLD-0). If the user declines, use option B or a small zero-dependency layered layout and say what it cannot do. |
| A3 | Add `@floating-ui/react` as a direct dependency | It is already in the lock file as a Carbon dependency (`^0.27.4`). Declaring it directly is still a dependency decision: list it in ADR-013 at the version already locked. |
| A4 | Click selects and opens the matching table row | Click (or Enter/Space) calls `onSelect(elementRef)`, which opens the **X5 inspector** (FR-90) *and* highlights the table row. The SLD replaces the circle diagram, so it delivers the diagram half of X5: **UX-4 is absorbed into SLD-4**. |
| A5 | Show results when M1 is current | Use the **FR-93 selector** (latest RunRecord of that analysis type whose `snapshot_hash` equals the current design). M1 overlay needs a current M1 with Status FEASIBLE; M2 overlay needs a current M2 in addition. No second "is it current" check. |
| A6 | M2 "limiting" from `constraint_margins` / `limiting_constraints` | `M2Payload` has **no** `limiting_constraints` (that is M3c). Use `constraint_margins` only, with the S-08 rules: violated as S-08 shows it, near limit through `nearLimit()` in `components/M2Results.tsx` with `MARGIN_WARN` from `/api/meta`, and "Limiting" = the entry with the smallest `normalised_margin` (the same selection as the S-08 "tightest constraint" KPI, X2). Import these helpers; do not re-implement them. |
| A7 | Tooltip content per §6 | The tooltip and the inspector read **the same element rows** from `buildSldModel` (one row builder), so they can never disagree. Tooltip = compact (header + key rows); inspector = full. |
| A8 | Indonesian glossary tooltips on labels | Those are the **X6 toggletips** (FR-91, UX-10). Leave a hook; do not build a second glossary. |
| A9 | `exportSvg.ts` inside `components/sld/` | Build one shared exporter used by the SLD **and** by X7 (FR-92, UX-11), with the X7 caption block (analysis, RunRecord id, result hash, engine kind, date; FAKE caption). Put it next to the chart foundation (`components/charts/`), not inside `sld/`. |
| A10 | Colours `#00737D`, `#E6F2F3`, `support-*` | `#00737D` is already the theme's `interactive` / `link-primary`. Use the tokens (`--cds-interactive`, `--cds-highlight`, `--cds-support-*`), never hex literals; the series colours of `components/charts/palette.ts` are not used in the SLD. |
| A11 | E2E FR-14 | The existing `tests/e2e/test_network_diagram.py` must pass **unchanged**: keep test ids `diagram-bus-<id>` and `diagram-line-<id>`, the `data-isolated="true|false"` attribute on the bus element, the lowercase text **"not connected"** inside an isolated bus's element (the check is case-sensitive; a caption "Not connected" elsewhere is fine in addition), and the `<summary>Diagram (read-only)</summary>` disclosure on S-05. |
| A12 | Delay no Must FR of stage 1.2 | Stage 1.2 is done. The SLD must not delay stage 1.6 (PSIM). Build order: after UX-2, before UX-3 (user decision 2026-11-03); see §11. |
| A13 | Fixtures from Fake profiles | Same, plus the example Projects D1, D2, D2S, D2H (`frontend/public/examples/`) as real layout fixtures. |
| A14 | Recording | SLD extras beyond FR-14 (tooltip, overlays, report figure, export) are recorded as **Doc 12 X8** with new FRs (FR-94 onwards; check they are free), a Doc 9 D-entry, a Doc 7 §6.3 update and Doc 11 rows. FR-14 itself stays the core requirement. |

## 0. Instructions for Claude Code

1. Read §A first, then this file, `docs/03_glossary_contracts.md` §3 and §6.2–6.3, `docs/07_ui_ia.md` §2 (S-05, S-07, S-08),
   §5, §6.3, `docs/12_extensions.md` §3.10 (X0–X7), Doc 9 D-72 and D-73, ADR-012 and `VISUAL_DESIGN_GUIDELINES.md`.
2. Confirm the SLD work does not touch the Doc 03 contract (it must not; G6). If you think a field is
   missing, stop and tell me instead of adding it.
3. Write `docs/05_adr/ADR-013-sld-layout.md` (layout engine and dependency choice, §4, §A2–A3) and show it to me before installing anything.
4. Build in the order of §11, stopping for review after each step. Every step ends with passing tests,
   Playwright screenshots, a commit and a gate-log row.
5. FR-14 is Should; the SLD extras are Doc 12 X8. Neither may delay stage 1.6.

## 1. What the feature is

An SLD that is **generated automatically** from the open Project (Buses, Lines, Loads, Inverters).
The user never draws it. It updates live whenever design data changes.

- **Where it appears:**
  - S-05 Network editor: diagram panel, design data only.
  - S-07 Power flow and S-08 Constraint check: same diagram with an optional results overlay.
  - S-16 Report: static figure.
- **Hover/focus** on any element shows a tooltip with its specifications (§6).
- **Click** selects the element. The selection syncs with the editor tables and opens the matching row (Doc 07 §6.3).
- **Read-only first** (Doc 07 §9 item 4). No drag-to-edit in v1. Positions are computed, not stored.
- **Export:** SVG download for thesis figures (Bab III/IV). Optional PNG.

Scope check: UI only. No new equations, no new states, no new assumptions. It satisfies the
extension rule.

## 2. Hard rules

| # | Rule |
|---|---|
| R1 | **Nothing invented for display.** Every number shown comes from the Project data or from a server response (M1/M2 payload, server-derived `r_ohm`/`x_ohm`). The client computes no physics: no I from P, no loading %, no R = r·len (A-20: derived totals are server-only). |
| R2 | Values are shown **in their contract unit** (kW, kvar, kVA, kV, p.u., Ω/km, km, Ω, A, Hz, Hz/kW, kV/kvar, s, deg), with the unit always visible. No hidden conversion. |
| R3 | Results are shown only when the M1 result is **current** (same snapshot hash, Status FEASIBLE). When stale, result values are hidden or greyed and labelled "Outdated: design changed after this run". This is the same stale-M1 rule as Doc 07 §3.1. |
| R4 | Layout is **deterministic**: the same topology gives the same picture (sort every input list by id before layout). Diagram positions are never part of the canonical snapshot (Doc 03 §3.2). |
| R5 | Every Bus is drawn, including isolated ones. An isolated Bus must be **visibly unconnected** (FR-14 acceptance). No element is silently dropped. |
| R6 | Status uses colour + icon + word (visual guideline §7). Brand colours never carry meaning. |
| R7 | Fully offline: any layout library is bundled locally. No CDN, no web font fetch. |
| R8 | Keyboard and screen-reader accessible (§8). |

## 3. Symbols (IEEE single-line conventions)

Draw symbols as **SVG primitives** in one module, `components/sld/symbols.tsx`. Use no image files and no
icon fonts. Stroke and text colours use Carbon tokens (`text-primary` navy for symbols, `text-secondary`
for secondary labels). Default stroke is 2 px. Sizes are in diagram units, where 1 unit = 1 px at 100 % zoom.

| Element (Doc 03) | Symbol | Geometry |
|---|---|---|
| **Bus** | Thick horizontal bar (busbar) | Height 6, width = max(140, 70 × attachments + 40); filled `text-primary`. Label (id, name if any) above the left end, Plex Sans SemiBold 13. |
| **Inverter** (grid-forming, DC/AC) | Square with one diagonal, **"="** in the upper-left triangle, **"~"** in the lower-right triangle | Square 36 × 36, diagonal bottom-left → top-right. Placed **above** its Bus (source side), connected by a vertical stub to the busbar. Small `Tag` text "GFM" right of the square (12 px). |
| **Load** (constant PQ) | Arrow pointing away from the bus | Vertical line down from the busbar, 30 long, ending in a filled triangular arrowhead (12 wide, 14 high). Placed **below** its Bus. |
| **Line** (series R–X, no shunt) | Plain conductor | Orthogonal polyline between busbars, 2 px. Line id label at the midpoint (12 px, on a `layer-01` background pill for legibility). |
| **System info block** | Text box (not a symbol) | Top-left corner: nominal voltage (kV LL), nominal frequency (Hz), "Balanced 3-phase, islanded". |

**Do not draw** circuit breakers, switches, transformers, grounding, CTs/PTs, a utility grid or a DC
source/battery. None of these are modelled (scope: no protection, one voltage level, ideal VSI per A2,
islanded). Drawing them would suggest the tool models them. If the BESS catalogue extension (Doc 12)
is implemented later, a battery symbol goes behind a separate decision.

**Standards honesty (for the thesis):** the busbar, conductor and load-arrow conventions are common
practice for single-line diagrams. Before writing "symbols follow IEEE Std 315" in the thesis, the owner
must check each symbol against IEEE Std 315 / 315A (IEEE Xplore, through the UI library). The
square-with-diagonal converter symbol is well established in IEC 60617; verify whether IEEE 315 has an
equivalent. If it doesn't, the thesis should say "IEEE 315 conventions where available, IEC 60617
for the converter symbol". Claude Code must not cite clause or figure numbers.

Add a **legend** (HTML, outside the SVG, Carbon `layer-01` strip) showing each symbol and its name.

## 4. Automatic layout

### 4.1 Approach (decide in ADR-013; see §A2)

| Option | Pros | Cons |
|---|---|---|
| **A. `elkjs` layered layout** (Eclipse Layout Kernel, JS build), direction DOWN, orthogonal edge routing | Handles radial and meshed networks, avoids crossings, routes around nodes, deterministic for sorted input, widely used, works offline | New dependency (~1–2 MB bundled JS); async API |
| B. Extend the prototype's single-row BFS ordering (`layout.ts`) with "overpass" lanes | Zero dependencies; already tested | One horizontal row; gets unreadable once a bus has more than two lines or the network is meshed |
| C. `d3-hierarchy` tree layout | Small dependency | Only trees; meshed networks need a hack |

**Recommendation: A.** Keep B's pure-function style and tests. Import `elkjs/lib/elk.bundled.js` so no
worker URL needs to be fetched.

### 4.2 Graph model given to the layout

- **Nodes = Buses only.** Width from the busbar rule in §3. Height = inverter tier above + bar + load tier
  below (reserve space for the attached symbols so they never overlap other nodes).
- **Edges = Lines** (`from_bus_id` → `to_bus_id`), sorted by id.
- **Layering hint:** Buses that have at least one Inverter are preferred in the first layer (top). The
  rest flow downward. Use ELK `layered` with `elk.direction=DOWN`, `elk.edgeRouting=ORTHOGONAL`,
  `elk.layered.considerModelOrder.strategy=NODES_AND_EDGES`, and generous spacing
  (`elk.spacing.nodeNode` ≈ 60, `elk.layered.spacing.nodeNodeBetweenLayers` ≈ 90). Tune by screenshot.
- **Attached symbols** (Inverters above, Loads below) are placed by our own code relative to their busbar,
  evenly spread along the bar, ordered by id. They are not layout nodes.
- **Isolated Buses** (no Line) are placed in a separate row at the bottom, under a muted caption
  "Not connected" and with the R6 caution treatment (dashed outline plus a `WarningAlt` icon and text).
- **Disconnected islands:** each connected component is laid out separately and the components are placed
  side by side. Show the `DISCONNECTED_NETWORK` hint if validation reports it.

### 4.3 Module boundaries

```
components/sld/
  buildSldModel.ts     // pure: Project (+ optional M1/M2 payloads) → SldModel (elements + display data). No layout.
  layoutSld.ts         // pure/async: SldModel → positioned SldLayout (calls elkjs). Deterministic.
  symbols.tsx          // pure SVG symbol components (§3)
  SingleLineDiagram.tsx// renders SldLayout; hover/focus/click; overlays
  SldTooltip.tsx       // tooltip content per element kind (§6)
  exportSvg.ts         // serialise the rendered SVG with inlined styles
```

`buildSldModel` is the **only** place that reads the store or payloads. Everything after it receives plain
data. Re-run layout only when topology or sizes change (memoise on a topology key = sorted ids of Buses,
Lines and attachments). Value-only edits (e.g. a load's kW) must not trigger a re-layout.

## 5. Visual states and overlays

| State | Treatment |
|---|---|
| Default (design data only) | Symbols in navy; labels show id plus one key value (§5.1). |
| Hover / focus | Element stroke → interactive teal (`#00737D`), 3 px; tooltip opens (§6). |
| Selected | Teal stroke 3 px plus `highlight` (`#E6F2F3`) halo behind the element; syncs with the table row. |
| Results overlay ON (M1 current) | Extra value labels from M1 (§5.1); a toggle "Show results" in the diagram toolbar (default ON on S-07/S-08, absent on S-05). |
| M1 stale | Result labels hidden. A banner above the diagram: Carbon `InlineNotification` neutral-attention "Outdated: design changed after this run. Re-run M1." |
| M2 limiting / violated element | Element stroke `support-caution-major` + `Misuse` icon next to its label + text "Violated" or "Limiting" (from `constraint_margins` / `limiting_constraints`; never computed client-side). |
| Near-limit | `WarningAlt` icon + "Near limit" text (same rule as Doc 07 §5.1, `MARGIN_WARN`). |
| Stage-1 validation issue on an element | Dashed `support-error` outline + `ErrorFilled` icon; tooltip lists the issue messages (Doc 03 §4 messages). |
| Isolated Bus | Separate "Not connected" row (§4.2). |

### 5.1 Always-visible labels (keep the drawing uncluttered; details go in the tooltip)

| Element | Design view | With current M1 results |
|---|---|---|
| Bus | id | + `voltage_pu` p.u., `angle_deg` ° |
| Inverter | id, `rated_kva` kVA | + `p_kw` kW, `loading_ratio` (as ratio, e.g. "0.82"; show % only if the visual guideline adopts it globally) |
| Load | id, `p_kw` kW + entered reactive spec (`q_kvar` kvar **or** `power_factor` + LAG/LEAD, exactly as entered) | (no change; loads are inputs) |
| Line | id | + `current_a` A |
| System block | kV LL, Hz | + `system_frequency_hz` Hz |

Numbers use `tabular-nums` and the app's single formatting helper (same significant-figure rule as the tables).

## 6. Tooltip content (hover and keyboard focus)

Implementation: a single `SldTooltip` overlay (HTML, not SVG) positioned at the hovered element's
bounding box. Use `@floating-ui/react` (Carbon already depends on it). Add it as a **direct** dependency
if imported directly, and record it in ADR-012. Style it like a Carbon popover: `layer-01`, Carbon
shadow, 12–14 px Plex Sans, max width 320 px. It opens on hover after 150 ms and on focus immediately,
and closes on mouse-leave, blur or Escape. On touch, tap selects and shows the tooltip.

Layout of every tooltip: **header** (kind + id + name) → **Design data** section → **Results** section
(only when M1 is current; otherwise one line "No current power-flow result") → **Checks** section (M2,
only when current) → optional **Issues** section (validation). Every row is `label · value unit`.
A missing optional value shows "—" with a reason (e.g. "not set"), never 0.

| Element | Design data (Doc 03 fields) | Results (M1 payload §6.2) | Checks (M2 payload §6.3) |
|---|---|---|---|
| **Bus** | id, name, attached: n inverters, n loads, n lines | `voltage_kv` kV, `voltage_pu` p.u., `angle_deg` ° | bus-voltage margins for this bus (`constraint_margins` where `element_id` = bus), or "not evaluated" if listed in `not_evaluated` |
| **Inverter** | bus, `rated_kva`, `frequency_droop_hz_per_kw` Hz/kW, `voltage_droop_kv_per_kvar` kV/kvar, `frequency_setpoint_hz`, `voltage_setpoint_kv`, `p_setpoint_kw` (absent → "0 (not set)" per Doc 03 note), `q_setpoint_kvar`, `tau_p_s`, `tau_q_s` (absent → "not set, needed for stability analyses"); catalogue reference if present (Doc 12 extension, later) | `p_kw`, `q_kvar`, `s_kva`, `loading_ratio` | loading margin; SizingCheck row: `s_kva`, `required_rating_kva`, `headroom_kva`, "Rating margin short" warning if flagged (advisory style, visual guideline §8) |
| **Line** | from → to, `r_ohm_per_km`, `x_ohm_per_km`, `length_km`, server-derived `r_ohm`, `x_ohm` (only if the server has returned them; else omit), `current_limit_a` or "project limit: `line_current_limit_a` A" or "no limit set" | `p_from_kw`, `q_from_kvar`, `p_to_kw`, `q_to_kvar`, `current_a`, `losses_kw` | line-current margin; SizingCheck `required_current_a` |
| **Load** | bus, `p_kw`, and **either** `q_kvar` **or** `power_factor` + `pf_direction` exactly as entered | — | — |
| **System block** | `nominal_voltage_kv`, `nominal_frequency_hz` | `system_frequency_hz`, `total_load_kw`, `total_load_kvar`, `total_losses_kw`, `epsilon_x_ratio` (validity indicator, labelled) | frequency margins; verdict |

Indonesian glossary tooltips (visual guideline/Doc 07 §8) may sit on the labels via the existing glossary.

## 7. Report and export

- **S-16 Report:** include the SLD as a static figure, "Single-line diagram of the analysed design". Use the
  same renderer with interaction disabled and the results overlay as of the reported M1 RunRecord. Add a
  caption line with the RunRecord id and short snapshot hash (traceability).
- **Print:** white background, navy/black strokes, no teal hover states, grayscale-readable. Font size
  ≥ 8 pt in print (thesis diagram rule). Scale the SVG to the page width. If it's too wide, split
  into parts rather than shrinking below 8 pt.
- **Export SVG:** a toolbar button "Download SVG". It serialises the current SVG with inlined computed
  styles and embedded font-family names, with no external references. Optional "Download PNG" via an
  offscreen canvas at 2× scale.

## 8. Accessibility

- The SVG has `role="group"` and `aria-label="Single-line diagram"`. Each element `<g>` is focusable
  (`tabIndex=0`), with `role="button"` and a full `aria-label`, e.g. "Inverter INV1 at bus B1, rated 50 kVA".
- Tab order: system block → buses in layout order → each bus's inverters → loads → lines.
  Enter/Space selects. Escape closes the tooltip.
- A **"View as table"** toggle below the diagram lists every element with the same fields as the tooltips.
  It's the text alternative, and it also helps testing.
- Contrast: label text ≥ 4.5:1 on the diagram background (`layer-01` white).

## 9. Performance

Target: 50 Buses / 60 Lines lays out in < 300 ms and stays responsive on the reference laptop.
Debounce re-layout by 150 ms after topology edits. Zoom and pan with mouse wheel + drag (or +/−/fit buttons).
"Fit to view" is the default. Pan/zoom state is UI-local, not saved.

## 10. Tests

| Level | What |
|---|---|
| Unit (`buildSldModel`) | Every Bus/Line/Load/Inverter appears once; values copied verbatim with units; no derived physics; results absent when M1 missing or stale; reactive spec of a Load kept as entered. |
| Unit (`layoutSld`) | Deterministic (same input → identical coordinates, also when input lists are shuffled); no two node boxes overlap; every edge has a route; isolated Bus placed in the "Not connected" row; meshed fixture (a loop) lays out without errors. |
| Component | Hover and focus open the tooltip with the exact fields of §6; Escape closes it; click selects and syncs the table; stale banner hides results; violated element shows icon + word. |
| E2E (FR-14) | Each Bus and Line drawn; an isolated Bus visibly unconnected; screenshot at 1440×900. |
| Visual | Playwright screenshots of the fixtures: radial 3-bus, 2 inverters on one bus, meshed 4-bus loop, isolated bus, 20-bus radial. Review against §3 and §5 before showing me. |

Fixtures: use the Fake Engine profiles (default, m2-infeasible) for overlays. Add fixtures only for
layout tests (Project data only). Adding a Fake profile needs a gate-log entry (D-44).

## 11. Build order (v2: inserted after UX-2, before UX-3)

| Step | Content |
|---|---|
| SLD-0 | Docs only: ADR-013 (elkjs exception to D-72 K150, `@floating-ui/react` direct), Doc 12 X8 + FRs, Doc 9 D-entry, Doc 7 §6.3, Doc 11, Doc 10 note on the order. **User confirms before SLD-1.** |
| SLD-1 | `buildSldModel` + unit tests (no UI), including the shared element rows (§A7). |
| SLD-2 | `layoutSld` (elkjs or the confirmed alternative) + unit tests; fixtures D1, D2, D2S, D2H, meshed 4-bus loop, isolated bus, 20-bus radial. |
| SLD-3 | `symbols.tsx` + `/dev/sld` gallery with every symbol and state of §5. |
| SLD-4 | `SingleLineDiagram` on S-05 replacing `components/NetworkDiagram.tsx`: tooltip, `onSelect` → X5 inspector + table row, legend, "View as table". Absorbs UX-4; FR-90 E2E for the diagram path. |
| SLD-5 | M1 and M2 overlays on S-07 and S-08 with the stale banner (§A5, §A6). |
| SLD-6 | Shared SVG exporter (§A9), report figure, print CSS. |
| SLD-7 | E2E FR-14 (old test unchanged) + new X8 tests, accessibility pass, 200 % zoom, external-request guard, screenshot review. Then resume UX-3. |

## 12. Open points for the owner

| # | Item | Default if not answered |
|---|---|---|
| 1 | Verify symbols against IEEE Std 315 / 315A; decide the thesis wording. | Thesis says "single-line diagram conventions"; no IEEE claim until checked. |
| 2 | Loading shown as ratio or %. | Ratio, as in the contract. |
| 3 | Drag-to-rearrange with saved `diagram_x/diagram_y` (fields exist in Doc 03 §3.2). | Not in v1. |
| 4 | Battery symbol for the BESS catalogue extension. | Not drawn until that extension is built. |
| 5 | elkjs as an exception to "no new npm dependency" (D-72 K150), recorded in ADR-013. | Ask at SLD-0; recommended: allow, scoped to the SLD. |
| 6 | PNG export. | Not built; SVG only. |
