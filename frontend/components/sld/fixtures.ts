// Layout fixtures for the SLD (guideline §10): topology only, no numeric values (layout reads none).
// Used by the layout tests and the /dev/sld gallery; never shipped as example Projects.
import type { ProjectSnapshot } from "../../api-types";

const bus = (id: string) => ({ id });
const line = (id: string, from: string, to: string) => ({ id, from_bus_id: from, to_bus_id: to });
const inv = (id: string, bus_id: string) => ({ id, bus_id });
const load = (id: string, bus_id: string) => ({ id, bus_id });

/** n Buses in a chain from B01, one inverter on B01, one Load on every other Bus. */
export function radial(n: number, extraLines = 0): ProjectSnapshot {
  const ids = Array.from({ length: n }, (_, k) => `B${String(k + 1).padStart(2, "0")}`);
  const chain = ids.slice(1).map((id, k) => line(`LN${String(k + 1).padStart(2, "0")}`, ids[k], id));
  // extra cross-links make the network meshed (for the size target of §9)
  const extra = Array.from({ length: extraLines }, (_, k) => line(`LX${String(k + 1).padStart(2, "0")}`, ids[k], ids[(k * 7 + 5) % n]));
  return {
    buses: ids.map(bus),
    lines: [...chain, ...extra.filter((l) => l.from_bus_id !== l.to_bus_id)],
    inverters: [inv("INV1", ids[0])],
    loads: ids.slice(1).map((id, k) => load(`L${String(k + 1).padStart(2, "0")}`, id)),
  };
}

export const SLD_FIXTURES: Record<string, ProjectSnapshot> = {
  "radial 3-bus": radial(3),
  "2 inverters on one bus": {
    buses: [bus("B1"), bus("B2")],
    lines: [line("LN1", "B1", "B2")],
    inverters: [inv("INV1", "B1"), inv("INV2", "B1")],
    loads: [load("L1", "B2")],
  },
  "meshed 4-bus loop": {
    buses: ["B1", "B2", "B3", "B4"].map(bus),
    lines: [line("LN1", "B1", "B2"), line("LN2", "B2", "B3"), line("LN3", "B3", "B4"), line("LN4", "B4", "B1")],
    inverters: [inv("INV1", "B1"), inv("INV2", "B3")],
    loads: [load("L1", "B2"), load("L2", "B4")],
  },
  "isolated bus": {
    buses: [bus("B1"), bus("B2"), bus("B9")],
    lines: [line("LN1", "B1", "B2")],
    inverters: [inv("INV1", "B1")],
    loads: [load("L1", "B2")],
  },
  "20-bus radial": radial(20),
};
