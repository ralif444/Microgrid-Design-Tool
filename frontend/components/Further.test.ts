import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../api-types";
import { applyOverrides, numericPaths } from "./Further";

const design: ProjectSnapshot = {
  nominal_voltage_kv: 0.4,
  nominal_frequency_hz: 50,
  buses: [{ id: "B1" }],
  lines: [],
  loads: [{ id: "L1", bus_id: "B1", p_kw: 5, q_kvar: 0 }],
  load_profile: null,
  inverters: [{ id: "INV1", bus_id: "B1", rated_kva: 10, p_setpoint_kw: null }],
  design_constraints: {},
};

describe("Scenario overrides and parameter paths (D-56 K96, K97)", () => {
  it("overrides change only the named field; paths list numeric fields only", () => {
    const out = applyOverrides(design, [{ parameter_path: "loads/L1/p_kw", value: 7 }]);
    expect(out.loads?.[0].p_kw).toBe(7);
    expect(design.loads?.[0].p_kw).toBe(5);
    expect(numericPaths(design)).toEqual(["loads/L1/p_kw", "loads/L1/q_kvar", "inverters/INV1/rated_kva"]);
  });
});
