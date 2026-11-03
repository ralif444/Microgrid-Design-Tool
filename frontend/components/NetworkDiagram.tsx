// Read-only network diagram for S-05 (Doc 2 FR-14, Doc 7 P5; D-69): Buses on a circle, Lines as
// straight segments; a Bus without a Line is drawn dashed and labelled "not connected".
// Positions are layout only and never stored (Doc 9 A-23).
import type { ProjectSnapshot } from "../api-types";

const W = 360;
const R = 130;

export function diagramLayout(d: ProjectSnapshot) {
  const buses = (d.buses ?? []).map((b) => b.id ?? "").filter(Boolean);
  const at = new Map(
    buses.map((id, k) => {
      const a = (2 * Math.PI * k) / Math.max(buses.length, 1) - Math.PI / 2;
      return [id, { x: W / 2 + (buses.length > 1 ? R * Math.cos(a) : 0), y: W / 2 + (buses.length > 1 ? R * Math.sin(a) : 0) }];
    }),
  );
  const lines = (d.lines ?? []).filter((l) => at.has(l.from_bus_id ?? "") && at.has(l.to_bus_id ?? ""));
  const linked = new Set(lines.flatMap((l) => [l.from_bus_id, l.to_bus_id]));
  return { buses, at, lines, isolated: buses.filter((b) => !linked.has(b)) };
}

export function NetworkDiagram({ design }: { design: ProjectSnapshot }) {
  const { buses, at, lines, isolated } = diagramLayout(design);
  if (buses.length === 0) return <p>No buses yet. Add a bus to start.</p>;
  const label = `Network diagram: ${buses.length} bus(es), ${lines.length} line(s)${isolated.length ? `; not connected: ${isolated.join(", ")}` : ""}`;
  return (
    <svg role="img" aria-label={label} width={W} height={W} viewBox={`0 0 ${W} ${W}`}>
      {lines.map((l) => {
        const a = at.get(l.from_bus_id ?? "")!;
        const b = at.get(l.to_bus_id ?? "")!;
        return (
          <g key={l.id} data-testid={`diagram-line-${l.id}`}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-fg)" strokeWidth={2} />
            <text x={(a.x + b.x) / 2 + 4} y={(a.y + b.y) / 2 - 4} fontSize={11}>
              {l.id}
            </text>
          </g>
        );
      })}
      {buses.map((id) => {
        const p = at.get(id)!;
        const alone = isolated.includes(id);
        return (
          <g key={id} data-testid={`diagram-bus-${id}`} data-isolated={alone}>
            <circle cx={p.x} cy={p.y} r={14} fill="var(--color-bg)" stroke={alone ? "var(--role-error-border)" : "var(--color-fg)"} strokeWidth={2} strokeDasharray={alone ? "4 3" : undefined} />
            <text x={p.x} y={p.y + 4} fontSize={11} textAnchor="middle">
              {id}
            </text>
            {alone && (
              <text x={p.x} y={p.y + 30} fontSize={11} textAnchor="middle" fill="var(--role-error-fg)">
                not connected
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
