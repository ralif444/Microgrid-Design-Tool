"use client";
// Grid chart (Doc 12 X1, FR-88): rows × columns with the number printed in every cell, and a shade
// that only repeats it. Used for the S-13 participation factors (Doc 12 §8 P8): values are already
// normalised to 0–1 per mode (Eq. 4.21), so the shade follows the value (at most 45 % opacity, so
// the printed number stays legible); no engine number is derived.
// Row groups (e.g. per inverter) get a separator and a label. A null cell shows "—".
import { memo } from "react";
import type { RunRecord } from "../../api-types";
import { num } from "../format";
import { ChartFrame } from "./ChartFrame";

const CW = 64;
const CH = 22;
const LW = 96;
const TOP = 30;

export type GridRow = { label: string; group?: string; values: (number | null)[] };

export const GridChart = memo(function GridChart({
  title,
  rowTitle,
  columns,
  rows,
  note,
  record,
}: {
  title: string;
  rowTitle: string;
  columns: string[];
  rows: GridRow[];
  note?: string;
  record?: RunRecord | null;
}) {
  const w = LW + columns.length * CW + 8;
  const h = TOP + rows.length * CH + 8;
  return (
    <ChartFrame title={title} record={record} note={note} data={{ columns: [rowTitle, ...columns], rows: rows.map((r) => [r.label, ...r.values]) }}>
      <svg role="img" aria-label={`${title} grid, ${rows.length} rows by ${columns.length} columns`} viewBox={`0 0 ${w} ${h}`} style={{ width: w, minWidth: 0 }} className="chart-svg">
        {columns.map((c, j) => (
          <text key={c} x={LW + j * CW + CW / 2} y={TOP - 10} textAnchor="middle">
            {c}
          </text>
        ))}
        {rows.map((r, i) => {
          const y = TOP + i * CH;
          const first = i > 0 && r.group !== rows[i - 1].group;
          return (
            <g key={r.label}>
              {first && <line x1={4} x2={w - 4} y1={y} y2={y} className="chart-axis" />}
              <text x={LW - 6} y={y + CH / 2 + 4} textAnchor="end">
                {r.label}
              </text>
              {r.values.map((v, j) => (
                <g key={j}>
                  <rect x={LW + j * CW + 1} y={y + 1} width={CW - 2} height={CH - 2} className="chart-cell" fillOpacity={v === null ? 0 : Math.min(1, Math.max(0, v)) * 0.45} />
                  <text x={LW + j * CW + CW / 2} y={y + CH / 2 + 4} textAnchor="middle">
                    {v === null ? "—" : num(v)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
});
