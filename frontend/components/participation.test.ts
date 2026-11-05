import { describe, expect, it } from "vitest";
import { m4aKpis } from "./kpi";
import { participationRows } from "./participation";
import type { M4aPayload } from "../api-types";

// Doc 12 §8 P8 and Doc 3 §6.8: factors[mode][state]; rows are states grouped per inverter.
describe("participationRows (FR-88)", () => {
  it("transposes factors[mode][state] and groups δ, P_f, Q_f per inverter", () => {
    const rows = participationRows({
      state_names: ["delta/INV2", "p_f/INV1", "p_f/INV2", "q_f/INV1", "q_f/INV2"],
      factors: [
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.6, 0.7, 0.8, 0.9, 1],
      ],
    });
    expect(rows.map((r) => r.label)).toEqual(["δ INV2", "P_f INV2", "Q_f INV2", "P_f INV1", "Q_f INV1"]);
    expect(rows[0]).toEqual({ label: "δ INV2", group: "INV2", values: [0.1, 0.6] });
    expect(rows[3].values).toEqual([0.2, 0.7]);
  });
  it("keeps an unknown state name as given", () => {
    expect(participationRows({ state_names: ["x1"], factors: [[1]] })[0]).toEqual({ label: "x1", group: "other", values: [1] });
  });
});

describe("m4aKpis (FR-87)", () => {
  const p = { stability_class: "STABLE", zeta_min: null, damping_pass: null, dominant_modes: [], outside_definition: false } as unknown as M4aPayload;
  it("shows the damping check only with a threshold and keeps null as null", () => {
    expect(m4aKpis(p, false).map((k) => k.label)).not.toContain("Damping check");
    const k = m4aKpis(p, true);
    expect(k.find((t) => t.label === "Damping check")).toMatchObject({ value: null, detail: "not judged: no oscillatory mode" });
    expect(k.find((t) => t.label === "Stability class")).toMatchObject({ value: "STABLE", icon: "feasible" });
    expect(k.find((t) => t.label === "Dominant mode frequency")).toMatchObject({ value: null, detail: "no dominant mode" });
  });
});
