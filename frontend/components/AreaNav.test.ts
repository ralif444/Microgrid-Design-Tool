import { describe, expect, it } from "vitest";
import type { RunRecord, ValidationReport } from "../api-types";
import { initialState, type ProjectState } from "../store";
import { statusIcon, TOKEN_ROLE } from "./StatusBanner";
import { areaOf, areas, here, stepStates } from "./AreaNav";

const rec = (analysis_type: string, snapshot_hash: string) =>
  ({ analysis_type, snapshot_hash, result: { status: "FEASIBLE" } }) as unknown as RunRecord;
const report = (snapshot_hash: string) => ({ snapshot_hash }) as ValidationReport;
const state = (runRecords: RunRecord[]): ProjectState => ({
  ...initialState,
  project: { id: "p", name: "P", created_at: "" } as ProjectState["project"],
  design: { ...initialState.design, loads: [{ id: "L1" }], buses: [{ id: "B1" }], inverters: [{ id: "INV1" }] } as ProjectState["design"],
  runRecords,
});

describe("area navigation step states (Doc 7 §3.1)", () => {
  it("blocks M2 and further analyses until M1 is current", () => {
    const s = stepStates(state([]), report("h1"));
    expect(s.slice(5, 8)).toEqual(["todo", "blocked", "blocked"]);
  });
  it("marks M1 stale and later steps blocked after a design edit", () => {
    const s = stepStates(state([rec("M1", "h1"), rec("M2", "h1")]), report("h2"));
    expect(s.slice(5, 8)).toEqual(["stale", "blocked", "blocked"]);
  });
  it("marks M2 done on the current M1 snapshot, stale on an older one", () => {
    expect(stepStates(state([rec("M1", "h1"), rec("M2", "h1")]), report("h1"))[6]).toBe("done");
    expect(stepStates(state([rec("M1", "h0"), rec("M2", "h0"), rec("M1", "h1")]), report("h1"))[6]).toBe("stale");
    expect(stepStates(state([rec("M1", "h1"), rec("M4a", "h1")]), report("h1"))[7]).toBe("done");
  });
});

describe("ADR-011 status banner roles and icons (Doc 7 §5)", () => {
  it("gives negative and error different roles and error rows distinct icons", () => {
    expect(TOKEN_ROLE.warning).toBe("negative");
    expect(TOKEN_ROLE.error).toBe("error");
    const icons = ["SOLVER_FAILED", "PHYSICALLY_INADMISSIBLE"].map((status) => statusIcon({ status, status_code: "X" } as never));
    expect(new Set([...icons, statusIcon({ status: "UNAVAILABLE", status_code: "ENGINE_ERROR" })]).size).toBe(3);
  });
});

describe("ADR-016 option B area navigation", () => {
  it("puts every step screen in exactly one area", () => {
    const list = areas(true, true);
    for (const p of ["/project/", "/loads/", "/sizing/", "/network/", "/constraints/", "/power-flow/", "/constraint-check/", "/sweep/", "/cable-sizing/", "/battery/", "/report/", "/runs/"])
      expect(list.filter((a) => a === areaOf(list, p)).length, p).toBe(1);
    expect(areaOf(list, "/about/")).toBeNull();
  });
  it("reads the workspace area from ?area=", () => {
    const list = areas();
    expect(areaOf(list, here("/workspace/", null))?.key).toBe("model");
    expect(areaOf(list, here("/workspace/", "check"))?.key).toBe("check");
    expect(areaOf(list, here("/sweep/", null))?.key).toBe("studies");
  });
  it("lists cable sizing and battery only when they apply (FR-105, FR-119)", () => {
    const studies = (c: boolean, b: boolean) => areas(c, b)[2].screens.map(([h]) => h);
    expect(studies(false, false)).not.toContain("/cable-sizing/");
    expect(studies(false, false)).not.toContain("/battery/");
    expect(studies(true, true)).toEqual(expect.arrayContaining(["/cable-sizing/", "/battery/"]));
  });
});
