# SLD-6: shared SVG exporter and the report figure (2026-11-03)

Step SLD-6 of `docs/SLD_FEATURE_GUIDELINES.md` §11 (Doc 12 X8, FR-97; guideline §7, §A9; Doc 9 D-81).

## Screenshots
Location: `sld-6-2026-11-03/{before,after}/{1440x900,1280x720}/`. The example is D2 after M1 and M2 on the FAKE engine. Every number is a Fake Engine placeholder.

| File | Shows |
|---|---|
| `report` | S-16 on screen; after: the figure under "4 Design summary" |
| `report-print` | The same page with print media emulated (viewport width, not A4) |
| `after/single-line-diagram.svg` | The file "Download SVG" produced, kept as evidence |
| `after/single-line-diagram-svg.png` | That SVG opened on its own in Chromium: drawing plus the caption block |

## Changes
- **`components/charts/exportSvg.ts`** is the shared exporter of guideline A9. It sits next to the charts, because chart download (X7, UX-11) will reuse it.
  - **Captions.** `captionLines(title, record)` builds the X7 caption block: analysis, RunRecord id, short snapshot hash, short result hash, engine kind and version, and run date. A FAKE run adds the line "FAKE ENGINE — not an engine result".
  - **Serialising.** `svgWithCaption` copies the drawn SVG and inlines its computed styles. It drops classes, `tabindex` and `role`, sets `xmlns`, and appends the caption as DOM `<text>` elements.
  - **Downloading.** `downloadSvg` saves the result through the new `downloadText` helper in `files.ts`. `downloadJson` now uses the same helper.
- **`components/sld/SldFigure.tsx`** is the report figure "Single-line diagram of the analysed design".
  - **What it draws.** It draws the reported M1 RunRecord's own `snapshot`, not the current design, with that run's overlay. The overlay is shown only when the run is FEASIBLE.
  - **No interaction.** It has no tooltip and no selection.
  - **Caption.** RunRecord id, short snapshot hash, engine kind, and the FAKE line when the run is FAKE.
  - **Legend and download.** The legend and "Download SVG" sit under the figure.
- **Print.** A drawing wider than 720 layout units prints as overlapping parts, each at most 720 wide (`printParts`), each with "Part k of n". At A4 text width (643 px) that keeps 12 px text at 8 pt or more. A narrower drawing prints whole at `max-width: 100%`.
- **`SldSvg`** takes a `clip` x range for the print parts.
- **S-16.** The figure sits at the end of "4 Design summary", after the "outdated" note when the run no longer matches the design.

## Critique
1. **The split path is tested only by a client test.** No screenshot shows a design wide enough to split, and the print check uses media emulation, not a real A4 PDF. A cut can pass through a label at the part edge; the 40-unit overlap reduces this but does not prevent it.
2. **Height is not split.** A very long radial design can run past one page.
3. **The report figure shows no M2 marks.** FR-97 asks for the M1 overlay only, and the limiting constraints are already in section 2.
4. **Download PNG** (optional in guideline §7) is not built.
5. **Exported font.** The exported SVG names IBM Plex Sans but does not embed the font file. Another machine falls back to `system-ui` or Arial, which the font stack already lists.

## Tests
- Client: `components/charts/exportSvg.test.ts`.
  - The caption names the analysis, RunRecord, hashes, engine and date.
  - A FAKE run adds the FAKE line.
  - `printParts` keeps a narrow drawing whole, and splits a wide one into overlapping parts of 720.
- E2E: `test_fr_97_report_figure_and_svg_download`.
  - The figure has M1 labels, and its caption names the RunRecord id and FAKE ENGINE.
  - The downloaded SVG is well-formed XML with `xmlns`. It contains the RunRecord id, "Engine FAKE" and the FAKE caption, and no `class=` or `var(--`.
- Fixed during the step: the first caption was built as an escaped string, and the quotes in the font name broke the attribute. It now uses DOM elements.
- Seam 6: FR-97 has left the exceptions. The SLD round has no FR exceptions left.
- Results:
  - check passed
  - engine 53, Python 441, client 70
  - E2E 39 on Chromium and 39 on Chrome
