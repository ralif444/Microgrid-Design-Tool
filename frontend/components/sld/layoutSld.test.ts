import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../../api-types";
import { buildSldModel } from "./buildSldModel";
import { radial, SLD_FIXTURES } from "./fixtures";
import { layoutSld, slots, type SldLayout } from "./layoutSld";

// Doc 12 X8 (FR-94): deterministic layout, no overlap, every Line routed, isolated row, meshed loop.
const example = (name: string): ProjectSnapshot => {
  const f = JSON.parse(readFileSync(new URL(`../../public/examples/${name}.mgproj.json`, import.meta.url), "utf-8"));
  return { buses: f.buses, lines: f.lines, loads: f.loads, inverters: f.inverters };
};
const ALL: Record<string, ProjectSnapshot> = { ...SLD_FIXTURES, D1: example("d1"), D2: example("d2"), D2S: example("d2s"), D2H: example("d2h") };
const lay = (d: ProjectSnapshot) => layoutSld(buildSldModel({ design: d }));
const overlap = (a: SldLayout["buses"][number], b: SldLayout["buses"][number]) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const shuffle = <T,>(xs: T[] | undefined) => [...(xs ?? [])].reverse();

describe("SLD layout (FR-94)", () => {
  for (const [name, design] of Object.entries(ALL)) {
    it(`${name}: no overlap, every Line routed orthogonally from bar to bar`, async () => {
      const L = await lay(design);
      expect(L.buses).toHaveLength(design.buses!.length);
      for (const [i, a] of L.buses.entries()) for (const b of L.buses.slice(i + 1)) expect(overlap(a, b), `${a.id}/${b.id}`).toBe(false);
      expect(L.lines.map((l) => l.id).sort()).toEqual(design.lines!.map((l) => l.id).sort());
      const box = new Map(L.buses.map((b) => [b.id, b]));
      for (const r of L.lines) {
        for (let k = 1; k < r.points.length; k++) {
          const [p, q] = [r.points[k - 1], r.points[k]];
          expect(p.x === q.x || p.y === q.y, `${r.id} segment ${k}`).toBe(true);
        }
        const src = design.lines!.find((l) => l.id === r.id)!;
        const ends = [r.points[0], r.points.at(-1)!];
        const bars = [box.get(src.from_bus_id!)!, box.get(src.to_bus_id!)!];
        // each end sits on one of its two busbars, within the bar's width
        for (const p of ends) expect(bars.some((b) => p.y === b.barY && p.x >= b.x && p.x <= b.x + b.w), `${r.id} end`).toBe(true);
      }
      expect(L.inverters).toHaveLength(design.inverters!.length);
      expect(L.loads).toHaveLength(design.loads!.length);
      expect(L.unplaced).toEqual([]);
    });
  }

  it("gives identical coordinates for shuffled input", async () => {
    const d = SLD_FIXTURES["meshed 4-bus loop"];
    const again = { buses: shuffle(d.buses), lines: shuffle(d.lines), loads: shuffle(d.loads), inverters: shuffle(d.inverters) };
    expect(await lay(again)).toEqual(await lay(d));
  });

  it("puts inverter Buses on top and isolated Buses in the Not connected row", async () => {
    const L = await lay(SLD_FIXTURES["isolated bus"]);
    const y = Object.fromEntries(L.buses.map((b) => [b.id, b]));
    expect(y.B1.barY).toBeLessThan(y.B2.barY);
    expect(y.B9.isolated).toBe(true);
    expect(y.B9.y).toBeGreaterThan(y.B2.y + y.B2.h);
    expect(L.isolatedCaption!.y).toBeLessThan(y.B9.y);
    expect((await lay(SLD_FIXTURES["radial 3-bus"])).isolatedCaption).toBeNull();
  });

  it("lists elements it cannot place instead of dropping them", async () => {
    const L = await lay({ buses: [{ id: "B1" }], lines: [{ id: "LN1", from_bus_id: "B1", to_bus_id: "B7" }], loads: [{ id: "L1", bus_id: "B7" }] });
    expect(L.unplaced).toEqual(["LN1", "L1"]);
    expect(L.buses[0].isolated).toBe(true);
  });

  it("spreads attachments evenly and keeps them off a Line's position", () => {
    expect(slots(0, 300, 2, [])).toEqual([100, 200]);
    expect(slots(0, 400, 2, [100])).toEqual([200, 300]);
    expect(slots(0, 100, 0, [50])).toEqual([]);
  });

  it("lays out 50 Buses and 60 Lines within the size target", async () => {
    const big = radial(50, 11);
    expect(big.lines).toHaveLength(60);
    await lay(big); // first call loads elkjs
    const t = performance.now();
    const L = await lay(big);
    const ms = performance.now() - t;
    console.log(`SLD layout, 50 buses / 60 lines: ${ms.toFixed(0)} ms`);
    expect(L.lines).toHaveLength(60);
    expect(ms).toBeLessThan(300); // guideline §9
  });
});
