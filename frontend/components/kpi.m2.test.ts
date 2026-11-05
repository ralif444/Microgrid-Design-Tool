import { describe, expect, it } from "vitest";
import type { M2Payload } from "../api-types";
import { m2Kpis } from "./kpi";

// Doc 12 X2 (FR-87): S-08 tiles are read, selected or counted from the payload, never computed.
const c = (element_id: string, margin: number, normalised_margin: number) =>
  ({ element_id, kind: "BUS_VOLTAGE_MIN", value: 1, limit: 1, margin, normalised_margin, unit: "pu" }) as M2Payload["constraint_margins"][number];
const p = (over: Partial<M2Payload>): M2Payload =>
  ({
    verdict: "INFEASIBLE",
    constraint_margins: [c("B1", -0.1, -0.1), c("B2", 0.2, 0.3), c("B3", -0.05, -0.02)],
    not_evaluated: [{ element_id: "LN1", kind: "LINE_CURRENT" }],
    loadability: { lambda_c: null, lambda_s: 1.2, lambda_ub: null, resolution: 0.005, grid_step: 0.05, stop_reason: "x" },
    sizing_check: {},
    ...over,
  }) as unknown as M2Payload;
const tile = (k: ReturnType<typeof m2Kpis>, label: string) => k.find((t) => t.label === label)!;

describe("m2Kpis (FR-87)", () => {
  it("counts violations and not-evaluated items, picks the tightest margin", () => {
    const k = m2Kpis(p({}));
    expect(tile(k, "Verdict")).toMatchObject({ value: "INFEASIBLE", icon: "misuse" });
    expect(tile(k, "Violated constraints").value).toBe(2);
    expect(tile(k, "Tightest constraint")).toMatchObject({ value: -0.1, detail: "normalised margin; Bus voltage, lower limit, B1" });
    expect(tile(k, "Not evaluated").value).toBe(1);
  });
  it("keeps null λ as null and an empty margin list as no tightest constraint", () => {
    const k = m2Kpis(p({ constraint_margins: [], verdict: "FEASIBLE" }));
    expect(tile(k, "Constraint loadability λ_c").value).toBeNull();
    expect(tile(k, "λ_s")).toMatchObject({ value: 1.2, detail: "solution-existence diagnostic, not a stability limit; resolution 0.005" });
    expect(tile(k, "Tightest constraint")).toMatchObject({ value: null, detail: "no evaluated constraint" });
    expect(tile(k, "Violated constraints").value).toBe(0);
    expect(tile(k, "Verdict").icon).toBe("feasible");
  });
});
