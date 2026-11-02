// Sweep plot (Doc 7 §6.5): inline SVG, marker shape carries the Status (o feasible, x infeasible,
// - failed) so colour is never the only carrier (§8); the point table holds the same values.
import type { KeyMetrics, SweepPoint } from "../api-types";

const W = 480;
const H = 240;
const PAD = 48;

export function SweepChart({
  points,
  metric,
  xLabel,
  yLabel,
}: {
  points: SweepPoint[];
  metric: keyof KeyMetrics;
  xLabel: string;
  yLabel: string;
}) {
  const xs = points.map((p) => p.value ?? 0);
  const ys = points.map((p) => p.key_metrics[metric]).filter((v): v is number => typeof v === "number");
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 1];
  const sx = (v: number) => PAD + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
  return (
    <figure>
      <svg role="img" aria-label={`${yLabel} against ${xLabel}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" />
        <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="12">
          {xLabel}
        </text>
        <text x={12} y={PAD - 12} fontSize="12">
          {yLabel}
        </text>
        <text x={PAD} y={H - PAD + 16} textAnchor="middle" fontSize="11">
          {x0}
        </text>
        <text x={W - PAD} y={H - PAD + 16} textAnchor="middle" fontSize="11">
          {x1}
        </text>
        <text x={PAD - 4} y={sy(y0)} textAnchor="end" fontSize="11">
          {Number(y0.toPrecision(5))}
        </text>
        <text x={PAD - 4} y={sy(y1) + 10} textAnchor="end" fontSize="11">
          {Number(y1.toPrecision(5))}
        </text>
        {points.map((p, k) => {
          const v = p.key_metrics[metric];
          const cx = sx(p.value ?? 0);
          if (typeof v !== "number")
            return <line key={k} x1={cx - 5} x2={cx + 5} y1={H - PAD - 8} y2={H - PAD - 8} stroke="currentColor" />;
          const cy = sy(v);
          return p.status === "FEASIBLE" ? (
            <circle key={k} cx={cx} cy={cy} r={4} fill="none" stroke="currentColor" />
          ) : (
            <path key={k} d={`M${cx - 4} ${cy - 4}L${cx + 4} ${cy + 4}M${cx - 4} ${cy + 4}L${cx + 4} ${cy - 4}`} stroke="currentColor" />
          );
        })}
      </svg>
      <figcaption>o feasible · x infeasible · – no operating point (failed)</figcaption>
    </figure>
  );
}
