"use client";
// Figure frame shared by every chart (Doc 12 X1, FR-86): title, the plot, a legend that names the
// dash or marker (never colour alone), a caption with analysis, RunRecord and engine kind (FAKE
// marked, CLAUDE.md), and "Show data", which lists the plotted values as a table.
import { useState, type ReactNode } from "react";
import type { RunRecord } from "../../api-types";
import { DataTable, type DataColumn } from "../DataTable";
import styles from "./charts.module.css";

export type Cell = number | string | null;
export type ChartData = { columns: string[]; rows: Cell[][] };
export type LegendItem = { name: string; swatch: ReactNode; word?: string };

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
  const columns: DataColumn<Cell[]>[] = data.columns.map((header, k) => ({
    key: String(k),
    header,
    numeric: data.rows.some((r) => typeof r[k] === "number"),
    cell: (r) => r[k],
  }));
  return (
    <figure className={styles.frame}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.plot}>{children}</div>
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
          {record.analysis_type} · RunRecord {record.record_id} · engine {record.engine_kind ?? "not called"}
          {record.engine_kind === "FAKE" && (
            <strong className={styles.fake}> · FAKE engine: placeholder, not an engine result</strong>
          )}
        </p>
      )}
      <button type="button" className={`no-print ${styles.toggle}`} aria-expanded={open} aria-label={`Show data: ${title}`} onClick={() => setOpen(!open)}>
        Show data
      </button>
      {open && <DataTable label={`${title} data`} columns={columns} rows={data.rows} rowKey={(_, k) => k} rowName={(r) => String(r[0])} />}
    </figure>
  );
}
