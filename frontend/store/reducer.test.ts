import { describe, expect, it } from "vitest";
import type { RunRecord } from "../api-types";
import { initialState, projectReducer } from "./reducer";

describe("projectReducer", () => {
  it("adds a RunRecord without mutating the previous state", () => {
    const rec = { record_id: "r1" } as unknown as RunRecord;
    const next = projectReducer(initialState, { type: "runRecordAdded", record: rec });
    expect(next.runRecords).toEqual([rec]);
    expect(initialState.runRecords).toEqual([]);
  });
});
