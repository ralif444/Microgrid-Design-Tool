"use client";
// Line and point chart (Doc 12 X1, FR-86): one polyline per run of values, so a null is a gap and
// never interpolated (guideline §1 rule 5); optional markers per point (e.g. shape by Status).
// Series differ by colour, dash and the legend word. Ticks are rounded for display only.
import { memo, useMemo } from "react";
import type { RunRecord } from "../../api-types";
import { num } from "../format";
import { ChartFrame, type LegendItem } from "./ChartFrame";
import { MarkerShape, Swatch, type Mark } from "./marks";
import { DASH, DASH_WORD, SERIES } from "./palette";
import { linearScale, niceDomain, niceTicks, splitAtNulls } from "./scale";

const W = 560;
const H = 260;
const M = { l: 64, r: 16, t: 12, b: 44 };

// `marker` may also mark a point without a value; it is then drawn on the x axis (e.g. "–" unavailable).
// `title` gives a point a hover text (e.g. ζ and f of an eigenvalue).
export type LineSeries = { name: string; values: (number | null)[]; marker?: (i: number) => Mark | null; title?: (i: number) => string };

export const LineChart = memo(function LineChart({
  title,
  xTitle,
  yTitle,
  x,
  series,
  line = true,
  legend,
  note,
  record,
}: {
  title: string;
  xTitle: string; // with unit, e.g. "time (s)"
  yTitle: string; // with unit
  x: number[];
  series: LineSeries[];
  line?: boolean;
  legend?: LegendItem[];
  note?: string;
  record?: RunRecord | null;
}) {
  const g = useMemo(() => {
    const xd = niceDomain(x, 0);
    const yd = niceDomain(series.flatMap((s) => s.values));
    return {
      sx: linearScale(xd, [M.l, W - M.r]),
      sy: linearScale(yd, [H - M.b, M.t]),
      xt: niceTicks(xd),
      yt: niceTicks(yd),
    };
  }, [x, series]);
  const items = legend ?? series.map((s, k) => ({ name: s.name, word: DASH_WORD[k % DASH.length], swatch: <Swatch color={SERIES[k % SERIES.length]} dash={DASH[k % DASH.length]} /> }));
  return (
    <ChartFrame
      title={title}
      record={record}
      legend={items}
      note={note}
      data={{ columns: [xTitle, ...series.map((s) => (series.length > 1 ? `${s.name}, ${yTitle}` : yTitle))], rows: x.map((v, i) => [v, ...series.map((s) => s.values[i] ?? null)]) }}
    >
      <svg role="img" aria-label={`${yTitle} against ${xTitle}, ${x.length} points`} viewBox={`0 0 ${W} ${H}`} className="chart-svg">
        {g.yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} x2={W - M.r} y1={g.sy(t)} y2={g.sy(t)} className="chart-grid" />
            <text x={M.l - 6} y={g.sy(t) + 4} textAnchor="end">
              {num(t)}
            </text>
          </g>
        ))}
        {g.xt.map((t) => (
          <text key={`x${t}`} x={g.sx(t)} y={H - M.b + 16} textAnchor="middle">
            {num(t)}
          </text>
        ))}
        {x.length === 0 && (
          <text x={(M.l + W - M.r) / 2} y={(M.t + H - M.b) / 2} textAnchor="middle">
            No data
          </text>
        )}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="chart-axis" />
        <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} className="chart-axis" />
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
          {xTitle}
        </text>
        <text transform={`translate(14 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
          {yTitle}
        </text>
        {series.map((s, k) => {
          const color = SERIES[k % SERIES.length];
          return (
            <g key={s.name}>
              {line &&
                splitAtNulls(s.values).map((run) =>
                  run.length === 1 && !s.marker ? ( // a sample between two gaps stays visible
                    <circle key={run[0]} cx={g.sx(x[run[0]])} cy={g.sy(s.values[run[0]] as number)} r={2} fill={color} />
                  ) : (
                  <polyline
                    key={run[0]}
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeDasharray={DASH[k % DASH.length]}
                    points={run.map((i) => `${g.sx(x[i])},${g.sy(s.values[i] as number)}`).join(" ")}
                  />
                  ),
                )}
              {s.marker &&
                s.values.map((v, i) => {
                  const k = s.marker!(i);
                  return (
                    k && (
                      <g key={i}>
                        {s.title && <title>{s.title(i)}</title>}
                        <MarkerShape m={k.m} filled={k.filled} x={g.sx(x[i])} y={v === null ? H - M.b - 6 : g.sy(v)} color={k.color ?? color} r={s.title ? 5 : 4} />
                      </g>
                    )
                  );
                })}
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
});
