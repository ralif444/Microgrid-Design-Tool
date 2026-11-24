"use client";
// Horizontal bar chart (Doc 12 X1, FR-86): bars from zero, to either side, one bar per series in
// each category; or dots on a data-fitted axis (`dots`), for values far from zero such as p.u.
// voltages. A null value gets no bar and the label "—" (guideline §1 rule 5). Reference lines
// mark user-set limits. `negative` shades and names the side below zero (S-08 margins: "Violated");
// `labelWidth` widens the category column for long names.
import { memo, useMemo } from "react";
import type { RunRecord } from "../../api-types";
import { fixed, numText } from "../format";
import { useLanguage } from "../Language";
import { ChartFrame } from "./ChartFrame";
import { MarkerShape, Swatch } from "./marks";
import { SERIES } from "./palette";
import { linearScale, niceDomain, niceTicks } from "./scale";

const W = 560;
const BAR = 20;
const GAP = 12;
const M = { l: 72, r: 64, t: 22, b: 44 };
const CHAR = 6.6; // width of one 12 px digit in viewBox units

export type BarSeries = { name: string; values: (number | null)[] };
export type RefLine = { value: number; label: string };

export const BarChart = memo(function BarChart({
  title,
  valueTitle,
  categoryTitle,
  categories,
  series,
  refs = [],
  limits,
  dots = false,
  note,
  record,
  negative,
  labelWidth = M.l,
  unit = /\(([^()]+)\)\s*$/.exec(valueTitle)?.[1] ?? "",
}: {
  /** value unit for the bar labels; defaults to the last "(unit)" of `valueTitle` */
  unit?: string;
  title: string;
  valueTitle: string; // with unit, e.g. "Bus voltage (p.u.)"
  categoryTitle: string;
  categories: string[];
  series: BarSeries[];
  refs?: RefLine[];
  /** per-category limit, drawn as a tick across that bar (each line's own limit, audit D-8) */
  limits?: (number | null)[];
  dots?: boolean;
  note?: string;
  record?: RunRecord | null;
  negative?: string;
  labelWidth?: number;
}) {
  const { t } = useLanguage();
  const band = dots ? BAR : BAR * series.length;
  const h = M.t + categories.length * (band + GAP) + M.b;
  const g = useMemo(() => {
    const vals = [...series.flatMap((s) => s.values), ...refs.map((r) => r.value), ...(limits ?? [])];
    const fin = vals.filter((v): v is number => v !== null);
    const raw: [number, number] = dots ? niceDomain(vals) : [Math.min(0, ...fin), Math.max(0, ...fin)];
    const d: [number, number] = raw[0] === raw[1] ? [raw[0], raw[0] + 1] : raw;
    // room left of the plot for the value labels of negative bars, so they never meet a category name
    const neg = dots ? [] : fin.filter((v) => v < 0).map((v) => fixed(v, unit).length);
    const pad = neg.length ? Math.max(...neg) * CHAR + 8 : 0;
    // one tick per ~60 units of plot width, so long tick labels (-0.0012) never overlap
    const ticks = niceTicks(d, Math.min(5, Math.max(2, Math.floor((W - M.r - labelWidth - pad) / 60))));
    const dom: [number, number] = [Math.min(d[0], ticks[0]), Math.max(d[1], ticks[ticks.length - 1])];
    return { sx: linearScale(dom, [labelWidth + pad, W - M.r]), ticks, zero: dots ? null : 0, lo: dom[0] };
  }, [series, refs, limits, dots, labelWidth, unit]);
  const multi = series.length > 1;
  return (
    <ChartFrame
      title={title}
      record={record}
      note={note}
      legend={series.map((s, k) => ({ name: s.name, swatch: <Swatch color={SERIES[k % SERIES.length]} dash={dots ? undefined : "bar"} marker={dots ? "circle" : undefined} filled /> }))}
      data={{ columns: [categoryTitle, ...series.map((s) => (multi ? `${s.name}, ${valueTitle}` : valueTitle)), ...(limits ? [t("Limit ({unit})", { unit })] : [])], rows: categories.map((c, i) => [c, ...series.map((s) => s.values[i] ?? null), ...(limits ? [limits[i] ?? null] : [])]) }}
    >
      <svg role="img" aria-label={t("{title} {kind} chart, {n} {what}", { title: valueTitle, kind: t(dots ? "dot" : "bar"), n: categories.length, what: t(dots ? "points" : "bars") })} viewBox={`0 0 ${W} ${h}`} className="chart-svg">
        {negative && g.zero !== null && g.lo < 0 && (
          <g>
            <rect x={g.sx(g.lo)} y={M.t} width={g.sx(0) - g.sx(g.lo)} height={h - M.t - M.b} className="chart-negative" />
            <text x={g.sx(0) - 4} y={14} textAnchor="end" className="chart-negative-word">
              {negative}
            </text>
          </g>
        )}
        {g.ticks.map((t) => (
          <g key={t}>
            <line x1={g.sx(t)} x2={g.sx(t)} y1={M.t} y2={h - M.b} className="chart-grid" />
            <text x={g.sx(t)} y={h - M.b + 16} textAnchor="middle">
              {numText(t)}
            </text>
          </g>
        ))}
        {categories.map((c, i) => {
          const y0 = M.t + i * (band + GAP);
          return (
            <g key={c}>
              <text x={labelWidth - 6} y={y0 + band / 2 + 4} textAnchor="end">
                {c}
              </text>
              {limits?.[i] != null && <line x1={g.sx(limits[i]!)} x2={g.sx(limits[i]!)} y1={y0 - 3} y2={y0 + band + 3} className="chart-ref" data-testid="bar-limit" />}
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
                        {v === null ? "—" : fixed(v, unit)}
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
        <text x={(labelWidth + W - M.r) / 2} y={h - 2} textAnchor="middle">
          {valueTitle}
        </text>
      </svg>
    </ChartFrame>
  );
});
