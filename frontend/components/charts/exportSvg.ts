// Shared "Download SVG" exporter (Doc 12 FR-92, FR-97; SLD guideline §7, §A9): the drawn SVG with
// computed styles inlined (no class names, no external references) and the X7 caption block below
// it. Used by the single-line diagram now; the chart download (X7, UX-11) reuses it.
import type { RunRecord } from "../../api-types";
import { downloadText } from "../files";

export const FAKE_CAPTION = "FAKE ENGINE — not an engine result";
const STYLE = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "opacity", "font-family", "font-size", "font-weight", "font-variant-numeric", "text-anchor", "visibility", "display"];
const LINE = 16;
const NS = "http://www.w3.org/2000/svg";
const short = (h: string) => h.slice(0, 12);

/** Caption block of FR-92: analysis, RunRecord id, result hash, engine kind, date; plus the FAKE line. */
export function captionLines(title: string, r: RunRecord): string[] {
  return [
    title,
    `${r.analysis_type} · RunRecord ${r.record_id} · snapshot ${short(r.snapshot_hash)} · result hash ${short(r.result_hash)}`,
    `Engine ${r.engine_kind ?? "not called"}${r.engine_version ? ` ${r.engine_version}` : ""} · run ${r.created_at.slice(0, 10)}`,
    ...(r.engine_kind === "FAKE" ? [FAKE_CAPTION] : []),
  ];
}

function inline(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  dst.setAttribute("style", STYLE.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
  for (const a of ["class", "tabindex", "role", "aria-pressed", "aria-describedby"]) dst.removeAttribute(a);
  for (const p of STYLE) if (dst.getAttribute(p)?.includes("var(")) dst.removeAttribute(p); // token attribute, value now in style
  for (let k = 0; k < src.children.length; k++) inline(src.children[k], dst.children[k]);
}

/** Serialises `svg` as drawn, at its viewBox size, with the caption lines appended below. */
export function svgWithCaption(svg: SVGSVGElement, lines: string[]): string {
  // the file always carries light-theme colours (it goes on white paper); restored before any paint
  const root = document.documentElement;
  const theme = root.dataset.theme;
  delete root.dataset.theme;
  try {
    return serialise(svg, lines);
  } finally {
    if (theme) root.dataset.theme = theme;
  }
}

function serialise(svg: SVGSVGElement, lines: string[]): string {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  inline(svg, copy);
  const [x, y, w, h] = (svg.getAttribute("viewBox") ?? `0 0 ${svg.width.baseVal.value} ${svg.height.baseVal.value}`).split(/\s+/).map(Number);
  const extra = LINE * lines.length + 12;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("viewBox", `${x} ${y} ${w} ${h + extra}`);
  copy.setAttribute("width", String(w));
  copy.setAttribute("height", String(h + extra));
  const { fontFamily, color } = getComputedStyle(svg);
  const g = document.createElementNS(NS, "g");
  g.setAttribute("data-caption", "true");
  lines.forEach((t, k) => {
    const text = document.createElementNS(NS, "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(y + h + 8 + LINE * (k + 1)));
    text.setAttribute("style", `font-family:${fontFamily};font-size:12px;fill:${color}${k === 0 ? ";font-weight:600" : ""}`);
    text.textContent = t;
    g.appendChild(text);
  });
  copy.appendChild(g);
  return new XMLSerializer().serializeToString(copy);
}

export function downloadSvg(fileName: string, svg: SVGSVGElement, lines: string[]): void {
  downloadText(fileName, svgWithCaption(svg, lines), "image/svg+xml");
}
