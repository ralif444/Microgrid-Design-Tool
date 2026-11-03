// Static single-line diagram drawing (Doc 12 X8, FR-94): model + layout → SVG, no interaction.
// SLD-4 wraps it with hover, focus and selection; the report (SLD-6) uses it as is.
import type { SldElement, SldModel } from "./buildSldModel";
import type { SldLayout } from "./layoutSld";
import styles from "./sld.module.css";
import { BusSymbol, InverterSymbol, LineSymbol, LoadSymbol, SystemBlock, type Emph } from "./symbols";

const PAD = 16;

export function SldSvg({ model, layout, emph = {}, label = "Single-line diagram" }: { model: SldModel; layout: SldLayout; emph?: Record<string, Emph>; label?: string }) {
  const at = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const [bus, inv, load, line] = [at(layout.buses), at(layout.inverters), at(layout.loads), at(layout.lines)];
  const placed = (els: SldElement[], m: Map<string, unknown>) => els.filter((e) => m.has(e.id));
  const w = layout.width + 2 * PAD;
  const h = layout.height + 2 * PAD;
  return (
    <svg role="group" aria-label={label} width={w} height={h} viewBox={`${-PAD} ${-PAD} ${w} ${h}`}>
      <SystemBlock el={model.system} {...layout.system} emph={emph.SYSTEM} />
      {placed(model.lines, line).map((e) => (
        <LineSymbol key={e.id} el={e} route={line.get(e.id)!} emph={emph[e.id]} />
      ))}
      {model.buses.map((e) => (
        <BusSymbol key={e.id} el={e} box={bus.get(e.id)!} emph={emph[e.id]} />
      ))}
      {placed(model.inverters, inv).map((e) => (
        <InverterSymbol key={e.id} el={e} at={inv.get(e.id)!} emph={emph[e.id]} />
      ))}
      {placed(model.loads, load).map((e) => (
        <LoadSymbol key={e.id} el={e} at={load.get(e.id)!} emph={emph[e.id]} />
      ))}
      {layout.isolatedCaption && (
        <text x={layout.isolatedCaption.x} y={layout.isolatedCaption.y} className={styles.sec}>
          Not connected
        </text>
      )}
    </svg>
  );
}
