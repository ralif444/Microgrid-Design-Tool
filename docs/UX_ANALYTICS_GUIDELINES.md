# UX and analytics guideline: KPI cards, inspector, glossary, charts, crosshair

> Standalone guideline for Claude Code (status 2026-11-03). Companion to `VISUAL_DESIGN_GUIDELINES.md` (Carbon look, ADR-012) and the doc set in `docs/`. Source of truth stays `Seminar.pdf`. This guideline adds **presentation only**: no engine, contract, payload or API change.

## Ringkasan

Pedoman ini membawa lima gagasan antarmuka dari prototipe frontend lama (`microgrid-frontend-v5-restyled.zip`) ke aplikasi saat ini: kartu KPI di atas setiap hasil, panel inspektur untuk Bus, Line, dan Inverter, tooltip glosarium, grafik analitik pada setiap layar M1–M4, dan *crosshair* yang menampilkan nilai persis saat kursor diarahkan. Gagasannya dibangun ulang di atas komponen Carbon dan payload RunRecord yang sudah ada; kode prototipe tidak disalin. Stepper delapan langkah tetap dipakai. Setiap angka dan grafik hanya boleh berasal dari payload yang sudah dikembalikan mesin, sehingga asumsi A1–A6 dan aturan Doc 12 §1 tidak berubah. Pekerjaan dicatat sebagai ekstensi Doc 12 (U1–U7) dan satu entri Doc 9.

## 0. Decisions behind this guideline (user, 2026-11-03)

| # | Decision |
|---|---|
| Q1 | Take from the prototype: KPI cards, inspector panel, glossary tooltips, more charts, hover crosshair. Not taken: sidebar navigation, undo/redo. |
| Q2 | Keep the 8-step pipeline stepper (Doc 7 §3, manuscript 4.3.7). No sidebar. |
| Q3 | Rebuild the ideas on the current Carbon components and RunRecord payloads. Reuse only the prototype's chart *math* (scale, nice ticks, nearest-sample snap). Never copy its components, types or mappers. |
| Q4 | Charts are hand-written inline SVG. No chart library (no `@carbon/charts`, no d3). No new npm dependency. |
| Q5 | Only data the engine already returns. Anything needing new engine output is out (or goes to Doc 12 as a separate extension). |
| Q6 | Implement now, before stage 1.6. Fold the Carbon step (c) restyle of S-09 to S-14 into the same work packages so no screen is restyled twice. |
| Q7 | Record as Doc 12 extensions (U1–U7, new FR IDs) plus one Doc 9 D-entry. No new ADR. |

## 1. Hard rules

1. **No engine number is computed in the browser.** The frontend may *select* (min, max, argmin, argmax), *count*, *sort*, *filter* and *round for display* (`num`, 6 significant digits). It may not add, multiply or convert physical quantities, and may not derive damping, margins, ratios, loadability or anything else that is an engine output. If a KPI needs arithmetic, it is out of scope.
2. **Payloads, contract and API are frozen.** No field is added to Doc 3 §6 payloads, no endpoint changes, the Engine Port is untouched. If an idea needs a field that does not exist, stop and record it as an open point.
3. **Fake results stay marked.** Every KPI strip, chart caption and inspector panel fed by a FAKE RunRecord carries the existing "Engine: FAKE" marking. A Fake chart must never look like an engine result (CLAUDE.md rule).
4. **Status is never colour alone.** Colour + icon + word (ADR-012 §7.2). Chart series use a categorical palette that never reuses the status support colours. Series are also told apart by marker shape or dash pattern.
5. **Missing is not zero.** A `null` value is drawn as a gap (line) or hollow marker (point) and listed as "—" with the payload `reason` where one exists. Never interpolate across a missing point.
6. **Accessible names are the test contract.** Existing roles, labels and test ids stay exactly the same; the 31 current E2E tests must keep passing unchanged. New elements get their own unique names (watch for substring collisions with `exact=True`, see the S-08 "Sizing check" lesson).
7. **Offline, static export, no remote requests.** The external-request guard E2E covers every new screen.
8. **Out-of-scope terms stay out.** No glossary entry, label or chart for anything on the manuscript's out-of-scope list (GFL, PLL, VSM, virtual impedance, secondary control, unbalance, harmonics, short circuit, protection, …).
9. **Leave the validity-indicator table alone.** FR-62 forbids classes or styles inside it, and an E2E checks that.

## 2. Extensions (proposed Doc 12 entries)

IDs and FR numbers are proposals; Claude Code checks they are free before recording them.

| ID | Name | Priority | FR (proposed) | Screens |
|---|---|---|---|---|
| U1 | Shared chart foundation (scales, axes, crosshair, data-table toggle, gallery) | Should | FR-86 | all chart screens, `/dev/components` |
| U2 | KPI strip per result | Should | FR-87 | S-07, S-08, S-10, S-12, S-13, S-14 |
| U3 | Analytics charts per analysis | Should | FR-88 | S-07, S-08, S-09, S-10, S-11, S-12, S-13, S-14, S-16 |
| U4 | Hover and keyboard crosshair with exact values | Should | FR-89 | every line or point chart |
| U5 | Inspector panel for Bus, Line, Inverter | Should | FR-90 | S-05, S-07, S-08 |
| U6 | Glossary tooltips (and the glossary on S-17 if built) | Could | FR-91 | all screens |
| U7 | Download a chart as SVG with caption metadata (thesis figures) | Could | FR-92 | chart screens, S-16 |
| U0 | Prerequisite: latest result per analysis survives leaving a screen | Should | FR-93 | store, all result screens |

**U0 needs a decision** (audit #4, HANDOFF_UI_DESIGN_SYSTEM §5 item 2). Recommended: each result screen and the inspector read the *latest RunRecord of that analysis type whose snapshot hash matches the current design* (the same way the Report already works); no new reducer state for results. This is a store-behaviour change, so it gets the Doc 9 D-entry, not just a gate-log row. Ask the user to confirm before coding U0.

## 3. Shared chart foundation (U1, U4)

Folder `frontend/components/charts/`:

| File | Content |
|---|---|
| `scale.ts` | `linearScale`, `niceDomain`, `niceTicks`, `nearestIndex`, `splitAtNulls` (pure; client-tested). Port the logic of the prototype's `svgScale.ts` (see `docs/ref/zip-frontend-v5/`), rewritten in this repo's style. |
| `ChartFrame.tsx` | `<figure>` with title, axis titles **with units**, tick labels (rounded with `num`), legend, caption line (analysis, RunRecord id, engine kind, FAKE tag), and a "Show data" toggle that renders the same values as a `DataTable`. |
| `Crosshair.tsx` | Pointer + keyboard crosshair (U4): snaps to the nearest *real* sample (never an interpolated value), tooltip lists every series at that x with units. Chart is focusable; ←/→ move, Home/End jump, Escape hides. Hidden in print. |
| `palette.ts` | 6 categorical series colours from the Carbon palette, validated against the status colours (no reuse), plus marker shapes and dash patterns. |
| `LineChart.tsx`, `BarChart.tsx` (horizontal, with reference lines), `ScatterChart.tsx`, `GridChart.tsx` (heatmap / status grid with the number or status word in every cell) | Generic, memoised (`React.memo` + `useMemo` around scales). |

Rules for every chart: `role="img"` with an `aria-label` that states what is plotted and the count of points; minimum printed font 8 pt; responsive width with horizontal scroll under 640 px; no animation; print renders static SVG without the crosshair. Replace the current `SweepChart`, `TimeChart`, `VoltageChart` with the generic ones, keeping their accessible names.

Add every chart and state (normal, empty, gaps, FAKE, print) to the `/dev/components` gallery.

## 4. KPI strip (U2)

A row of Carbon-style tiles directly under the page head and StatusBanner. Each tile has a label, value with unit (`num`), and an optional status (icon + word). Values are read straight from the payload; the only operations allowed are those in §1 rule 1.

| Screen | Tiles (payload source) |
|---|---|
| S-07 M1 | System frequency (`system_frequency_hz`); lowest bus voltage p.u. and its bus (min over `bus_results.voltage_pu`); highest bus voltage p.u.; highest inverter loading and its inverter (max over `inverter_results.loading_ratio`); total load (`total_load_kw`, `total_load_kvar`); total losses (`total_losses_kw`); iterations; ε_X (`epsilon_x_ratio`, labelled as an indicator, "threshold not yet calibrated") |
| S-08 M2 | Verdict (status word + icon); violated constraints (count of `constraint_margins` with `margin < 0`); tightest constraint (min `normalised_margin`, with kind and element); not evaluated (count of `not_evaluated`); λ_c; λ_s labelled "solution existence, not a stability limit" (both with `resolution`) |
| S-10 M3b | Points (count); first infeasible value (`first_infeasible_value`, "—" if none); points per Status (counts) |
| S-12 M3d | Feasible fraction (`feasible_fraction`); points; points per Status |
| S-13 M4a | Stability class (word + icon); ζ_min (`zeta_min`); damping check (`damping_pass`, only if a threshold was given); dominant mode frequency (`dominant_modes[0].frequency_hz`); outside definition (`outside_definition`) |
| S-14 M4b | Transient class (word, or "not classified" when `null` with `class_reason`); settled; max RoCoF (`max_rocof_hz_per_s`, labelled descriptive) |

Note that "total generation" from the prototype is **not** a tile: it is not in `M1Payload` and computing it would break rule 1.

## 5. Charts per screen (U3)

| Screen | Chart | Data | Notes |
|---|---|---|---|
| S-07 M1 | Bus voltage profile (horizontal bars or dots, p.u.) | `bus_results.voltage_pu` | Voltage band lines only if DesignConstraints has a voltage band; otherwise a caption "No voltage limit set: not evaluated". |
| S-07 M1 | Inverter loading (bars, ratio) | `inverter_results.loading_ratio` | Reference line at the inverter loading limit if set. |
| S-07 M1 | Power sharing (paired bars P/Q per inverter, kW/kvar) | `inverter_results.p_kw`, `q_kvar`; deviation from `sharing` | Shown as Advice treatment, like the current sharing table. |
| S-07 M1 | Line loading (bars, A, with losses in the tooltip) | `line_results.current_a`, `losses_kw` | Reference line at the line current limit if set. |
| S-08 M2 | Margin chart (diverging bars of `normalised_margin`, sorted, zero line, violated side marked) | `constraint_margins` | Not-evaluated items listed below the chart, never drawn as bars. |
| S-08 M2 | Loadability axis (load scale λ with markers λ_c, λ_s, λ_ub and the resolution as a band) | `loadability` | Show `stop_reason` in the caption. |
| S-09 M3a | Tornado chart per output metric (bars of `normalised_value`, ranked) | `sensitivities`, `ranking` | `null` values listed as "not reported" with `reason`; `status_change` flagged with icon + word. |
| S-10 M3b | Line chart of a chosen key metric vs the axis value, marker shape by Status, gaps at `null`; marker on `first_infeasible_value` | `points[].value`, `key_metrics`, `status` | Metric picker over the `KeyMetrics` fields that have data; ζ_min trace when points carry `eigenvalues`. Crosshair. |
| S-11 M3c | Grouped bars per metric across scenarios; delta table beside it | `scenario_results[].key_metrics`, `deltas` | N−1 runs use the same chart. |
| S-12 M3d | Status grid (x by y) with the status word or symbol in every cell | `grid[].x_value`, `y_value`, `status`, `limiting_constraint` | Hover/focus shows the limiting constraint of that point. |
| S-13 M4a | Eigenvalue plot (Re in 1/s vs Im in rad/s), dominant modes highlighted by shape | `eigenvalues`, `modes`, `dominant_modes` | Tooltip: ζ and f from `modes` via `eigenvalue_index`. No damping-threshold ray (it would need geometry from Eq. 4.20 in the browser). |
| S-13 M4a | Participation factor grid (states × modes, value printed in each cell) | `participation` | Check the matrix orientation in Doc 3 §6.8 before drawing. Hidden with a note when `participation` is `null`. |
| S-14 M4b | Time responses: frequency, bus voltage per bus, P and Q per inverter | `time_s` and the series | Vertical marker at the disturbance start time taken from the RunRecord request parameters (check the field name). Envelope band only if the run had settling criteria. Crosshair. |
| S-16 Report | Static versions of the S-07, S-08 and run-specific charts | the RunRecords the report already reads | Print-safe, no crosshair, caption with RunRecord id and result hash. |

## 6. Inspector (U5)

A Carbon-style side panel (not a modal) that opens when the user selects a Bus, Line or Inverter in a table row or in the network diagram, and closes with Escape or its close button. Focus moves into it on open and back to the trigger on close.

Content, top to bottom: identity (id, type, catalogue reference if any); **inputs** from the Project snapshot; **latest M1 values** for that element (from U0; hidden with "No current power flow for this design" when there is no matching RunRecord); **M2 rows** whose `element_id` matches (margin, limit, status); **sizing check** row if any; a link "Edit in table" that uses the existing `?focus=` behaviour.

The current `NetworkDiagram` (circle layout) gets an `onSelect(elementRef)` callback and keyboard-operable nodes. The planned IEEE single-line diagram is a separate work item; it must call the same `onSelect`, so the inspector does not change when the diagram is replaced.

## 7. Glossary tooltips (U6)

- Data file `frontend/components/glossary.ts`: `{ term, short, source }`, where `source` names the Doc 3 glossary entry or manuscript section. **Definitions come from Doc 3 or the manuscript only.** The prototype's `lib/glossary.ts` may be used to pick *which* terms deserve a tooltip, not for its wording; it contains out-of-scope entries (grid-following, virtual impedance) that must not be carried over.
- Component: a small "?" button next to a label (Carbon Toggletip pattern), keyboard focusable, opens on click/Enter, closes on Escape or outside click; never on hover only.
- Attach to table headers and KPI labels for: p.u., kW, kvar, kVA, droop gains m_p and n_q, grid-forming, loading ratio, margin and normalised margin, λ_c, λ_s, ε_X, r_τ, κ, r_in, eigenvalue, damping ratio, participation factor, RoCoF, transient class, Status names.
- If a term has no Doc 3 or manuscript definition, leave it out and list it as an open point. Do not write a definition.

## 8. Thesis figure export (U7, Could)

A "Download SVG" action on each chart: the same SVG with a caption block (analysis, RunRecord id, result hash, engine kind, date) and fonts that stay ≥ 8 pt at A4 text width. FAKE charts are exported with a visible "FAKE ENGINE — not an engine result" caption. This is the route for BAB IV figures (KAIDAH_diagram rules apply).

## 9. Work packages and order

Continue on branch `tahap-1.5` (as the Carbon steps did) unless the user says otherwise. Each WP: show a short plan first and list the decisions needed; then implement; run `tools/check.py`, `tools/test.py` (engine, Python, client), `tools/build_frontend.py`, E2E on Chromium and Chrome; take before/after screenshots at 1440×900 and 1280×720 in `docs/design/ux-<screen>-<date>/`; write `docs/design/ux_<screen>_review.md`; add one row to `docs/gate_log.md`; commit and push.

| WP | Content |
|---|---|
| UX-0 | Docs: Doc 12 entries U0–U7 with FRs, Doc 9 D-entry (decisions Q1–Q7 and the U0 choice), Doc 7 additions (KPI strip, inspector, chart list per screen), Doc 11 traceability rows. No code. **User confirms before UX-1.** |
| UX-1 | U0 latest-result read (store) with tests, then U1 chart foundation + gallery; client tests for `scale.ts`, `splitAtNulls`, KPI selectors. Replace the three old charts keeping accessible names. |
| UX-2 | S-07: KPI strip, four charts, inspector hook from tables |
| UX-3 | S-08: KPI strip, margin chart, loadability axis |
| UX-4 | S-05: inspector panel + diagram `onSelect` |
| UX-5 | S-13 (Carbon restyle + KPI + eigenvalue plot + participation grid) |
| UX-6 | S-14 (Carbon restyle + KPI + time responses with crosshair) |
| UX-7 | S-10 and S-12 (Carbon restyle + KPI + sweep chart + status grid) |
| UX-8 | S-09 and S-11 (Carbon restyle + tornado + scenario bars) |
| UX-9 | S-16 report charts and print check (PDF inspected visually) |
| UX-10 | U6 glossary tooltips across screens |
| UX-11 | U7 SVG download (Could; skip if time is short) |
| UX-12 | Regression: full E2E on Chromium and Chrome, 200 % zoom over all screens, contrast check of the chart palette, external-request guard; gate-log summary |

## 10. Tests to add

- Client: `scale.ts` (ticks, domain, nearest index, null splitting); KPI selector functions per screen (including empty and `null` cases); tornado sorting; glossary entries all have a `source`.
- E2E: each new figure is present with its accessible name and its "Show data" table holds the same row count as the payload; crosshair moves with arrow keys and shows a value with unit; inspector opens from a table row and from the diagram, traps focus, closes with Escape, and hides M1 values when the design is stale; a FAKE run shows the FAKE caption on every chart; glossary toggletip opens with Enter and closes with Escape; print layout of S-16 keeps charts within 718 px.
- Unchanged: all existing E2E selectors and the FR-62 indicator-table test.

## 11. Reference material

- Prototype frontend (reference only, not to be copied): `docs/ref/zip-frontend-v5/` (gitignored). Most relevant: `components/charts/svgScale.ts`, `ChartAxes.tsx`, `TimeSeriesChart.tsx`, `SweepChart.tsx`, `EigenvaluePlot.tsx`, `EnvelopeHeatmap.tsx`, `components/results/Inspector.tsx`, `DesignKpis.tsx`, `components/common/InfoTooltip.tsx`, `lib/glossary.ts`, `docs/README.md` ("UI/UX overhaul pass" section).
- Look and feel: `VISUAL_DESIGN_GUIDELINES.md` (if not in the repo, ask the user to paste it), ADR-012, `docs/design/carbon_*_review.md`.
- Lessons already learned: `docs/HANDOFF_UI_DESIGN_SYSTEM.md` §3.5.

## 12. Open points

| # | Item | Owner |
|---|---|---|
| 1 | U0 read-from-RunRecord vs new reducer state | user, at UX-0 |
| 2 | Participation matrix orientation (states × modes or modes × states) | check Doc 3 §6.8 / engine |
| 3 | Field name of the disturbance start time in the M4b request | check Doc 3 / Doc 6 |
| 4 | Glossary terms with no Doc 3 or manuscript definition | list at UX-10 |
| 5 | Whether S-17 About (with glossary) is built in this round | user |
