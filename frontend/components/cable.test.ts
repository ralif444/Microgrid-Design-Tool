import { describe, expect, it } from "vitest";
import type { RunRecord } from "../api-types";
import { breakerMarks, catalogueMatch, EMPTY_SETTINGS, factorSources, m2Ref, settingsBody, type CbElement, type CbPayload } from "./cable";

const cable = {
  conductor: "AL",
  insulation: "XLPE",
  method: "D_DUCT",
  size_mm2: 10,
  i_tab_a: 100,
  k_theta: 1,
  k_rho: 1,
  k_g: 1,
  lookup_values: { temp_c_used: 20, rho_used: 2, group_used: 1 },
  iz_a: 100,
};
const tables = {
  ampacity: [
    { table: "T-PVC", page: "1", insulation: "PVC", conductor: "CU", method: "B1", loaded_conductors: 3 },
    { table: "T-XLPE", page: "2", insulation: "XLPE", conductor: "AL", method: "D_DUCT", loaded_conductors: 3 },
  ],
  k_theta_air: { table: "AIR", page: "3" },
  k_theta_ground: { table: "GROUND", page: "4" },
  k_rho: { table: "RHO", page: "5" },
  k_group: { "A.52-17": { page: "6" }, "A.52-19A": { page: "7" }, "A.52-19B": { page: "8" } },
};

describe("FR-112 S-19 helpers", () => {
  it("sends only the fields entered, soil resistivity only for method D", () => {
    expect(settingsBody(EMPTY_SETTINGS)).toEqual({});
    const s = { ...EMPTY_SETTINGS, method: "B1", ambient_temp_c: 30, soil_resistivity_k_m_per_w: 2 };
    expect(settingsBody(s)).toEqual({ method: "B1", ambient_temp_c: 30 });
    expect(settingsBody({ ...s, method: "D_DUCT" })).toEqual({ method: "D_DUCT", ambient_temp_c: 30, soil_resistivity_k_m_per_w: 2 });
  });
  it("names the table and page behind each factor as the method chooses them", () => {
    expect(factorSources(tables, cable, "SINGLE_CORE")).toEqual({ i_tab: "T-XLPE, p. 2", k_theta: "GROUND, p. 4", k_rho: "RHO, p. 5", k_g: "A.52-19B, p. 8" });
    const air = factorSources(tables, { ...cable, conductor: "CU", insulation: "PVC", method: "B1" }, "MULTICORE");
    expect(air).toEqual({ i_tab: "T-PVC, p. 1", k_theta: "AIR, p. 3", k_rho: "none, k_ρ is 1 outside method D", k_g: "A.52-17, p. 6" });
  });
  it("takes the latest M2 only when it is on the current design and FEASIBLE or INFEASIBLE", () => {
    const rec = (status: string, hash = "h") =>
      ({ record_id: status, analysis_type: "M2", snapshot_hash: hash, result_hash: "r", result: { status, payload: {} } }) as unknown as RunRecord;
    expect(m2Ref([rec("INFEASIBLE")], "h")?.record_id).toBe("INFEASIBLE");
    expect(m2Ref([rec("FEASIBLE"), rec("UNAVAILABLE")], "h")).toBeNull();
    expect(m2Ref([rec("FEASIBLE", "old")], "h")).toBeNull();
    expect(m2Ref([rec("FEASIBLE")], null)).toBeNull();
  });
});

describe("FR-113, FR-115 breakers and catalogue match", () => {
  const el = (over: Partial<CbElement> = {}): CbElement => ({
    element_id: "INV1",
    element_kind: "INVERTER_FEEDER",
    ib_a: 14,
    ib_source: "inverter_rated_current",
    device: { class: "MCB", standard: "S", in_a: 20, k2: 1, k2_source: "x", i2_a: 20 },
    cable: { ...cable, conductor: "CU", insulation: "PVC", method: "B1" },
    checks: null,
    r_check: null,
    outcome: "SIZED",
    notes: [],
    ...over,
  });
  const cond = (id: string, size: number, cores = 3, material = "CU") => ({ id, kind: "CONDUCTOR", conductor: { material, insulation: "PVC", cores, size_mm2: size } });
  it("marks sized elements only", () => {
    const p = { elements: [el(), el({ element_id: "LN1", element_kind: "LINE", outcome: "NO_SIZE_FITS", cable: null })] } as CbPayload;
    expect(breakerMarks(p)).toEqual([{ id: "INV1", kind: "inverter", cls: "MCB", in_a: 20, size_mm2: 10, iz_a: 100 }]);
    expect(breakerMarks(null)).toEqual([]);
  });
  it("picks the nearest larger usable cable and the breaker of the same standard and I_n", () => {
    const entries = [cond("C25", 25), cond("C16", 16), cond("C6", 6), cond("AL16", 16, 3, "AL"), cond("SC10", 10, 1), cond("U10", 10), { id: "B", kind: "BREAKER", breaker: { standard: "S", in_a: 20 } }];
    const usable = new Set(["C25", "C16", "C6", "AL16", "SC10", "B"]);
    const m = catalogueMatch(el(), "MULTICORE", entries, usable);
    expect([m.cable?.id, m.breaker?.id]).toEqual(["C16", "B"]);
    expect(catalogueMatch(el(), "SINGLE_CORE", entries, usable).cable?.id).toBe("SC10");
    expect(catalogueMatch(el({ device: { ...el().device, in_a: 25 } }), "MULTICORE", entries, usable).breaker).toBeNull();
  });
});
