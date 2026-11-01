import { describe, expect, it } from "vitest";
import type { PsPayload, RunRecord } from "../api-types";
import {
  adviceInputHash,
  initialState,
  nextLoadId,
  projectReducer,
  type ProjectAction,
  type ProjectState,
  type PsParameters,
} from "./reducer";

const run = (actions: ProjectAction[], s: ProjectState = initialState) => actions.reduce(projectReducer, s);

const created: ProjectAction = {
  type: "projectCreated",
  meta: { id: "p1", name: "Test", created_at: "2026-11-01T00:00:00Z" },
  nominal_voltage_kv: 0.4,
  nominal_frequency_hz: 50,
};

const PS: PsParameters = {
  inverter_margin_ratio: 0.2,
  unit_count: 2,
  redundancy: 0,
  autonomy_h: null,
  dc_efficiency_ratio: null,
  depth_of_discharge_ratio: null,
};

describe("projectReducer", () => {
  it("adds a RunRecord without mutating the previous state", () => {
    const rec = { record_id: "r1" } as unknown as RunRecord;
    const next = projectReducer(initialState, { type: "runRecordAdded", record: rec });
    expect(next.runRecords).toEqual([rec]);
    expect(initialState.runRecords).toEqual([]);
  });

  it("FR-01 new project is empty", () => {
    const s = run([created]);
    const d = s.design;
    expect([d.buses, d.lines, d.loads, d.inverters, s.runRecords]).toEqual([[], [], [], [], []]);
    expect(s.project?.name).toBe("Test");
    expect(d.nominal_voltage_kv).toBe(0.4);
  });

  it("FR-03 load rows are added, edited and removed with generated ids", () => {
    const s = run([
      created,
      { type: "busAdded", id: "B1" },
      { type: "loadAdded", busId: "B1" },
      { type: "loadAdded", busId: "B1" },
      { type: "loadUpdated", id: "L1", patch: { p_kw: 5, q_kvar: 1 } },
      { type: "loadRemoved", id: "L2" },
    ]);
    expect(s.design.loads).toEqual([{ id: "L1", bus_id: "B1", p_kw: 5, q_kvar: 1 }]);
    expect(s.unsaved).toBe(true);
    expect(nextLoadId([{ id: "L1" }, { id: "L7" }])).toBe("L8");
  });

  it("FR-08 advice is not design data; skip and accept leave the design unchanged; load edit makes it stale", async () => {
    const base = run([created, { type: "busAdded", id: "B1" }, { type: "loadAdded", busId: "B1" }]);
    const advice = {
      id: "a1",
      created_at: "2026-11-01T00:00:00Z",
      input_hash: await adviceInputHash(base.design, PS),
      ps_parameters: PS,
      state: "PROPOSED" as const,
      result: {} as PsPayload,
    };
    const proposed = run([{ type: "adviceAdded", advice }], base);
    for (const state of ["ACCEPTED", "SKIPPED"] as const) {
      const s = run([{ type: "adviceDecided", id: "a1", state }], proposed);
      expect(s.sizingAdvice[0].state).toBe(state);
      expect(s.design).toEqual(base.design);
    }
    expect(await adviceInputHash(proposed.design, PS)).toBe(advice.input_hash);
    const edited = run([{ type: "loadUpdated", id: "L1", patch: { p_kw: 3 } }], proposed);
    expect(await adviceInputHash(edited.design, PS)).not.toBe(advice.input_hash);
    expect(await adviceInputHash(proposed.design, { ...PS, unit_count: 3 })).not.toBe(advice.input_hash);
  });
});
