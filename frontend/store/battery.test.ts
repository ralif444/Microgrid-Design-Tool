import { describe, expect, it } from "vitest";
import type { BatteryBank } from "../api-types";
import { toProjectFile } from "./projectFile";
import { initialState, projectReducer, type ProjectAction, type ProjectState } from "./reducer";

// Battery round BESS-2 (Doc 12 FR-75; D-106 K304, K306; D-108). Fictitious TEST ONLY module.
const run = (actions: ProjectAction[], s: ProjectState = initialState) => actions.reduce(projectReducer, s);
const V = { schema_version: 1, app_version: "0.1.0" };
const bank = (inverter_id: string, ns = 8): BatteryBank => ({
  inverter_id,
  module: { catalog_ref: { entry_id: "MOD-T1", provenance: {}, catalog_schema_version: 1 }, energy_kwh: 5 },
  series_count: ns,
  parallel_count: 2,
  dc_efficiency_ratio: null,
  depth_of_discharge_ratio: null,
  initial_soc_ratio: 1,
});
const base = run([
  { type: "projectCreated", meta: { id: "p", name: "T", created_at: "2026-11-12T00:00:00Z" }, nominal_voltage_kv: 0.4, nominal_frequency_hz: 50 },
  { type: "rowAdded", collection: "buses", row: { id: "B1" } },
  { type: "rowAdded", collection: "inverters", row: { bus_id: "B1" } },
  { type: "rowAdded", collection: "inverters", row: { bus_id: "B1" } },
]);

describe("FR-75 battery banks in the store", () => {
  it("one bank per inverter: a second set replaces it; the design is untouched", () => {
    const s = run([{ type: "bankSet", bank: bank("INV1") }, { type: "bankSet", bank: bank("INV1", 10) }], base);
    expect(s.batteryBanks).toEqual([bank("INV1", 10)]);
    expect(s.design).toBe(base.design); // outside the snapshot: nothing becomes stale
    expect(s.unsaved).toBe(true);
  });

  it("removing an inverter removes its bank (D-108)", () => {
    const s = run([{ type: "bankSet", bank: bank("INV1") }, { type: "bankSet", bank: bank("INV2") }, { type: "rowRemoved", collection: "inverters", id: "INV1" }], base);
    expect(s.batteryBanks.map((b) => b.inverter_id)).toEqual(["INV2"]);
  });

  it("the file carries battery_banks only when a bank exists, and loads it back", () => {
    expect("battery_banks" in toProjectFile(base, V, "t")).toBe(false);
    const f = toProjectFile(run([{ type: "bankSet", bank: bank("INV2") }], base), V, "t");
    expect(f.battery_banks).toEqual([bank("INV2")]);
    expect(run([{ type: "projectLoaded", file: f }]).batteryBanks).toEqual([bank("INV2")]);
  });

});
