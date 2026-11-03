// Marker shapes and legend swatches for the charts (Doc 12 X1): shape and dash carry the series
// or Status, so colour is never the only carrier (guideline §1 rule 4).
import type { Marker } from "./palette";

export type Mark = { m: Marker; color?: string; filled?: boolean };

export function MarkerShape({ m, x, y, color, filled = false, r = 4 }: { m: Marker; x: number; y: number; color: string; filled?: boolean; r?: number }) {
  const p = { fill: filled ? color : "none", stroke: color, strokeWidth: 1.5 };
  if (m === "circle") return <circle cx={x} cy={y} r={r} {...p} />;
  if (m === "square") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} {...p} />;
  if (m === "triangle") return <path d={`M${x} ${y - r}L${x + r} ${y + r}L${x - r} ${y + r}Z`} {...p} />;
  if (m === "diamond") return <path d={`M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`} {...p} />;
  if (m === "dash") return <line x1={x - r - 1} x2={x + r + 1} y1={y} y2={y} stroke={color} strokeWidth="2" />;
  return <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`} {...p} />;
}

export function Swatch({ color, dash, marker, filled }: { color: string; dash?: string; marker?: Marker; filled?: boolean }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      {marker ? (
        <MarkerShape m={marker} x={14} y={6} color={color} filled={filled} />
      ) : dash === "bar" ? (
        <rect x="4" y="1" width="20" height="10" fill={color} />
      ) : (
        <line x1="0" y1="6" x2="28" y2="6" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      )}
    </svg>
  );
}
