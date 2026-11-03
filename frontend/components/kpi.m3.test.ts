import { describe, expect, it } from "vitest";
import { m3bKpis, m3dKpis } from "./kpi";
import type { M3bPayload, M3dPayload } from "../api-types";

describe("m3bKpis and m3dKpis (FR-87)", () => {
  it("counts points per Status that occurs and keeps a missing first infeasible value as null", () => {
    const p = { points: [{ status: "FEASIBLE" }, { status: "INFEASIBLE" }, { status: "FEASIBLE" }], first_infeasible_value: null } as unknown as M3bPayload;
    expect(m3bKpis(p, "kVA").map((k) => [k.label, k.value, k.unit])).toEqual([
      ["Points", 3, "count"],
      ["First infeasible value", null, "kVA"],
      ["Points FEASIBLE", 2, "count"],
      ["Points INFEASIBLE", 1, "count"],
    ]);
    expect(m3bKpis(p, "kVA")[1].detail).toBe("none in range");
  });
  it("reads the feasible fraction as given (ratio, no conversion)", () => {
    const k = m3dKpis({ grid: [{ status: "SOLVER_FAILED" }], feasible_fraction: 0 } as unknown as M3dPayload);
    expect(k[0]).toMatchObject({ label: "Feasible fraction", value: 0, unit: "ratio" });
    expect(k.map((t) => t.label)).toEqual(["Feasible fraction", "Points", "Points SOLVER_FAILED"]);
  });
});
