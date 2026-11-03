# SLD-3: symbols and the /dev/sld gallery (2026-11-03)

Step SLD-3 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8, FR-94; Doc 9 D-78). No working screen changes; S-05 still shows the circle diagram until SLD-4.

## Screenshots
Location: `sld-3-2026-11-03/after/{1440x900,1280x720}/`. There is no "before": `/dev/sld` is a new route.

| File | Shows |
|---|---|
| `00-Legend` | Legend |
| `01-Design-view` | Design view |
| `02-…` | Hover/focus and selected |
| `03-…` | Checks (violated, limiting, near limit), validation issue, isolated Bus |
| `04-…` | Results overlay labels |
| `05-…` to `09-…` | The five layout fixtures |

Numbers are gallery placeholders (counting numbers), never results. The capture script also recorded every request: none left localhost.

## Changes
- **`components/sld/symbols.tsx`** draws the SVG symbols of guideline §3:
  - **Busbar.** Label stack at the left end of the bar.
  - **Grid-forming inverter.** Square with one diagonal, "=" upper-left, "~" lower-right, a stub to the bar, and a "GFM" tag.
  - **Constant-PQ load.** Line down from the bar with a filled arrowhead.
  - **Line.** Orthogonal conductor with its id on a pill.
  - **System block.** Nominal kV LL, nominal Hz, "Balanced 3-phase, islanded", and the M1 system frequency when present.
  - **`SldLegend`.** HTML legend strip.
  - Nothing that is not modelled is drawn.
- **States (guideline §5).**
  - Each symbol draws in `currentColor`: navy by default; teal (`--cds-interactive`) at 3 px on hover or focus; teal plus a `--cds-highlight` halo when selected.
  - Violated or limiting: `support-caution-major`, with the Misuse icon and the word.
  - Near limit: WarningAlt icon and "Near limit", in neutral colours like the S-08 tag.
  - Validation issue: dashed `support-error` outline, ErrorFilled icon and "Issue".
  - Isolated Bus: dashed caution outline, WarningAlt icon and lowercase "not connected", kept for the FR-14 E2E.
  - Text keeps its own colour. In print there is no teal and no halo.
- **`components/sld/SldSvg.tsx`** is the static drawing (model + layout → SVG, `role="group"`), with the test ids `diagram-bus-<id>`, `diagram-line-<id>` and `data-isolated`. SLD-4 adds interaction on top of it; the report (SLD-6) uses it as is.
- **`components/sld/useSldLayout.ts`** re-runs the layout only when the topology key changes.
- **Geometry, tuned by screenshot (D-78 K174):**
  - Bus labels sit in a left zone of 100 units above the bar. Inverter slots start after it, so a label never meets a stub.
  - The slot width is 90 instead of 70, so stacked inverter labels clear their neighbour.
  - The tiers are taller, to fit the M1 lines.
- **Bundle.** elkjs is a separate chunk of 1.45 MB minified. It is loaded only by pages that draw the SLD; today that is `/dev/sld` only.

## Critique
1. **Meshed loop:** a vertical run of LN4 crosses the LN2 label. The label pill keeps it readable, but labels do not avoid conductors. A fix would need label placement in ELK or our own collision step. I suggest leaving it unless the owner finds it a problem on real designs.
2. **Text widths are estimated** (7 px per character) for the pills. Very long names could overrun their pill or a neighbouring label.
3. **"Not connected" appears twice:** as the row caption and inside the isolated Bus. The second is required by the FR-14 test; the caption is required by guideline §4.2.
4. **Hover and selected are shown statically** through props. The live CSS states (`:hover`, `:focus-visible`) work only once SLD-4 makes the elements focusable.

## Tests
- Client:
  - `components/sld/symbols.test.ts`: every state is an icon plus a word, and an isolated Bus says lowercase "not connected".
  - Layout tests re-run after the geometry change.
- Results:
  - check passed
  - engine 53, Python 441, client 68
  - E2E 34 on Chromium and 34 on Chrome
