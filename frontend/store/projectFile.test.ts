import { describe, expect, it } from "vitest";
import type { ProjectFile, RunRecord } from "../api-types";
import { toProjectFile } from "./projectFile";
import { initialState, projectReducer, type ProjectAction, type ProjectState } from "./reducer";

const run = (actions: ProjectAction[], s: ProjectState = initialState) => actions.reduce(projectReducer, s);
const V = { schema_version: 1, app_version: "0.1.0" };

const FILE: ProjectFile = {
  schema_version: 1,
  app_version: "0.1.0",
  project: {
    id: "p1",
    name: "Fixture",
    description: null,
    created_at: "2026-11-01T00:00:00Z",
    modified_at: "2026-11-01T01:00:00Z",
    nominal_voltage_kv: 0.4,
    nominal_frequency_hz: 50,
  },
  buses: [{ id: "B1", name: null }] as ProjectFile["buses"],
  lines: [],
  loads: [{ id: "L1", bus_id: "B1", p_kw: 10, q_kvar: 2 }] as ProjectFile["loads"],
  inverters: [],
  load_profile: null,
  design_constraints: { v_min_pu: 0.95 } as ProjectFile["design_constraints"],
  sizing_advice: [],
  scenarios: [],
  run_records: [{ record_id: "r1" }],
};

describe("Project file", () => {
  it("FR-54 a saved file carries schema_version and the nominal values in project", () => {
    const s = run([
      {
        type: "projectCreated",
        meta: { id: "p1", name: "T", created_at: "2026-11-01T00:00:00Z" },
        nominal_voltage_kv: 0.4,
        nominal_frequency_hz: 50,
      },
    ]);
    const f = toProjectFile(s, V, "2026-11-01T02:00:00Z");
    expect(f.schema_version).toBe(1);
    expect(f.project.nominal_voltage_kv).toBe(0.4);
    expect(f.project.modified_at).toBe("2026-11-01T02:00:00Z");
    expect(f.scenarios).toEqual([]);
  });

  it("FR-55 load then save gives the same document", () => {
    const s = run([{ type: "projectLoaded", file: FILE }]);
    expect(s.unsaved).toBe(false);
    expect(toProjectFile(s, V, FILE.project.modified_at)).toEqual(FILE);
  });

  it("save clears unsaved and sets modified_at; an imported record marks unsaved", () => {
    let s = run([{ type: "projectLoaded", file: FILE }, { type: "projectUpdated", name: "X" }]);
    expect(s.unsaved).toBe(true);
    s = projectReducer(s, { type: "projectSaved", modified_at: "2026-11-02T00:00:00Z" });
    expect(s.unsaved).toBe(false);
    expect(s.project?.modified_at).toBe("2026-11-02T00:00:00Z");
    s = projectReducer(s, { type: "runRecordImported", record: { record_id: "r2" } as RunRecord });
    expect(s.runRecords.map((r) => r.record_id)).toEqual(["r1", "r2"]);
    expect(s.unsaved).toBe(true);
  });
});
