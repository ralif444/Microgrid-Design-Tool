"use client";
// Loadability axis for S-08 (Doc 12 X3, FR-88; guideline §5): the load scale λ with markers λ_c, λ_s
// and λ_ub from the M2 payload, and the bisection bracket (`resolution`) drawn as a band above λ_c
// and λ_s (D-51 K44: λ_c is the last FEASIBLE point, the change lies within the bracket above it;
// user choice 2026-11-03). The band end is drawing geometry only; no number is derived or shown.
// A null λ is not drawn and is listed as "—" (guideline §1 rule 5).
import { memo, useMemo } from "react";
import type { M2Payload, RunRecord } from "../../api-types";
import { num } from "../format";
import { ChartFrame } from "./ChartFrame";
import { MarkerShape, Swatch } from "./marks";
import { DASH, SERIES, type Marker } from "./palette";
import { linearScale, niceDomain, niceTicks } from "./scale";

const W = 560;
const M = { l: 24, r: 24 };
const AXIS = 96;
const ROW = 16;

type L = M2Payload["loadability"];
const MARKS: { key: "lambda_c" | "lambda_s" | "lambda_ub"; name: string; m: Marker; band: boolean }[] = [
  { key: "lambda_c", name: "λ_c", m: "circle", band: true },
  { key: "lambda_s", name: "λ_s", m: "square", band: true },
  { key: "lambda_ub", name: "λ_ub", m: "triangle", band: false },
];

export const LoadabilityAxis = memo(function LoadabilityAxis({ l, record }: { l: L; record?: RunRecord | null }) {
  const drawn = MARKS.map((d, k) => ({ ...d, k, v: l[d.key] })).filter((d) => d.v !== null) as (typeof MARKS[number] & { k: number; v: number })[];
  const g = useMemo(() => {
    const ends = drawn.flatMap((d) => (d.band ? [d.v, d.v + l.resolution] : [d.v]));
    const raw = niceDomain(ends);
    const d: [number, number] = raw[0] === raw[1] ? [raw[0] - 0.05, raw[0] + 0.05] : raw;
    const ticks = niceTicks(d);
    return { sx: linearScale([Math.min(d[0], ticks[0]), Math.max(d[1], ticks[ticks.length - 1])], [M.l, W - M.r]), ticks };
    // drawn is derived from l
  }, [l]);
  const h = AXIS + 40;
  const lam = "Load scale λ (ratio)";
  return (
    <ChartFrame
      title="Loadability along the load scale λ"
      record={record}
      note={`Stop reason: ${l.stop_reason}. Bands: the bisection bracket of ${num(l.resolution)} above λ_c and λ_s. λ_s is a solution-existence diagnostic, not a stability limit.${drawn.length < MARKS.length ? ` Not available: ${MARKS.filter((d) => l[d.key] === null).map((d) => d.name).join(", ")}.` : ""}`}
      legend={MARKS.map((d, k) => ({ name: d.name, swatch: <Swatch color={SERIES[k]} marker={d.m} filled />, word: k === 0 ? "solid" : k === 1 ? "dashed" : "dotted" }))}
      data={{ columns: ["Quantity", lam], rows: [...MARKS.map((d) => [d.name, l[d.key]]), ["Resolution", l.resolution], ["Grid step", l.grid_step]] }}
    >
      <svg role="img" aria-label={`${lam} axis, ${drawn.length} markers`} viewBox={`0 0 ${W} ${h}`} className="chart-svg">
        {drawn.length === 0 ? (
          <text x={W / 2} y={AXIS - 30} textAnchor="middle">
            No loadability value: λ_c, λ_s and λ_ub are not available.
          </text>
        ) : (
          <>
            {g.ticks.map((t) => (
              <g key={t}>
                <line x1={g.sx(t)} x2={g.sx(t)} y1={AXIS} y2={AXIS + 5} className="chart-axis" />
                <text x={g.sx(t)} y={AXIS + 18} textAnchor="middle">
                  {num(t)}
                </text>
              </g>
            ))}
            <line x1={M.l} x2={W - M.r} y1={AXIS} y2={AXIS} className="chart-axis" />
            {drawn.map((d) => {
              const x = g.sx(d.v);
              const y = 22 + d.k * ROW;
              const right = x > W - 100; // label to the left near the right edge
              return (
                <g key={d.key}>
                  {d.band && <rect x={x} y={y + 10} width={Math.max(2, g.sx(d.v + l.resolution) - x)} height={AXIS - y - 10} className="chart-band" />}
                  <line x1={x} x2={x} y1={y + 10} y2={AXIS} stroke={SERIES[d.k]} strokeWidth={1.5} strokeDasharray={DASH[d.k]} />
                  <MarkerShape m={d.m} x={x} y={y + 2} color={SERIES[d.k]} filled r={4} />
                  <text x={right ? x - 8 : x + 8} y={y + 6} textAnchor={right ? "end" : "start"}>
                    {d.name} = {num(d.v)}
                  </text>
                </g>
              );
            })}
          </>
        )}
        <text x={W / 2} y={h - 4} textAnchor="middle">
          {lam}
        </text>
      </svg>
    </ChartFrame>
  );
});
