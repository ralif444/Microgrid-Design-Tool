// Bus voltage bar chart (Doc 9 D-47 K19): inline SVG, no chart library; the data table next to it
// carries the same values for screen readers and print.
import type { M1Payload } from "../api-types";

const W = 480;
const BAR = 28;
const LEFT = 60;

export function VoltageChart({ p }: { p: M1Payload }) {
  const rows = p.bus_results;
  const max = Math.max(1.1, ...rows.map((b) => b.voltage_pu));
  const h = rows.length * (BAR + 8) + 24;
  const x = (v: number) => LEFT + (v / max) * (W - LEFT - 50);
  return (
    <figure>
      <svg role="img" aria-label="Bus voltage (p.u.) bar chart" width={W} height={h} viewBox={`0 0 ${W} ${h}`}>
        {rows.map((b, k) => {
          const y = k * (BAR + 8);
          return (
            <g key={b.bus_id}>
              <text x={LEFT - 6} y={y + BAR * 0.7} textAnchor="end" fontSize="12">
                {b.bus_id}
              </text>
              <rect x={LEFT} y={y} width={x(b.voltage_pu) - LEFT} height={BAR} fill="currentColor" opacity="0.6" />
              <text x={x(b.voltage_pu) + 4} y={y + BAR * 0.7} fontSize="12">
                {b.voltage_pu}
              </text>
            </g>
          );
        })}
        <line x1={x(1)} x2={x(1)} y1={0} y2={h - 20} stroke="currentColor" strokeDasharray="4 3" />
        <text x={x(1)} y={h - 6} textAnchor="middle" fontSize="12">
          1.0 p.u.
        </text>
      </svg>
      <figcaption>Bus voltage magnitude (p.u.) from the latest power flow (M1).</figcaption>
    </figure>
  );
}
