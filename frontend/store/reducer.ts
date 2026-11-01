// Project store reducer (ADR-005: Context + reducer). Stage 1.1 holds RunRecords only.
import type { RunRecord } from "../api-types";

export interface ProjectState {
  runRecords: RunRecord[];
}

export type ProjectAction = { type: "runRecordAdded"; record: RunRecord };

export const initialState: ProjectState = { runRecords: [] };

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case "runRecordAdded":
      return { ...state, runRecords: [...state.runRecords, action.record] };
  }
}
