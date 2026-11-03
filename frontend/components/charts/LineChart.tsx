"use client";
// Line and point chart (Doc 12 X1, FR-86): one polyline per run of values, so a null is a gap and
// never interpolated (guideline §1 rule 5); optional markers per point (e.g. shape by Status).
// Series differ by colour, dash and the legend word. Ticks are rounded for display only.
// Opt-in crosshair (Doc 12 X4, FR-89): snaps to the nearest real sample, lists every series there.
import { memo, useContext, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { RunRecord } from "../../api-types";
import { num } from "../format";
import { ChartFrame, ReportCharts, type LegendItem } from "./ChartFrame";
import { MarkerShape, Swatch, type Mark } from "./marks";
import { DASH, DASH_WORD, SERIES } from "./palette";
import styles from "./charts.module.css";
import { linearScale, nearestIndex, niceDomain, niceTicks, splitAtNulls } from "./scale";

const W = 560;
const H = 260;
const M = { l: 64, r: 16, t: 12, b: 44 };

// `marker` may also mark a point without a value; it is then drawn on the x axis (e.g. "–" unavailable).
// `title` gives a point a hover text (e.g. ζ and f of an eigenvalue).
export type LineSeries = { name: string; values: (number | null)[]; marker?: (i: number) => Mark | null; title?: (i: number) => string };
/** Crosshair readout words: "<xName> <x> <xUnit>", then "<series>: <value> <unit>". */
export type Crosshair = { xName: string; xUnit: string; unit: string };
/** A vertical mark at a request value, e.g. the disturbance start. */
export type VMark = { x: number; label: string };
/** A shaded x span ending at `to` and `span` wide (drawing geometry only, no number shown). */
export type XBand = { to: number; span: number };

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
  crosshair,
  vmarks = [],
  xband,
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
  crosshair?: Crosshair;
  vmarks?: VMark[];
  xband?: XBand;
}) {
  const [at, setAt] = useState<number | null>(null);
  const readout = useId();
  const report = useContext(ReportCharts);
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
  const cross = crosshair && x.length > 0 && !report; // static in the report (guideline §5)
  const move = (e: KeyboardEvent<SVGSVGElement>) => {
    const last = x.length - 1;
    const i = at ?? 0;
    const next = { ArrowLeft: Math.max(0, i - 1), ArrowRight: Math.min(last, i + 1), Home: 0, End: last }[e.key];
    if (next !== undefined) {
      e.preventDefault();
      setAt(next);
    } else if (e.key === "Escape") setAt(null);
  };
  const point = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setAt(nearestIndex(x.map(g.sx), ((e.clientX - box.left) / box.width) * W));
  };
  const band = xband && x.length ? [Math.max(M.l, g.sx(xband.to) - (g.sx(xband.span) - g.sx(0))), g.sx(xband.to)] : null;
  const items = legend ?? series.map((s, k) => ({ name: s.name, word: DASH_WORD[k % DASH.length], swatch: <Swatch color={SERIES[k % SERIES.length]} dash={DASH[k % DASH.length]} /> }));
  return (
    <ChartFrame
      title={title}
      record={record}
      legend={items}
      note={note}
      data={{ columns: [xTitle, ...series.map((s) => (series.length > 1 ? `${s.name}, ${yTitle}` : yTitle))], rows: x.map((v, i) => [v, ...series.map((s) => s.values[i] ?? null)]) }}
    >
      <svg
        role="img"
        aria-label={`${yTitle} against ${xTitle}, ${x.length} points`}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        {...(cross && {
          tabIndex: 0,
          "aria-describedby": at === null ? undefined : readout,
          onPointerMove: point,
          onPointerLeave: () => setAt(null),
          onFocus: () => setAt(at ?? 0),
          onBlur: () => setAt(null),
          onKeyDown: move,
        })}
      >
        {band && <rect x={band[0]} width={band[1] - band[0]} y={M.t} height={H - M.b - M.t} className="chart-band" />}
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
        {vmarks.map((v) => (
          <g key={v.label}>
            <line x1={g.sx(v.x)} x2={g.sx(v.x)} y1={M.t} y2={H - M.b} className="chart-ref" />
            <text x={g.sx(v.x) + 4} y={M.t + 12}>
              {v.label}
            </text>
          </g>
        ))}
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
        {cross && at !== null && (
          <g className="no-print">
            <line x1={g.sx(x[at])} x2={g.sx(x[at])} y1={M.t} y2={H - M.b} className="chart-axis" />
            {series.map((s, k) => {
              const v = s.values[at];
              return v === null || v === undefined ? null : <circle key={s.name} cx={g.sx(x[at])} cy={g.sy(v)} r={4} fill="none" stroke={SERIES[k % SERIES.length]} strokeWidth="2" />;
            })}
          </g>
        )}
      </svg>
      {cross && at !== null && (
        <div id={readout} data-testid="crosshair" className={`no-print ${styles.readout}`} style={g.sx(x[at]) < W / 2 ? { left: `${(g.sx(x[at]) / W) * 100}%` } : { right: `${100 - (g.sx(x[at]) / W) * 100}%` }}>
          <strong>
            {crosshair.xName} {num(x[at])} {crosshair.xUnit}
          </strong>
          {series.map((s) => (
            <span key={s.name}>
              {s.name}: {s.values[at] === null || s.values[at] === undefined ? "—" : `${num(s.values[at] as number)} ${crosshair.unit}`}
            </span>
          ))}
        </div>
      )}
    </ChartFrame>
  );
});
