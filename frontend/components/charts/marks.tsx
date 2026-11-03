// Marker shapes and legend swatches for the charts (Doc 12 X1): shape and dash carry the series
// or Status, so colour is never the only carrier (guideline §1 rule 4).
import type { Marker } from "./palette";

export function MarkerShape({ m, x, y, color, r = 4 }: { m: Marker; x: number; y: number; color: string; r?: number }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.5 };
  if (m === "circle") return <circle cx={x} cy={y} r={r} {...p} />;
  if (m === "square") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} {...p} />;
  if (m === "triangle") return <path d={`M${x} ${y - r}L${x + r} ${y + r}L${x - r} ${y + r}Z`} {...p} />;
  if (m === "diamond") return <path d={`M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`} {...p} />;
  return <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`} {...p} />;
}

export function Swatch({ color, dash, marker }: { color: string; dash?: string; marker?: Marker }) {
  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
      {marker ? (
        <MarkerShape m={marker} x={14} y={6} color={color} />
      ) : (
        <line x1="0" y1="6" x2="28" y2="6" stroke={color} strokeWidth="2" strokeDasharray={dash} />
      )}
    </svg>
  );
}
