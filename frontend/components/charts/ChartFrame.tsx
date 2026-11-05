"use client";
// Figure frame shared by every chart (Doc 12 X1, FR-86): title, the plot, a legend that names the
// dash or marker (never colour alone), a caption with analysis, RunRecord and engine kind (FAKE
// marked, CLAUDE.md), "Show data", which lists the plotted values as a table, and "Download SVG"
// (X7, FR-92: the drawn SVG with the shared caption block, UX-11).
// Inside `ReportCharts` (S-16, UX-9) the caption also gives the result hash and no crosshair is offered.
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import type { RunRecord } from "../../api-types";
import { DataTable, type DataColumn } from "../DataTable";
import styles from "./charts.module.css";
import { captionLines, downloadSvg } from "./exportSvg";

export type Cell = number | string | null;
export type ChartData = { columns: string[]; rows: Cell[][] };
export type LegendItem = { name: string; swatch: ReactNode; word?: string };
export const ReportCharts = createContext(false);

export function ChartFrame({
  title,
  record,
  legend,
  note,
  data,
  children,
}: {
  title: string;
  record?: RunRecord | null;
  legend?: LegendItem[];
  note?: string;
  data: ChartData;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const report = useContext(ReportCharts);
  const plot = useRef<HTMLDivElement>(null);
  const columns: DataColumn<Cell[]>[] = data.columns.map((header, k) => ({
    key: String(k),
    header,
    numeric: data.rows.some((r) => typeof r[k] === "number"),
    cell: (r) => r[k],
  }));
  return (
    <figure className={styles.frame}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div ref={plot} className={styles.plot}>
        {children}
      </div>
      {legend && legend.length > 1 && (
        <ul className={styles.legend} aria-label={`${title} legend`}>
          {legend.map((l) => (
            <li key={l.name}>
              {l.swatch}
              {l.name}
              {l.word && <span className={styles.word}> ({l.word})</span>}
            </li>
          ))}
        </ul>
      )}
      {note && <p className={styles.meta}>{note}</p>}
      {record && (
        <p className={styles.meta}>
          {record.analysis_type} · RunRecord {record.record_id}
          {report && <> · result hash <code>{record.result_hash}</code></>} · engine {record.engine_kind ?? "not called"}
          {record.engine_kind === "FAKE" && (
            <strong className={styles.fake}> · FAKE engine: placeholder, not an engine result</strong>
          )}
        </p>
      )}
      <button type="button" className={`no-print ${styles.toggle}`} aria-expanded={open} aria-label={`Show data: ${title}`} onClick={() => setOpen(!open)}>
        Show data
      </button>
      {record && (
        <button
          type="button"
          className={`no-print ${styles.toggle}`}
          aria-label={`Download SVG: ${title}`}
          onClick={() => {
            const svg = plot.current?.querySelector<SVGSVGElement>("svg.chart-svg");
            if (svg) downloadSvg(`${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${record.record_id}.svg`, svg, captionLines(title, record));
          }}
        >
          Download SVG
        </button>
      )}
      {open && <DataTable label={`${title} data`} columns={columns} rows={data.rows} rowKey={(_, k) => k} rowName={(r) => String(r[0])} />}
    </figure>
  );
}
