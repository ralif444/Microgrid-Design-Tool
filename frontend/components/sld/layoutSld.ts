// Single-line diagram layout (Doc 12 X8, FR-94; ADR-013; SLD guideline §3, §4.2). Buses are the only
// layout nodes; elkjs (layered, DOWN, orthogonal) places them and routes the Lines. Inverters (above) and
// Loads (below) are put on their busbar by this module, in the gaps the Lines leave. Isolated Buses go to
// a "Not connected" row under the graph. Same model in, same coordinates out (R4): the model is sorted
// by id, Lines are oriented away from the inverter Buses, and the seed is fixed.
import type { ElkExtendedEdge, ElkNode, ElkPoint } from "elkjs/lib/elk-api";
import type { SldModel } from "./buildSldModel";

export type Pt = { x: number; y: number };
export type BusBox = { id: string; x: number; y: number; w: number; h: number; barY: number; isolated: boolean };
export type Attach = { id: string; busId: string; x: number; barY: number };
export type LineRoute = { id: string; points: Pt[]; mid: Pt };
export type SldLayout = {
  width: number;
  height: number;
  system: { x: number; y: number; w: number; h: number };
  buses: BusBox[];
  inverters: Attach[];
  loads: Attach[];
  lines: LineRoute[];
  /** Caption position of the "Not connected" row, or null when no Bus is isolated. */
  isolatedCaption: Pt | null;
  /** Lines with a missing Bus or both ends on one Bus, and Inverters or Loads on a missing Bus: not
   * drawn, so the renderer lists them (no element silently dropped, R5). */
  unplaced: string[];
};

// Geometry in diagram units (1 unit = 1 px at 100 %), guideline §3
export const BAR_H = 6;
export const SLOT_W = 90; // 70 in guideline §3; 90 so stacked inverter labels clear their neighbour (SLD-3)
export const INV_TIER = 132; // mark, id, rating and two M1 lines above the square 36, stub 20
export const BUS_LABEL = 64; // bus label stack (mark, id, two M1 lines) above a bar without inverters
/** Left end of every bar holds the bus label stack; inverter slots start after it (SLD-3). */
export const LABEL_W = 100;
export const LOAD_TIER = 104; // arrow 30 + head 14 + up to four label lines
const SYSTEM = { w: 240, h: 76 };
const GAP = 40;
const ROW_GAP = 60;

const OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.spacing.nodeNode": "60",
  "elk.layered.spacing.nodeNodeBetweenLayers": "90",
  "elk.spacing.edgeNode": "30",
  "elk.spacing.edgeEdge": "20",
  "elk.randomSeed": "1",
};

type Elk = { layout(g: ElkNode): Promise<ElkNode> };
let elk: Promise<Elk> | null = null;
// loaded on first use, so only the screens that draw the SLD fetch the chunk (ADR-013 decision 1)
const getElk = () => (elk ??= import("elkjs/lib/elk.bundled.js").then((m) => new m.default()));

/** Evenly spread `n` slots on [x1, x2], after dropping the slot nearest each obstacle (a Line's x). */
export function slots(x1: number, x2: number, n: number, obstacles: number[]): number[] {
  const all = Array.from({ length: n + obstacles.length }, (_, k) => x1 + ((k + 1) * (x2 - x1)) / (n + obstacles.length + 1));
  for (const o of [...obstacles].sort((a, b) => a - b)) {
    let best = 0;
    all.forEach((s, k) => (Math.abs(s - o) < Math.abs(all[best] - o) ? (best = k) : null));
    all.splice(best, 1);
  }
  return all;
}

function boxSize(model: SldModel, id: string) {
  const inv = model.inverters.filter((i) => i.busId === id).length;
  const load = model.loads.filter((l) => l.busId === id).length;
  const lines = model.lines.filter((l) => l.from === id || l.to === id).length;
  const top = inv ? INV_TIER : BUS_LABEL;
  const bottom = load ? LOAD_TIER : 10;
  return { w: Math.max(140, LABEL_W + SLOT_W * (Math.max(inv, load) + lines) + 20), top, h: top + BAR_H + bottom };
}

/** BFS hops from the nearest inverter Bus; Buses no source reaches get Infinity. */
function hops(model: SldModel, routable: SldModel["lines"]) {
  const d = new Map(model.buses.map((b) => [b.id, Infinity]));
  const queue = model.buses.filter((b) => model.inverters.some((i) => i.busId === b.id)).map((b) => b.id);
  queue.forEach((id) => d.set(id, 0));
  for (let k = 0; k < queue.length; k++) {
    for (const l of routable) {
      const next = l.from === queue[k] ? l.to! : l.to === queue[k] ? l.from! : null;
      if (next && d.get(next) === Infinity) {
        d.set(next, d.get(queue[k])! + 1);
        queue.push(next);
      }
    }
  }
  return d;
}

export async function layoutSld(model: SldModel): Promise<SldLayout> {
  const busIds = new Set(model.buses.map((b) => b.id));
  const routable = model.lines.filter((l) => l.from && l.to && l.from !== l.to && busIds.has(l.from) && busIds.has(l.to));
  const unplaced = [
    ...model.lines.filter((l) => !routable.includes(l)),
    ...[...model.inverters, ...model.loads].filter((e) => !busIds.has(e.busId ?? "")),
  ].map((e) => e.id);
  const isolated = new Set(model.isolated);
  const graphBuses = model.buses.filter((b) => !isolated.has(b.id));
  const size = new Map(model.buses.map((b) => [b.id, boxSize(model, b.id)]));
  const d = hops(model, routable);
  // sources first, then by distance, then id: the model order ELK keeps (§4.2 layering hint)
  const order = [...graphBuses].sort((a, b) => d.get(a.id)! - d.get(b.id)! || (a.id < b.id ? -1 : 1));
  const edges: ElkExtendedEdge[] = routable.map((l) => {
    const flip = d.get(l.to!)! < d.get(l.from!)!;
    return { id: l.id, sources: [flip ? l.to! : l.from!], targets: [flip ? l.from! : l.to!] };
  });
  const graph: ElkNode = {
    id: "root",
    layoutOptions: OPTIONS,
    children: order.map((b) => ({ id: b.id, width: size.get(b.id)!.w, height: size.get(b.id)!.h })),
    edges,
  };
  const out = graphBuses.length ? await (await getElk()).layout(graph) : { children: [], edges: [], width: 0, height: 0 };

  const top = SYSTEM.h + GAP;
  const boxes = new Map<string, BusBox>();
  for (const n of out.children ?? []) {
    const s = size.get(n.id)!;
    boxes.set(n.id, { id: n.id, x: n.x!, y: n.y! + top, w: s.w, h: s.h, barY: n.y! + top + s.top + BAR_H / 2, isolated: false });
  }
  const graphBottom = top + (out.height ?? 0);

  // Line routes: move each end from the box border onto the bar, keeping every segment orthogonal
  const covered = new Map<string, { top: number[]; bottom: number[] }>(model.buses.map((b) => [b.id, { top: [], bottom: [] }]));
  const lines: LineRoute[] = (out.edges as ElkExtendedEdge[]).map((e) => {
    const sec = e.sections![0];
    const pts: Pt[] = [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint].map((p: ElkPoint) => ({ x: p.x, y: p.y + top }));
    const snap = (i: number, j: number, busId: string) => {
      const b = boxes.get(busId)!;
      const p = pts[i];
      if (Math.abs(p.y - b.y) < 1 || Math.abs(p.y - (b.y + b.h)) < 1) {
        covered.get(busId)![p.y < b.barY ? "top" : "bottom"].push(p.x);
        p.y = b.barY;
      } else {
        p.y = b.barY; // side border: the horizontal first segment moves to bar height with it
        pts[j].y = b.barY;
      }
    };
    snap(0, 1, e.sources[0]);
    snap(pts.length - 1, pts.length - 2, e.targets[0]);
    // label at the middle of the longest segment
    let k = 0;
    for (let i = 1; i < pts.length - 1; i++) if (len(pts[i], pts[i + 1]) > len(pts[k], pts[k + 1])) k = i;
    return { id: e.id, points: pts, mid: { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 } };
  });
  lines.sort((a, b) => (a.id < b.id ? -1 : 1));

  // isolated row (FR-14: visibly unconnected), left to right by id
  let x = 0;
  const rowTop = graphBottom + (graphBuses.length ? ROW_GAP : 0) + 24;
  for (const b of model.buses.filter((b) => isolated.has(b.id))) {
    const s = size.get(b.id)!;
    boxes.set(b.id, { id: b.id, x, y: rowTop, w: s.w, h: s.h, barY: rowTop + s.top + BAR_H / 2, isolated: true });
    x += s.w + GAP;
  }

  const place = (list: SldModel["inverters"], tier: "top" | "bottom"): Attach[] =>
    model.buses.flatMap((b) => {
      const box = boxes.get(b.id)!;
      const own = list.filter((e) => e.busId === b.id);
      // a Line on either side counts: a stub in line with a conductor reads as one wire
      const c = covered.get(b.id)!;
      const x1 = tier === "top" ? box.x + LABEL_W : box.x;
      const xs = slots(x1, box.x + box.w, own.length, (tier === "top" ? [...c.top, ...c.bottom] : [...c.bottom, ...c.top]).filter((o) => o > x1));
      return own.map((e, k) => ({ id: e.id, busId: b.id, x: xs[k], barY: box.barY }));
    });

  const buses = model.buses.map((b) => boxes.get(b.id)!);
  const right = Math.max(SYSTEM.w, ...buses.map((b) => b.x + b.w));
  const bottom = Math.max(top, ...buses.map((b) => b.y + b.h));
  return {
    width: right,
    height: bottom,
    system: { x: 0, y: 0, ...SYSTEM },
    buses,
    inverters: place(model.inverters, "top"),
    loads: place(model.loads, "bottom"),
    lines,
    isolatedCaption: isolated.size ? { x: 0, y: rowTop - 10 } : null,
    unplaced,
  };
}

const len = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
