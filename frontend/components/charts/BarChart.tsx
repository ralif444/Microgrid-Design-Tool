"use client";
// Horizontal bar chart from zero with optional reference lines (Doc 12 X1, FR-86). A null value
// gets no bar and the label "—" (guideline §1 rule 5); the value label sits at the bar end.
import { memo, useMemo } from "react";
import type { RunRecord } from "../../api-types";
import { num } from "../format";
import { ChartFrame } from "./ChartFrame";
import { SERIES } from "./palette";
import { linearScale, niceTicks } from "./scale";

const W = 560;
const BAR = 22;
const GAP = 10;
const M = { l: 72, r: 56, t: 22, b: 44 };

export type Bar = { label: string; value: number | null };
export type RefLine = { value: number; label: string };

export const BarChart = memo(function BarChart({
  title,
  valueTitle,
  categoryTitle,
  bars,
  refs = [],
  note,
  record,
}: {
  title: string;
  valueTitle: string; // with unit, e.g. "Bus voltage (p.u.)"
  categoryTitle: string;
  bars: Bar[];
  refs?: RefLine[];
  note?: string;
  record?: RunRecord | null;
}) {
  const h = M.t + bars.length * (BAR + GAP) + M.b;
  const g = useMemo(() => {
    const max = Math.max(0, ...bars.map((b) => b.value ?? 0), ...refs.map((r) => r.value));
    const ticks = niceTicks([0, max || 1]);
    const top = Math.max(max || 1, ticks[ticks.length - 1]);
    return { sx: linearScale([0, top], [M.l, W - M.r]), ticks };
  }, [bars, refs]);
  return (
    <ChartFrame title={title} record={record} note={note} data={{ columns: [categoryTitle, valueTitle], rows: bars.map((b) => [b.label, b.value]) }}>
      <svg role="img" aria-label={`${valueTitle} bar chart, ${bars.length} bars`} viewBox={`0 0 ${W} ${h}`} className="chart-svg">
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={g.sx(t)} x2={g.sx(t)} y1={M.t} y2={h - M.b} className="chart-grid" />
            <text x={g.sx(t)} y={h - M.b + 16} textAnchor="middle">
              {num(t)}
            </text>
          </g>
        ))}
        {bars.map((b, k) => {
          const y = M.t + k * (BAR + GAP);
          return (
            <g key={b.label}>
              <text x={M.l - 6} y={y + BAR * 0.7} textAnchor="end">
                {b.label}
              </text>
              {b.value !== null && <rect x={M.l} y={y} width={g.sx(b.value) - M.l} height={BAR} fill={SERIES[0]} />}
              <text x={(b.value === null ? M.l : g.sx(b.value)) + 4} y={y + BAR * 0.7}>
                {b.value === null ? "—" : num(b.value)}
              </text>
            </g>
          );
        })}
        <line x1={M.l} x2={M.l} y1={M.t} y2={h - M.b} className="chart-axis" />
        {refs.map((r) => (
          <g key={r.label}>
            <line x1={g.sx(r.value)} x2={g.sx(r.value)} y1={M.t} y2={h - M.b} className="chart-ref" />
            <text x={g.sx(r.value)} y={14} textAnchor="middle">
              {r.label}
            </text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={h - 2} textAnchor="middle">
          {valueTitle}
        </text>
      </svg>
    </ChartFrame>
  );
});
