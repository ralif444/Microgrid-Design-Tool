import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LimitingConstraint, M1Payload, M2Payload, ProjectSnapshot } from "../../api-types";
import { num } from "../format";
import { buildSldModel, type SldElement } from "./buildSldModel";

// Doc 12 X8 (FR-94, FR-95): the SLD model copies values verbatim and computes nothing.
const file = JSON.parse(readFileSync(new URL("../../public/examples/d2.mgproj.json", import.meta.url), "utf-8"));
const D2: ProjectSnapshot = {
  nominal_voltage_kv: file.project.nominal_voltage_kv,
  nominal_frequency_hz: file.project.nominal_frequency_hz,
  buses: file.buses,
  lines: file.lines,
  loads: file.loads,
  inverters: file.inverters,
  design_constraints: file.design_constraints,
};
const section = (e: SldElement, t: string) => e.sections.find((s) => s.title === t)!;
const value = (e: SldElement, t: string, label: string) => section(e, t).rows.find((r) => r.label === label);
const lc = (element_id: string, margin: number, normalised_margin: number): LimitingConstraint => ({
  element_id,
  kind: "INVERTER_LOADING",
  value: 0.5,
  limit: 1,
  margin,
  normalised_margin,
  unit: "ratio",
});

describe("SLD model (FR-94, FR-95)", () => {
  it("lists every element once, sorted by id, with values copied verbatim and units", () => {
    const m = buildSldModel({ design: D2 });
    for (const [kind, list] of [["buses", D2.buses], ["lines", D2.lines], ["loads", D2.loads], ["inverters", D2.inverters]] as const) {
      const ids = (list ?? []).map((x) => x.id!).sort();
      expect(m[kind].map((e) => e.id)).toEqual(ids);
    }
    const inv = D2.inverters![0];
    const el = m.inverters.find((e) => e.id === inv.id)!;
    expect(value(el, "Design data", "Rating")).toEqual({ label: "Rating", value: String(num(inv.rated_kva!)), unit: "kVA" });
    expect(el.label).toBe(`Inverter ${inv.id} at bus ${inv.bus_id}, rated ${num(inv.rated_kva!)} kVA`);
    const line = D2.lines![0];
    expect(value(m.lines.find((e) => e.id === line.id)!, "Design data", "Length")).toMatchObject({ value: String(num(line.length_km!)), unit: "km" });
  });

  it("has no results without a current M1, and never a derived total", () => {
    const m = buildSldModel({ design: D2 });
    const bus = m.buses[0];
    expect(section(bus, "Results")).toEqual({ title: "Results", rows: [], empty: "No current power-flow result" });
    expect(bus.tags).toEqual([bus.id]);
    expect(section(m.system, "Checks").empty).toBe("No current constraint check");
    // R1: no R = r·len on the client; R and X only when the server wrote them
    const l = m.lines[0];
    expect(value(l, "Design data", "R (server)")).toBeUndefined();
    const withR = buildSldModel({ design: { ...D2, lines: [{ ...D2.lines![0], r_ohm: 0.123 }] } });
    expect(value(withR.lines[0], "Design data", "R (server)")).toMatchObject({ value: "0.123", unit: "Ω" });
  });

  it("adds M1 labels and rows from the payload", () => {
    const b = D2.buses![0].id!;
    const i = D2.inverters![0].id!;
    const m1 = {
      system_frequency_hz: 49.9,
      total_load_kw: 1,
      total_load_kvar: 0,
      total_losses_kw: 0,
      epsilon_x_ratio: 0,
      bus_results: [{ bus_id: b, voltage_kv: 0.39, voltage_pu: 0.975, angle_deg: -1.5 }],
      inverter_results: [{ inverter_id: i, p_kw: 3, q_kvar: 1, s_kva: 3.2, loading_ratio: 0.82 }],
      line_results: [],
      sharing: [],
    } as unknown as M1Payload;
    const m = buildSldModel({ design: D2, m1 });
    expect(m.buses.find((e) => e.id === b)!.tags).toEqual([b, "0.9750 p.u.", "-1.50 °"]); // result decimals (W1)
    expect(m.inverters.find((e) => e.id === i)!.tags).toContain("loading 0.820");
    expect(value(m.system, "Results", "System frequency")).toMatchObject({ value: "49.9", unit: "Hz" });
    // an element the run does not cover
    const other = m.buses.find((e) => e.id !== b)!;
    expect(section(other, "Results").empty).toBe("Not in this power-flow result");
  });

  it("keeps a Load's reactive spec as entered and marks unset optional values with a reason", () => {
    const design: ProjectSnapshot = {
      ...D2,
      loads: [
        { id: "LQ", bus_id: "B1", p_kw: 2, q_kvar: 0.5 },
        { id: "LP", bus_id: "B1", p_kw: 2, power_factor: 0.9, pf_direction: "LAGGING" },
      ],
      inverters: [{ ...D2.inverters![0], p_setpoint_kw: null, tau_p_s: null }],
    };
    const m = buildSldModel({ design });
    const [lp, lq] = m.loads;
    expect(lq.tags).toEqual(["LQ", "2 kW", "0.5 kvar"]);
    expect(value(lq, "Design data", "Power factor")).toBeUndefined();
    expect(lp.tags).toEqual(["LP", "2 kW", "pf 0.9 LAGGING"]);
    expect(value(lp, "Design data", "Q")).toBeUndefined();
    const inv = m.inverters[0];
    expect(value(inv, "Design data", "P setpoint")).toEqual({ label: "P setpoint", value: "0", unit: "kW", note: "not set" });
    expect(value(inv, "Design data", "τ_P filter")).toEqual({ label: "τ_P filter", value: "—", unit: "s", note: "not set, needed for stability analyses" });
  });

  it("lists isolated buses, and the topology key ignores value edits and input order", () => {
    const design = { ...D2, buses: [...D2.buses!, { id: "B9" }] };
    const m = buildSldModel({ design });
    expect(m.isolated).toEqual(["B9"]);
    expect(m.buses.find((e) => e.id === "B9")!.label).toMatch(/not connected$/);
    const edited = buildSldModel({ design: { ...design, loads: design.loads!.map((l) => ({ ...l, p_kw: 99 })) } });
    expect(edited.topologyKey).toBe(m.topologyKey);
    const shuffled = buildSldModel({ design: { ...design, buses: [...design.buses].reverse(), lines: [...design.lines!].reverse() } });
    expect(shuffled).toEqual(m);
  });

  it("marks M2 elements by the S-08 rules and lists not-evaluated checks", () => {
    const [a, b, c] = ["INV1", "INV2", "LN1"];
    const payload = {
      verdict: "INFEASIBLE",
      constraint_margins: [lc(a, -0.1, -0.1), lc(b, 0.02, 0.02), lc(c, 0.5, 0.5)],
      not_evaluated: [{ kind: "BUS_VOLTAGE_MIN", element_id: "B1" }],
      sizing_check: { per_inverter: [], per_line: [] },
    } as unknown as M2Payload;
    const design = { ...D2, inverters: [{ ...D2.inverters![0], id: a }, { ...D2.inverters![0], id: b }] };
    const m = buildSldModel({ design, m2: { payload, limiting: [lc(c, 0.5, 0.5)] }, marginWarn: 0.05 });
    expect(m.inverters.map((e) => e.mark)).toEqual(["violated", "near"]);
    expect(m.lines.find((e) => e.id === c)?.mark).toBe("limiting");
    expect(section(m.inverters[0], "Checks").rows[0].note).toMatch(/^violated; limit 1 ratio, margin -0.1 ratio$/);
    expect(value(m.buses.find((e) => e.id === "B1")!, "Checks", "Bus voltage, lower limit")).toMatchObject({ value: "—", note: "not evaluated: no limit set" });
    expect(value(m.system, "Checks", "Verdict")?.value).toBe("INFEASIBLE");
  });

  it("W3: a passing element is marked pass, the smallest element margin is marked once, loading is copied", () => {
    const bus = D2.buses![0].id!;
    const inv = D2.inverters![0].id!;
    const payload = {
      verdict: "FEASIBLE",
      // SYSTEM is tighter but has no element to mark
      constraint_margins: [lc("SYSTEM", 0.01, 0.01), lc(bus, 0.9, 0.9), lc(inv, 0.3, 0.3)],
      not_evaluated: [],
      sizing_check: { per_inverter: [], per_line: [] },
    } as unknown as M2Payload;
    const m1 = { bus_results: [], inverter_results: [{ inverter_id: inv, p_kw: 1, q_kvar: 0, s_kva: 1, loading_ratio: 0.235 }], line_results: [] } as unknown as M1Payload;
    const m = buildSldModel({ design: D2, m1, m2: { payload, limiting: [] }, marginWarn: 0.05 });
    expect(m.buses.find((e) => e.id === bus)?.mark).toBe("pass");
    const all = [...m.buses, ...m.inverters, ...m.lines];
    expect(all.filter((e) => e.tightest).map((e) => e.id)).toEqual([inv]);
    expect(m.inverters.find((e) => e.id === inv)?.loading).toBe(0.235);
    expect(m.lines.every((e) => e.mark === null)).toBe(true); // no own constraint: no mark
  });

  it("attaches validation issues to the element they name", () => {
    const bus = D2.buses![0].id!;
    const m = buildSldModel({
      design: D2,
      issues: [{ code: "ISOLATED_BUS", level: "entity", entity: "Bus", id: bus, message: "Bus is not connected." }],
    });
    const el = m.buses.find((e) => e.id === bus)!;
    expect(el.issues).toEqual(["Bus is not connected."]);
    expect(section(el, "Issues").rows).toEqual([{ label: "Issue", value: "Bus is not connected." }]);
    expect(m.buses.filter((e) => e.issues.length)).toHaveLength(1);
  });
});
