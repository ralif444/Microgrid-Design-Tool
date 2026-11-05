import { describe, expect, it } from "vitest";
import type { M1Payload } from "../api-types";
import { m1Kpis, pick } from "./kpi";

// Doc 12 X2 (FR-87): KPI selectors only select and count.
const base = {
  system_frequency_hz: 50,
  total_load_kw: 3,
  total_load_kvar: 1,
  total_losses_kw: 0.1,
  iterations: 4,
  epsilon_x_ratio: 0,
  sharing: [],
  line_results: [],
} as unknown as M1Payload;

describe("KPI selectors (FR-87)", () => {
  it("pick returns the smallest or largest row, and null for none", () => {
    const rows = [{ v: 2 }, { v: 1 }, { v: 3 }];
    expect(pick(rows, (r) => r.v)).toEqual({ v: 1 });
    expect(pick(rows, (r) => r.v, -1)).toEqual({ v: 3 });
    expect(pick([] as { v: number }[], (r) => r.v)).toBeNull();
  });

  it("M1 tiles name the bus and inverter they come from", () => {
    const p = {
      ...base,
      bus_results: [
        { bus_id: "B1", voltage_pu: 1.01 },
        { bus_id: "B2", voltage_pu: 0.97 },
      ],
      inverter_results: [
        { inverter_id: "INV1", loading_ratio: 0.4 },
        { inverter_id: "INV2", loading_ratio: 0.7 },
      ],
    } as unknown as M1Payload;
    const k = Object.fromEntries(m1Kpis(p).map((t) => [t.label, t]));
    expect(k["Lowest bus voltage"]).toMatchObject({ value: 0.97, detail: "B2", unit: "p.u." });
    expect(k["Highest bus voltage"]).toMatchObject({ value: 1.01, detail: "B1" });
    expect(k["Highest inverter loading"]).toMatchObject({ value: 0.7, detail: "INV2" });
    expect(k["System frequency"]).toMatchObject({ value: 50, unit: "Hz" });
  });

  it("an empty result list gives a missing value, never zero", () => {
    const k = m1Kpis({ ...base, bus_results: [], inverter_results: [] } as unknown as M1Payload);
    expect(k.find((t) => t.label === "Lowest bus voltage")?.value).toBeNull();
    expect(k.find((t) => t.label === "Highest inverter loading")?.value).toBeNull();
  });
});
