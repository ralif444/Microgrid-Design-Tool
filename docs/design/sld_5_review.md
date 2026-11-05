# SLD-5: results overlay on S-07 and S-08 (2026-11-03)

Step SLD-5 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8, FR-96; guideline §5, §A5, §A6; Doc 9 D-80).

## Screenshots
Location: `sld-5-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 on the FAKE profile `m2-infeasible`. Every number on the diagram is a Fake Engine placeholder, not an engine result. The diagram says so with its own FAKE note.

| File | Shows |
|---|---|
| `s07-not-run` | S-07 before M1: the diagram with design data and the reason "No power-flow result yet" |
| `s07-m1` | After M1: Bus p.u. and °, inverter kW and loading, line A, system Hz |
| `s08-m2` | After an INFEASIBLE M2: B1 and INV1 drawn as "Violated" (icon + word, caution colour) |
| `s07-stale` | After a design edit: the overlay is hidden, with the banner "Outdated: design changed after this run. Re-run M1." |

The "before" shots are the same flow without the diagram, because S-07 and S-08 had none.

## Changes
- **`components/sld/ResultsDiagram.tsx`** wraps `SingleLineDiagram` for S-07 and S-08.
  - **"Show results" toggle.** It sits in the diagram toolbar, is on by default and uses `aria-pressed`.
  - **When the overlay shows.** It needs the current FEASIBLE M1 (FR-93 selector, `latestRun`). On S-08 it also draws the M2 marks of the current M2: violated when `margin < 0`, limiting per Doc 12 §9 #17, and near limit through `nearLimit()`. These rules come from the SLD-1 model and are not recomputed.
  - **Without a current run.** Result labels are hidden and one reason is shown above the diagram: "No power-flow result yet", "Outdated: … Re-run M1.", or on S-08 "No current constraint check".
  - **FAKE note.** It appears whenever the overlay shows results from a FAKE run.
  - **Tooltip and Inspector.** Both read the full model, as on S-05.
- **`useSldModel`** has a third model, `m1`, with M1 labels and no M2 marks (for S-07). It also returns `has.m1` and `has.m2`.
- **`SingleLineDiagram`** accepts extra toolbar controls (`tools`).
- **S-07** shows the diagram after the KPI strip. Choosing an element opens the existing Inspector.
- **S-08** shows the diagram before "All evaluated margins". It now has the Inspector too (diagram path only).
- **The stale banner** reuses the style of the existing M1 blocked note. It is not Carbon `InlineNotification`, so it matches the other S-07 and S-08 notes.

## Critique
1. **Limiting and Violated share one mark.** The model gives each element one mark. When an element is both violated and in `limiting_constraints`, the diagram says "Violated" only, which is the stronger word. The table above still lists both.
2. **"loading 0" is a Fake placeholder.** With the real engine it shows the ratio as given. Guideline §5.1 keeps it as a ratio, not %.
3. **S-07 shows the diagram before any run as well.** It carries design data and the reason line. This adds height on a page that already has an empty state.
4. **The S-07 diagram does not highlight table rows.** M1Results has no row-highlight prop. Selection opens the Inspector only.

## Tests
- E2E in `tests/e2e/test_sld.py`:
  - **FR-96 M1:** before a run, the reason is shown. After M1, B1 shows "p.u." and the FAKE note is visible. The toggle hides and restores the labels. After an inverter edit, the "Outdated" banner is shown and the labels are hidden.
  - **FR-96 M2:** on `m2-infeasible`, the S-08 reason is shown before M2. After M2, an element shows "Violated". The diagram opens the Inspector for INV1.
- Seam 6: FR-96 is out of the exceptions; only FR-97 remains (SLD-6).
- Results:
  - check passed
  - engine 53, Python 441, client 68
  - E2E 38 on Chromium and 38 on Chrome
