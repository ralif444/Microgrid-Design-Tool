// Static single-line diagram drawing (Doc 12 X8, FR-94): model + layout → SVG, no interaction.
// SLD-4 wraps it with hover, focus and selection; the report (SLD-6) uses it as is.
import type { SldElement, SldModel } from "./buildSldModel";
import type { SVGProps } from "react";
import type { BreakerMark } from "../cable";
import { BAR_H, type Pt, type SldLayout } from "./layoutSld";
import styles from "./sld.module.css";
import { BreakerSymbol, BusSymbol, InverterSymbol, LineSymbol, LoadSymbol, SystemBlock, type Bind, type Emph } from "./symbols";

const PAD = 16;

export function SldSvg({
  model,
  layout,
  emph = {},
  label = "Single-line diagram",
  bind,
  scale = 1,
  clip,
  breakers = [],
  bindBreaker,
}: {
  model: SldModel;
  layout: SldLayout;
  emph?: Record<string, Emph>;
  label?: string;
  bind?: Bind;
  /** Zoom factor of the drawn size; the viewBox stays, so geometry is unchanged. */
  scale?: number;
  /** Draw only this x range of the layout (a print part of the report figure). */
  clip?: [number, number];
  /** X10 breakers after a current CB run (FR-113); S-05, S-07, S-08 only, never the report figure. */
  breakers?: BreakerMark[];
  bindBreaker?: (m: BreakerMark) => SVGProps<SVGGElement>;
}) {
  const at = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const [bus, inv, load, line] = [at(layout.buses), at(layout.inverters), at(layout.loads), at(layout.lines)];
  const placed = (els: SldElement[], m: Map<string, unknown>) => els.filter((e) => m.has(e.id));
  const x = clip ? clip[0] - PAD : -PAD;
  const w = (clip ? clip[1] - clip[0] : layout.width) + 2 * PAD;
  const h = layout.height + 2 * PAD;
  // Line: near the from-bus end of the route; Inverter: middle of the stub between square and bar.
  const breakerAt = (m: BreakerMark): Pt | null => {
    if (m.kind === "inverter") {
      const a = inv.get(m.id);
      return a ? { x: a.x, y: a.barY - BAR_H / 2 - (20 - BAR_H / 2) / 2 } : null;
    }
    const r = line.get(m.id);
    const from = bus.get(model.lines.find((l) => l.id === m.id)?.from ?? "");
    if (!r || !from) return null;
    const p = r.points;
    const start = Math.abs(p[0].y - from.barY) < 1 && p[0].x >= from.x - 1 && p[0].x <= from.x + from.w + 1;
    const [a, b] = start ? [p[0], p[1]] : [p[p.length - 1], p[p.length - 2]];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const d = Math.min(18, len / 2);
    return { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len };
  };
  return (
    <svg role="group" aria-label={label} width={w * scale} height={h * scale} viewBox={`${x} ${-PAD} ${w} ${h}`}>
      <SystemBlock el={model.system} {...layout.system} emph={emph.SYSTEM} bind={bind} />
      {/* DOM order is the Tab order of guideline §8: system, buses, inverters, loads, lines */}
      {model.buses.map((e) => (
        <BusSymbol key={e.id} el={e} box={bus.get(e.id)!} emph={emph[e.id]} bind={bind} />
      ))}
      {placed(model.inverters, inv).map((e) => (
        <InverterSymbol key={e.id} el={e} at={inv.get(e.id)!} emph={emph[e.id]} bind={bind} />
      ))}
      {placed(model.loads, load).map((e) => (
        <LoadSymbol key={e.id} el={e} at={load.get(e.id)!} emph={emph[e.id]} bind={bind} />
      ))}
      {placed(model.lines, line).map((e) => (
        <LineSymbol key={e.id} el={e} route={line.get(e.id)!} emph={emph[e.id]} bind={bind} />
      ))}
      {breakers.map((m) => {
        const at = breakerAt(m);
        return at && <BreakerSymbol key={`breaker-${m.id}`} mark={m} at={at} props={bindBreaker?.(m)} />;
      })}
      {layout.isolatedCaption && (
        <text x={layout.isolatedCaption.x} y={layout.isolatedCaption.y} className={styles.sec}>
          Not connected
        </text>
      )}
    </svg>
  );
}
