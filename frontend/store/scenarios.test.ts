import { describe, expect, it } from "vitest";
import { toProjectFile } from "./projectFile";
import { fromProjectFile, initialState, projectReducer, type ProjectAction } from "./reducer";

const created: ProjectAction = {
  type: "projectCreated",
  meta: { id: "p1", name: "Test", created_at: "2026-11-01T00:00:00Z" },
  nominal_voltage_kv: 0.4,
  nominal_frequency_hz: 50,
};

describe("Scenarios (S-11, Doc 3 §3.10)", () => {
  it("are added with generated ids, edited and removed without making M1 stale", () => {
    const actions: ProjectAction[] = [created, { type: "scenarioAdded", name: "Base" }, { type: "scenarioAdded", name: "Big" }];
    let s = actions.reduce(projectReducer, initialState);
    const before = s.design;
    s = projectReducer(s, { type: "scenarioUpdated", id: "S2", patch: { overrides: [{ parameter_path: "loads/L1/p_kw", value: 7 }] } });
    expect(s.scenarios.map((x) => [x.id, x.name, x.overrides.length])).toEqual([
      ["S1", "Base", 0],
      ["S2", "Big", 1],
    ]);
    expect(s.design).toBe(before);
    s = projectReducer(s, { type: "scenarioRemoved", id: "S1" });
    expect(s.scenarios.map((x) => x.id)).toEqual(["S2"]);
  });

  it("survive save and load of the Project file", () => {
    const s = [created, { type: "scenarioAdded", name: "Base" } as ProjectAction].reduce(projectReducer, initialState);
    const f = toProjectFile(s, { schema_version: 1, app_version: "x" }, "2026-11-02T00:00:00Z");
    expect(fromProjectFile(f).scenarios).toEqual(s.scenarios);
  });
});
