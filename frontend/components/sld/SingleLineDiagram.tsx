"use client";
// Interactive single-line diagram (Doc 12 X8, FR-94, FR-95, FR-98; FR-90 diagram path; guideline §6,
// §8, §9). Draws `drawing` (design only on S-05, with runs on S-07/S-08), reads tooltip rows from
// `details` (the inspector's rows, §A7). Hover opens the tooltip after 150 ms, focus at once; Escape,
// blur or leaving closes it. Enter, Space or click calls `onSelect`. Zoom: fit to view by default.
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react";
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { DataTable, type DataColumn } from "../DataTable";
import type { BreakerMark } from "../cable";
import { fmt } from "../Further";
import type { ElementRef } from "../Inspector";
import { rowText } from "../Inspector";
import type { SldElement, SldModel, SldSection } from "./buildSldModel";
import styles from "./sld.module.css";
import { SldSvg } from "./SldSvg";
import { SldLegend, type Bind, type Emph } from "./symbols";
import { useSldLayout } from "./useSldLayout";

const WORD = { system: "System", bus: "Bus", inverter: "Inverter", load: "Load", line: "Line" } as const;
const key = (e: SldElement) => `${e.kind}:${e.id}`;
const title = (e: SldElement) => (e.kind === "system" ? WORD.system : `${WORD[e.kind]} ${e.id}`);
const all = (m: SldModel) => [m.system, ...m.buses, ...m.inverters, ...m.loads, ...m.lines];
const sectionText = (s: SldSection | undefined) =>
  !s ? "—" : s.empty ? s.empty : s.rows.map((r) => `${r.label} ${rowText(r)}${r.note ? ` (${r.note})` : ""}`).join("; ") || "—";

const TABLE: DataColumn<SldElement>[] = [
  { key: "el", header: "Element", cell: (e) => <strong>{title(e)}</strong> },
  { key: "d", header: "Design data", cell: (e) => sectionText(e.sections.find((s) => s.title === "Design data")) },
  { key: "r", header: "Results", cell: (e) => (e.kind === "load" ? "—" : sectionText(e.sections.find((s) => s.title === "Results"))) },
  {
    key: "c",
    header: "Checks",
    cell: (e) => (e.kind === "load" ? "—" : [sectionText(e.sections.find((s) => s.title === "Checks")), ...e.sections.filter((s) => s.title === "Sizing check").map(sectionText)].join("; ")),
  },
  { key: "i", header: "Issues", cell: (e) => (e.issues.length ? e.issues.join("; ") : "—") },
];

function Tooltip({ el }: { el: SldElement }) {
  return (
    <>
      <p className={styles.tipHead}>
        {title(el)}
        {el.name ? ` ${el.name}` : ""}
      </p>
      {el.sections.map((s) => (
        <div key={s.title}>
          <p className={styles.tipTitle}>{s.title}</p>
          {s.empty ? (
            <p className={styles.tipEmpty}>{s.empty}</p>
          ) : (
            <ul>
              {s.rows.map((r, k) => (
                <li key={k}>
                  {r.label} · {rowText(r)}
                  {r.note && <span className={styles.tipNote}> ({r.note})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}

export function SingleLineDiagram({
  drawing,
  details,
  selected,
  onSelect,
  tools,
  breakers = [],
}: {
  drawing: SldModel;
  details: SldModel;
  selected: string | null;
  onSelect: (t: ElementRef) => void;
  /** extra toolbar controls ("Show results" on S-07 and S-08) */
  tools?: ReactNode;
  /** X10 breaker symbols after a current CB run (FR-113, D-104 K295) */
  breakers?: BreakerMark[];
}) {
  const { layout, failed } = useSldLayout(drawing);
  const [tip, setTip] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fit, setFit] = useState(1);
  const [table, setTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { refs, floatingStyles } = useFloating({ open: tip !== null, placement: "top", strategy: "fixed", middleware: [offset(8), flip(), shift({ padding: 8 })], whileElementsMounted: autoUpdate });

  const natural = layout ? layout.width + 32 : 1;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setFit(Math.min(1, el.clientWidth / natural));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const scale = zoom === "fit" ? fit : zoom;

  const byKey = new Map(all(details).map((e) => [key(e), e]));
  const show = (k: string, target: Element, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      refs.setReference(target);
      setTip(k);
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setTip(null);
  };
  const bind: Bind = (el) => {
    const k = key(el);
    const select = el.kind === "system" ? undefined : () => onSelect({ kind: el.kind as ElementRef["kind"], id: el.id });
    return {
      tabIndex: 0,
      role: select ? "button" : "img",
      "aria-label": el.label,
      "aria-pressed": select ? selected === el.id : undefined,
      "aria-describedby": tip === k ? "sld-tooltip" : undefined,
      onMouseEnter: (e) => show(k, e.currentTarget, 150),
      onMouseLeave: hide,
      onFocus: (e) => show(k, e.currentTarget, 0),
      onBlur: hide,
      onClick: select,
      onKeyDown: (e) => {
        if (e.key === "Escape") hide();
        else if (select && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          select();
        }
      },
    };
  };

  const bindBreaker = (m: BreakerMark) => {
    const k = `breaker:${m.id}`;
    return {
      tabIndex: 0,
      role: "img",
      "aria-label": `Breaker ${m.id}: ${m.cls}, I_n ${fmt(m.in_a)} A, cable ${fmt(m.size_mm2)} mm², I_Z ${fmt(m.iz_a)} A`,
      "aria-describedby": tip === k ? "sld-tooltip" : undefined,
      onMouseEnter: (e: MouseEvent<SVGGElement>) => show(k, e.currentTarget, 150),
      onMouseLeave: hide,
      onFocus: (e: FocusEvent<SVGGElement>) => show(k, e.currentTarget, 0),
      onBlur: hide,
      onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
        if (e.key === "Escape") hide();
      },
    };
  };
  const tipBreaker = breakers.find((m) => `breaker:${m.id}` === tip);

  if (drawing.buses.length === 0) return <p>No buses yet. Add a bus to start.</p>;
  if (failed) return <p>Diagram could not be drawn; the tables still work.</p>;
  const emph: Record<string, Emph> = selected ? { [selected]: "selected" } : {};
  const tipEl = tip ? byKey.get(tip) : undefined;
  const rows = all(details);
  return (
    <div className={styles.sld}>
      <div className={`no-print ${styles.toolbar}`} role="toolbar" aria-label="Diagram view">
        <button type="button" onClick={() => setZoom(Math.max(0.25, +(scale - 0.25).toFixed(2)))}>
          Zoom out
        </button>
        <button type="button" onClick={() => setZoom(Math.min(2, +(scale + 0.25).toFixed(2)))}>
          Zoom in
        </button>
        <button type="button" onClick={() => setZoom("fit")} aria-pressed={zoom === "fit"}>
          Fit to view
        </button>
        <span className={styles.zoom}>{Math.round(scale * 100)} %</span>
        {tools}
      </div>
      <div ref={box} className={styles.figure}>
        {layout ? <SldSvg model={drawing} layout={layout} emph={emph} bind={bind} scale={scale} breakers={breakers} bindBreaker={bindBreaker} /> : <p className={styles.wait}>Laying out the diagram…</p>}
      </div>
      {tipBreaker && (
        <div ref={refs.setFloating} id="sld-tooltip" role="tooltip" className={styles.tooltip} style={floatingStyles}>
          <p className={styles.tipHead}>Breaker {tipBreaker.id} (sizing result)</p>
          <ul>
            <li>Class · {tipBreaker.cls}</li>
            <li>I_n · {fmt(tipBreaker.in_a)} A</li>
            <li>Cable size · {fmt(tipBreaker.size_mm2)} mm²</li>
            <li>I_Z · {fmt(tipBreaker.iz_a)} A</li>
          </ul>
          <p className={styles.tipEmpty}>Overload sizing advice only (experimental). Details on Cable and breaker sizing.</p>
        </div>
      )}
      {tipEl && (
        <div ref={refs.setFloating} id="sld-tooltip" role="tooltip" className={styles.tooltip} style={floatingStyles}>
          <Tooltip el={tipEl} />
        </div>
      )}
      {layout && layout.unplaced.length > 0 && <p className={styles.unplaced}>Not drawn (a Bus it needs is missing, or both ends are one Bus): {layout.unplaced.join(", ")}.</p>}
      <SldLegend breakers={breakers.length > 0} />
      <button type="button" className={`no-print ${styles.tableToggle}`} aria-expanded={table} onClick={() => setTable(!table)}>
        View as table
      </button>
      {table && <DataTable label="Diagram elements" caption="Diagram elements" columns={TABLE} rows={rows} rowKey={(e) => key(e)} rowName={title} />}
    </div>
  );
}
