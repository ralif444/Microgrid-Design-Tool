// Single-line diagram symbols as SVG primitives (Doc 12 X8, FR-94; SLD guideline §3, §5). Only what the
// model has: busbar, grid-forming inverter, constant-PQ load, series line, system block. No switch,
// transformer, grounding, grid or battery; a breaker only as an X10 sizing result (D-104 K295). Colour follows the element state through `color`
// (CSS module); status is always icon + word, never colour alone (R6). Text uses the §5.1 labels.
import type { ReactNode, SVGProps } from "react";
import { Icon, type IconName } from "../Icon";
import type { SldElement } from "./buildSldModel";
import type { BreakerMark } from "../cable";
import { BAR_H, type Attach, type BusBox, type LineRoute, type Pt } from "./layoutSld";
import styles from "./sld.module.css";

/** Static stand-in for hover/focus and selection, for the gallery and the report (SLD-4 adds the live ones). */
export type Emph = "hover" | "selected" | undefined;

const LH = 14; // label line height
const CHAR = 7; // estimated width of one 12 px Plex Sans character, for pill backgrounds
type Deco = { icon: IconName; word: string; tone: "negative" | "neutral" | "error" | "caution" };

/** Icon + word for the element's state (guideline §5); an isolated Bus also says "not connected" (FR-14). */
export function decorations(el: SldElement, isolated = false): Deco[] {
  const d: Deco[] = [];
  if (el.mark === "violated") d.push({ icon: "misuse", word: "Violated", tone: "negative" });
  if (el.mark === "limiting") d.push({ icon: "misuse", word: "Limiting", tone: "negative" });
  if (el.mark === "near") d.push({ icon: "warn", word: "Near limit", tone: "caution" });
  // W3: a bus shows its pass state beside the voltage; other elements stay quiet when they pass
  if (el.mark === "pass" && el.kind === "bus") d.push({ icon: "check", word: "Pass", tone: "neutral" });
  if (el.issues.length) d.push({ icon: "alert", word: el.issues.length === 1 ? "Issue" : `${el.issues.length} issues`, tone: "error" });
  if (isolated) d.push({ icon: "warn", word: "not connected", tone: "caution" });
  return d;
}

function DecoLine({ x, y, decos, anchor = "start" }: { x: number; y: number; decos: Deco[]; anchor?: "start" | "middle" }) {
  if (!decos.length) return null;
  const width = decos.reduce((w, d) => w + 20 + d.word.length * CHAR + 8, 0);
  let cx = anchor === "middle" ? x - width / 2 : x;
  return (
    <g>
      {decos.map((d) => {
        const at = cx;
        cx += 20 + d.word.length * CHAR + 8;
        return (
          <g key={d.word} className={styles[d.tone]}>
            <g transform={`translate(${at} ${y - 11})`} className={styles.icon}>
              <Icon name={d.icon} size={14} />
            </g>
            <text x={at + 18} y={y} className={styles.deco}>
              {d.word}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Text lines with a layer-01 pill behind each, so a conductor passing under stays legible. */
function Stack({ x, y, lines, anchor = "start", first = styles.label }: { x: number; y: number; lines: string[]; anchor?: "start" | "middle"; first?: string }) {
  return (
    <g>
      {lines.map((t, k) => {
        const w = t.length * CHAR + 6;
        const bx = anchor === "middle" ? x - w / 2 : x - 3;
        return (
          <g key={k}>
            <rect x={bx} y={y + k * LH - 11} width={w} height={LH} className={styles.pill} />
            <text x={x} y={y + k * LH} textAnchor={anchor} className={k === 0 ? first : styles.sec}>
              {t}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** W3: smallest element margin, a filled accent bar 4 high under the element (mockup phase 6). */
function Tightest({ x, y, w }: { x: number; y: number; w: number }) {
  return <rect x={x} y={y} width={w} height={4} className={styles.tight} data-testid="diagram-tightest" />;
}

/** W3: inverter loading, 50 x 5, fill = loading ratio clamped to 0–1; the number is in the label above. */
function LoadingBar({ x, y, ratio, mark }: { x: number; y: number; ratio: number; mark: SldElement["mark"] }) {
  const tone = mark === "violated" || mark === "limiting" ? styles.loadBad : mark === "near" ? styles.loadNear : styles.loadOk;
  return (
    <g aria-hidden="true">
      <rect x={x} y={y} width={50} height={5} className={styles.track} />
      <rect x={x} y={y} width={50 * Math.min(1, Math.max(0, ratio))} height={5} className={tone} />
    </g>
  );
}

const cls = (el: SldElement, emph: Emph, extra?: string) =>
  [styles.el, el.mark === "violated" || el.mark === "limiting" ? styles.marked : "", emph ? styles[emph] : "", extra ?? ""].filter(Boolean).join(" ");

/** SLD-4: focus, hover and selection handlers for an element's root group; absent in a static figure. */
export type Bind = (el: SldElement) => SVGProps<SVGGElement>;
type Common = { el: SldElement; emph?: Emph; bind?: Bind; children?: ReactNode };

export function BusSymbol({ el, box, emph, bind }: Common & { box: BusBox }) {
  const decos = decorations(el, box.isolated);
  // stack bottom-up from just above the bar: id (and name), then M1 labels, then the state words
  const lines = [el.name ? `${el.id} ${el.name}` : el.id, ...el.tags.slice(1)];
  const top = box.barY - 10 - (lines.length - 1) * LH;
  return (
    <g className={cls(el, emph)} {...bind?.(el)} data-testid={`diagram-bus-${el.id}`} data-isolated={box.isolated}>
      <rect x={box.x - 6} y={box.barY - 10} width={box.w + 12} height={20} className={styles.halo} />
      {(box.isolated || el.issues.length > 0) && (
        <rect
          x={box.x - 4}
          y={top - 16 - (decos.length ? LH : 0)}
          width={box.w + 8}
          height={box.barY + 8 - (top - 16 - (decos.length ? LH : 0))}
          className={el.issues.length ? styles.issueOutline : styles.isolatedOutline}
        />
      )}
      <rect x={box.x} y={box.barY - BAR_H / 2} width={box.w} height={BAR_H} className={styles.bar} />
      {el.tightest && <Tightest x={box.x} y={box.barY + BAR_H / 2 + 3} w={box.w} />}
      <DecoLine x={box.x} y={top - LH} decos={decos} />
      <Stack x={box.x} y={top} lines={lines} first={styles.id} />
    </g>
  );
}

/** Square with one diagonal, "=" upper-left (DC), "~" lower-right (AC), stub down to the bar, "GFM" tag. */
export function InverterSymbol({ el, at, emph, bind }: Common & { at: Attach }) {
  const s = 36;
  const x = at.x - s / 2;
  const y = at.barY - 20 - s;
  const decos = decorations(el);
  const lines = [el.tags[0], ...el.tags.slice(1)];
  const top = y - 8 - (lines.length - 1) * LH;
  return (
    <g className={cls(el, emph)} {...bind?.(el)} data-testid={`diagram-inverter-${el.id}`}>
      <rect x={x - 5} y={y - 5} width={s + 10} height={s + 10} className={styles.halo} />
      {el.issues.length > 0 && <rect x={x - 8} y={y - 8} width={s + 16} height={s + 16} className={styles.issueOutline} />}
      <line x1={at.x} y1={y + s} x2={at.x} y2={at.barY - BAR_H / 2} className={styles.wire} />
      <rect x={x} y={y} width={s} height={s} className={styles.box} />
      <line x1={x} y1={y + s} x2={x + s} y2={y} className={styles.wire} />
      <text x={x + 9} y={y + 15} textAnchor="middle" className={styles.glyph}>
        =
      </text>
      <text x={x + s - 9} y={y + s - 6} textAnchor="middle" className={styles.glyph}>
        ~
      </text>
      <text x={x + s + 4} y={y + s / 2 + 4} className={styles.tag}>
        GFM
      </text>
      {el.loading !== undefined && <LoadingBar x={x + s + 4} y={y + s / 2 + 10} ratio={el.loading} mark={el.mark} />}
      {el.tightest && <Tightest x={x} y={y + s + 3} w={s} />}
      <DecoLine x={at.x} y={top - LH} decos={decos} anchor="middle" />
      <Stack x={at.x} y={top} lines={lines} anchor="middle" first={styles.id} />
    </g>
  );
}

/** Line down from the bar ending in a filled arrowhead (12 wide, 14 high), labels under it. */
export function LoadSymbol({ el, at, emph, bind }: Common & { at: Attach }) {
  const y0 = at.barY + BAR_H / 2;
  const tip = y0 + 30 + 14;
  return (
    <g className={cls(el, emph)} {...bind?.(el)} data-testid={`diagram-load-${el.id}`}>
      <rect x={at.x - 10} y={y0} width={20} height={tip - y0 + 4} className={styles.halo} />
      {el.issues.length > 0 && <rect x={at.x - 13} y={y0 + 2} width={26} height={tip - y0 + 4} className={styles.issueOutline} />}
      <line x1={at.x} y1={y0} x2={at.x} y2={y0 + 30} className={styles.wire} />
      <path d={`M${at.x - 6} ${y0 + 30} L${at.x + 6} ${y0 + 30} L${at.x} ${tip} Z`} className={styles.head} />
      <Stack x={at.x} y={tip + 14} lines={el.tags} anchor="middle" first={styles.id} />
      <DecoLine x={at.x} y={tip + 14 + el.tags.length * LH} decos={decorations(el)} anchor="middle" />
    </g>
  );
}

/** Orthogonal conductor between busbars; id (and M1 current) on a pill at the longest segment. */
export function LineSymbol({ el, route, emph, bind }: Common & { route: LineRoute }) {
  const pts = route.points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <g className={cls(el, emph)} {...bind?.(el)} data-testid={`diagram-line-${el.id}`}>
      <polyline points={pts} className={styles.lineHalo} />
      <polyline points={pts} className={styles.conductor} />
      <Stack x={route.mid.x} y={route.mid.y + 4} lines={el.tags} anchor="middle" />
      <DecoLine x={route.mid.x} y={route.mid.y + 4 + el.tags.length * LH} decos={decorations(el)} anchor="middle" />
      {el.tightest && <Tightest x={route.mid.x - 20} y={route.mid.y + 4 + (el.tags.length + (decorations(el).length ? 1 : 0)) * LH - 8} w={40} />}
    </g>
  );
}

/** X10 sizing result (FR-113, D-104 K295): outlined 10 x 10 square centred on the conductor at `at`, no label. */
export function BreakerSymbol({ mark, at, props }: { mark: BreakerMark; at: Pt; props?: SVGProps<SVGGElement> }) {
  return (
    <g className={styles.el} {...props} data-testid={`diagram-breaker-${mark.id}`}>
      <rect x={at.x - 8} y={at.y - 8} width={16} height={16} className={styles.halo} />
      <rect x={at.x - 5} y={at.y - 5} width={10} height={10} className={styles.box} />
    </g>
  );
}

/** Text box, not a symbol: nominal kV (line-to-line) and Hz, the network kind, the M1 system frequency. */
export function SystemBlock({ el, x, y, w, h, emph, bind }: Common & { x: number; y: number; w: number; h: number }) {
  const [kv, hz, ...res] = el.tags;
  const decos = decorations(el);
  return (
    <g className={cls(el, emph)} {...bind?.(el)} data-testid="diagram-system">
      <rect x={x} y={y} width={w} height={h} className={styles.block} />
      <text x={x + 10} y={y + 20} className={styles.id}>
        {kv} · {hz}
      </text>
      <text x={x + 10} y={y + 20 + LH} className={styles.sec}>
        Balanced 3-phase, islanded
      </text>
      {res.map((t, k) => (
        <text key={t} x={x + 10} y={y + 20 + (k + 2) * LH} className={styles.sec}>
          {t}
        </text>
      ))}
      <DecoLine x={x + 10} y={y + 20 + (res.length + 2) * LH} decos={decos} />
    </g>
  );
}

/** HTML legend strip under the diagram (guideline §3): each symbol with its name. */
export function SldLegend({ breakers = false, tightest = false }: { breakers?: boolean; tightest?: boolean }) {
  const item = (name: string, svg: ReactNode) => (
    <li key={name}>
      <svg width={44} height={36} viewBox="0 0 44 36" aria-hidden="true" focusable="false">
        {svg}
      </svg>
      {name}
    </li>
  );
  return (
    <ul className={styles.legend} aria-label="Diagram legend">
      {item("Bus (busbar)", <rect x={2} y={15} width={40} height={BAR_H} className={styles.bar} />)}
      {item(
        "Grid-forming inverter",
        <>
          <rect x={8} y={2} width={28} height={28} className={styles.box} />
          <line x1={8} y1={30} x2={36} y2={2} className={styles.wire} />
        </>,
      )}
      {item(
        "Load (constant PQ)",
        <>
          <line x1={22} y1={2} x2={22} y2={20} className={styles.wire} />
          <path d="M16 20 L28 20 L22 32 Z" className={styles.head} />
        </>,
      )}
      {item("Line (series R–X)", <line x1={2} y1={18} x2={42} y2={18} className={styles.conductor} />)}
      {tightest && item("Smallest element margin", <rect x={2} y={16} width={40} height={4} className={styles.tight} />)}
      {breakers &&
        item(
          "Circuit breaker (sizing result)",
          <>
            <line x1={2} y1={18} x2={42} y2={18} className={styles.conductor} />
            <rect x={17} y={13} width={10} height={10} className={styles.box} />
          </>,
        )}
    </ul>
  );
}
