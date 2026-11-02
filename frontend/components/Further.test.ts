import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../api-types";
import { applyOverrides, nMinus1, numericPaths, shortcutPrefill } from "./Further";

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

describe("Static N−1 check (Doc 12 FR-80)", () => {
  it("sends the base plus one snapshot per removed inverter", () => {
    const three = { ...design, inverters: ["A", "B", "C"].map((id) => ({ id, bus_id: "B1", rated_kva: 10 })) };
    const out = nMinus1(three);
    expect(out.map((s) => s.label)).toEqual(["Base design", "Without A", "Without B", "Without C"]);
    expect(out[2].project_snapshot.inverters?.map((i) => i.id)).toEqual(["A", "C"]);
    expect(three.inverters).toHaveLength(3);
  });
});

describe("Limiting-constraint shortcut (Doc 12 FR-84)", () => {
  it("pre-fills inverter ratings and droops, R and X of the limiting line, and the matching metric", () => {
    const d = {
      ...design,
      lines: [{ id: "LN1", from_bus_id: "B1", to_bus_id: "B1", r_ohm_per_km: 0.5, x_ohm_per_km: 0.3, length_km: 1 }],
      inverters: [{ id: "INV1", bus_id: "B1", rated_kva: 10, frequency_droop_hz_per_kw: 0.01, voltage_droop_kv_per_kvar: 0.001 }],
    };
    expect(shortcutPrefill(d, "LINE_CURRENT", "LN1")).toEqual({
      paths: ["lines/LN1/r_ohm_per_km", "lines/LN1/x_ohm_per_km", "inverters/INV1/rated_kva", "inverters/INV1/frequency_droop_hz_per_kw", "inverters/INV1/voltage_droop_kv_per_kvar"],
      metric: "MAX_LINE_CURRENT",
    });
    expect(shortcutPrefill(d, "INVERTER_LOADING", "INV1")?.paths).not.toContain("lines/LN1/r_ohm_per_km");
    expect(shortcutPrefill(d, "POWER_BALANCE", "SYSTEM")).toBeNull();
  });
});
