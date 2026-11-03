// Static single-line diagram drawing (Doc 12 X8, FR-94): model + layout → SVG, no interaction.
// SLD-4 wraps it with hover, focus and selection; the report (SLD-6) uses it as is.
import type { SldElement, SldModel } from "./buildSldModel";
import type { SldLayout } from "./layoutSld";
import styles from "./sld.module.css";
import { BusSymbol, InverterSymbol, LineSymbol, LoadSymbol, SystemBlock, type Bind, type Emph } from "./symbols";

const PAD = 16;

export function SldSvg({
  model,
  layout,
  emph = {},
  label = "Single-line diagram",
  bind,
  scale = 1,
}: {
  model: SldModel;
  layout: SldLayout;
  emph?: Record<string, Emph>;
  label?: string;
  bind?: Bind;
  /** Zoom factor of the drawn size; the viewBox stays, so geometry is unchanged. */
  scale?: number;
}) {
  const at = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const [bus, inv, load, line] = [at(layout.buses), at(layout.inverters), at(layout.loads), at(layout.lines)];
  const placed = (els: SldElement[], m: Map<string, unknown>) => els.filter((e) => m.has(e.id));
  const w = layout.width + 2 * PAD;
  const h = layout.height + 2 * PAD;
  return (
    <svg role="group" aria-label={label} width={w * scale} height={h * scale} viewBox={`${-PAD} ${-PAD} ${w} ${h}`}>
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
      {layout.isolatedCaption && (
        <text x={layout.isolatedCaption.x} y={layout.isolatedCaption.y} className={styles.sec}>
          Not connected
        </text>
      )}
    </svg>
  );
}
