import { describe, expect, it } from "vitest";
import type { PsPayload, RunRecord } from "../api-types";
import {
  adviceInputHash,
  initialState,
  latestRun,
  m1Ref,
  nextId,
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
      { type: "rowAdded", collection: "buses", row: { id: "B1" } },
      { type: "rowAdded", collection: "loads", row: { bus_id: "B1", p_kw: null, q_kvar: null } },
      { type: "rowAdded", collection: "loads", row: { bus_id: "B1", p_kw: null, q_kvar: null } },
      { type: "rowUpdated", collection: "loads", id: "L1", patch: { p_kw: 5, q_kvar: 1 } },
      { type: "rowRemoved", collection: "loads", id: "L2" },
    ]);
    expect(s.design.loads).toEqual([{ id: "L1", bus_id: "B1", p_kw: 5, q_kvar: 1 }]);
    expect(s.unsaved).toBe(true);
    expect(nextId("L", [{ id: "L1" }, { id: "L7" }, { id: "LN9" }])).toBe("L8");
  });

  it("FR-08 advice is not design data; skip and accept leave the design unchanged; load edit makes it stale", async () => {
    const base = run([created, { type: "rowAdded", collection: "buses", row: { id: "B1" } }, { type: "rowAdded", collection: "loads", row: { bus_id: "B1", p_kw: null, q_kvar: null } }]);
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
    const edited = run([{ type: "rowUpdated", collection: "loads", id: "L1", patch: { p_kw: 3 } }], proposed);
    expect(await adviceInputHash(edited.design, PS)).not.toBe(advice.input_hash);
    expect(await adviceInputHash(proposed.design, { ...PS, unit_count: 3 })).not.toBe(advice.input_hash);
  });
});

describe("network and constraints", () => {
  it("FR-10 FR-12 FR-13 buses, lines and inverters are added, edited and removed", () => {
    const s = run([
      created,
      { type: "rowAdded", collection: "buses", row: { id: "B1" } },
      { type: "rowAdded", collection: "buses", row: { id: "B2" } },
      { type: "rowUpdated", collection: "buses", id: "B2", patch: { id: "B3" } },
      { type: "rowAdded", collection: "lines", row: { from_bus_id: "B1", to_bus_id: "B3" } },
      { type: "rowUpdated", collection: "lines", id: "LN1", patch: { r_ohm_per_km: 0.1 } },
      { type: "rowAdded", collection: "inverters", row: { bus_id: "B1" } },
      { type: "rowAdded", collection: "inverters", row: { bus_id: "B3" } },
      { type: "rowRemoved", collection: "inverters", id: "INV1" },
    ]);
    expect(s.design.buses).toEqual([{ id: "B1" }, { id: "B3" }]);
    expect(s.design.lines).toEqual([{ id: "LN1", from_bus_id: "B1", to_bus_id: "B3", r_ohm_per_km: 0.1 }]);
    expect(s.design.inverters).toEqual([{ id: "INV2", bus_id: "B3" }]);
  });

  it("FR-15 constraints are stored in the design; an empty field is null", () => {
    const s = run([
      created,
      { type: "constraintSet", field: "voltage_min_pu", value: 0.95 },
      { type: "constraintSet", field: "voltage_min_pu", value: null },
      { type: "constraintSet", field: "frequency_max_hz", value: 50.25 },
    ]);
    expect(s.design.design_constraints).toEqual({ voltage_min_pu: null, frequency_max_hz: 50.25 });
  });

  it("m1Ref picks the latest FEASIBLE M1 record", () => {
    const rec = (id: string, analysis_type: string, status: string) =>
      ({
        record_id: id,
        analysis_type,
        snapshot_hash: `h-${id}`,
        result_hash: `r-${id}`,
        result: { status, payload: { id } },
      }) as unknown as RunRecord;
    expect(m1Ref([])).toBeNull();
    const ref = m1Ref([rec("a", "M1", "FEASIBLE"), rec("b", "M1", "FEASIBLE"), rec("c", "M1", "SOLVER_FAILED"), rec("d", "M2", "FEASIBLE")]);
    expect(ref).toEqual({
      record_id: "b",
      analysis_type: "M1",
      snapshot_hash: "h-b",
      status: "FEASIBLE",
      result_hash: "r-b",
      result_payload: { id: "b" },
    });
  });

  it("latestRun picks the latest record of a type on the current design (FR-93)", () => {
    const rec = (id: string, analysis_type: string, hash: string, status = "FEASIBLE") =>
      ({ record_id: id, analysis_type, snapshot_hash: hash, result: { status } }) as unknown as RunRecord;
    const runs = [rec("a", "M1", "h1"), rec("b", "M1", "h1", "INPUT_INVALID"), rec("c", "M2", "h1"), rec("d", "M1", "h2")];
    expect(latestRun(runs, "M1", "h1")?.record_id).toBe("b"); // any Status
    expect(latestRun(runs, "M1", "h2")?.record_id).toBe("d");
    expect(latestRun(runs, "M1", "h3")).toBeNull(); // design edited after the runs
    expect(latestRun(runs, "M1", null)).toBeNull(); // hash not known yet
    // M3c: its own hash covers the scenarios, so it matches on its M1 reference (Doc 3 §5, §6)
    const m3c = { ...rec("e", "M3c", "h-with-scenarios"), depends_on: { snapshot_hash: "h1" } } as unknown as RunRecord;
    expect(latestRun([m3c], "M3c", "h1")?.record_id).toBe("e");
    expect(latestRun([m3c], "M3c", "h-with-scenarios")).toBeNull();
  });
});

describe("Example Project (Doc 12 FR-85)", () => {
  it("opens as a new unsaved copy and leaves the example file unchanged", () => {
    const file = {
      schema_version: 1,
      app_version: "0.1.0",
      project: { id: "example-d2", name: "Example D2", description: null, created_at: "t0", modified_at: "t0", nominal_voltage_kv: 0.44, nominal_frequency_hz: 50 },
      buses: [{ id: "B1" }],
      lines: [],
      loads: [],
      inverters: [],
      load_profile: null,
      design_constraints: {},
      sizing_advice: [],
      scenarios: [],
      run_records: [],
    };
    const before = JSON.stringify(file);
    const s = projectReducer(initialState, { type: "exampleOpened", file, id: "new", created_at: "t1" });
    expect([s.project?.id, s.project?.name, s.project?.created_at, s.unsaved]).toEqual(["new", "Example D2", "t1", true]);
    expect(s.design.nominal_voltage_kv).toBe(0.44);
    expect(JSON.stringify(file)).toBe(before);
  });
});

describe("FR-02 name and description; FR-11 Bus delete guard", () => {
  it("name and description survive save and reopen", async () => {
    const { toProjectFile } = await import("./projectFile");
    const s = run([created, { type: "projectUpdated", name: "Renamed", description: "Two-bus test" }]);
    const file = toProjectFile(s, { schema_version: 1, app_version: "t" }, "t1");
    const back = run([{ type: "projectLoaded", file }]);
    expect([back.project?.name, back.project?.description]).toEqual(["Renamed", "Two-bus test"]);
  });

  it("a Bus still referenced is kept, and its dependents are named", async () => {
    const { busDependents } = await import("./reducer");
    const s = run([
      created,
      { type: "rowAdded", collection: "buses", row: { id: "B1" } },
      { type: "rowAdded", collection: "buses", row: { id: "B2" } },
      { type: "rowAdded", collection: "lines", row: { from_bus_id: "B1", to_bus_id: "B2" } },
      { type: "rowAdded", collection: "loads", row: { bus_id: "B1" } },
    ]);
    expect(busDependents(s.design, "B1")).toEqual(["LN1", "L1"]);
    expect(run([{ type: "rowRemoved", collection: "buses", id: "B1" }], s).design.buses).toHaveLength(2);
    const freed = run([{ type: "rowRemoved", collection: "lines", id: "LN1" }, { type: "rowRemoved", collection: "buses", id: "B2" }], s);
    expect(freed.design.buses?.map((b) => b.id)).toEqual(["B1"]);
  });
});
