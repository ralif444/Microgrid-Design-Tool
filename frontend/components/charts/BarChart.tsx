"use client";
// Horizontal bar chart (Doc 12 X1, FR-86): bars from zero, to either side, one bar per series in
// each category; or dots on a data-fitted axis (`dots`), for values far from zero such as p.u.
// voltages. A null value gets no bar and the label "—" (guideline §1 rule 5). Reference lines
// mark user-set limits.
import { memo, useMemo } from "react";
import type { RunRecord } from "../../api-types";
import { num } from "../format";
import { ChartFrame } from "./ChartFrame";
import { MarkerShape, Swatch } from "./marks";
import { SERIES } from "./palette";
import { linearScale, niceDomain, niceTicks } from "./scale";

const W = 560;
const BAR = 20;
const GAP = 12;
const M = { l: 72, r: 64, t: 22, b: 44 };

export type BarSeries = { name: string; values: (number | null)[] };
export type RefLine = { value: number; label: string };

export const BarChart = memo(function BarChart({
  title,
  valueTitle,
  categoryTitle,
  categories,
  series,
  refs = [],
  dots = false,
  note,
  record,
}: {
  title: string;
  valueTitle: string; // with unit, e.g. "Bus voltage (p.u.)"
  categoryTitle: string;
  categories: string[];
  series: BarSeries[];
  refs?: RefLine[];
  dots?: boolean;
  note?: string;
  record?: RunRecord | null;
}) {
  const band = dots ? BAR : BAR * series.length;
  const h = M.t + categories.length * (band + GAP) + M.b;
  const g = useMemo(() => {
    const vals = [...series.flatMap((s) => s.values), ...refs.map((r) => r.value)];
    const fin = vals.filter((v): v is number => v !== null);
    const raw: [number, number] = dots ? niceDomain(vals) : [Math.min(0, ...fin), Math.max(0, ...fin)];
    const d: [number, number] = raw[0] === raw[1] ? [raw[0], raw[0] + 1] : raw;
    const ticks = niceTicks(d);
    const dom: [number, number] = [Math.min(d[0], ticks[0]), Math.max(d[1], ticks[ticks.length - 1])];
    return { sx: linearScale(dom, [M.l, W - M.r]), ticks, zero: dots ? null : 0 };
  }, [series, refs, dots]);
  const multi = series.length > 1;
  return (
    <ChartFrame
      title={title}
      record={record}
      note={note}
      legend={series.map((s, k) => ({ name: s.name, swatch: <Swatch color={SERIES[k % SERIES.length]} dash={dots ? undefined : "bar"} marker={dots ? "circle" : undefined} filled /> }))}
      data={{ columns: [categoryTitle, ...series.map((s) => (multi ? `${s.name}, ${valueTitle}` : valueTitle))], rows: categories.map((c, i) => [c, ...series.map((s) => s.values[i] ?? null)]) }}
    >
      <svg role="img" aria-label={`${valueTitle} ${dots ? "dot" : "bar"} chart, ${categories.length} ${dots ? "points" : "bars"}`} viewBox={`0 0 ${W} ${h}`} className="chart-svg">
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={g.sx(t)} x2={g.sx(t)} y1={M.t} y2={h - M.b} className="chart-grid" />
            <text x={g.sx(t)} y={h - M.b + 16} textAnchor="middle">
              {num(t)}
            </text>
          </g>
        ))}
        {categories.map((c, i) => {
          const y0 = M.t + i * (band + GAP);
          return (
            <g key={c}>
              <text x={M.l - 6} y={y0 + band / 2 + 4} textAnchor="end">
                {c}
              </text>
              {series.map((s, k) => {
                const v = s.values[i] ?? null;
                const y = dots ? y0 : y0 + k * BAR;
                const color = SERIES[k % SERIES.length];
                const end = v === null ? g.sx(g.zero ?? g.ticks[0]) : g.sx(v);
                const left = v !== null && v < 0;
                return (
                  <g key={s.name}>
                    {v !== null &&
                      (dots ? (
                        <MarkerShape m="circle" filled x={end} y={y + BAR / 2} color={color} r={5} />
                      ) : (
                        <rect x={Math.min(end, g.sx(0))} y={y + 1} width={Math.abs(end - g.sx(0))} height={BAR - 2} fill={color} />
                      ))}
                    {(!dots || !multi) && (
                      <text x={left ? end - 4 : end + (dots ? 9 : 4)} y={y + BAR / 2 + 4} textAnchor={left ? "end" : "start"}>
                        {v === null ? "—" : num(v)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
        {g.zero !== null && <line x1={g.sx(0)} x2={g.sx(0)} y1={M.t} y2={h - M.b} className="chart-axis" />}
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
