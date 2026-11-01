"use client";
// Single client-side Project store (Doc 4 §3, ADR-005).
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { initialState, projectReducer, type ProjectAction, type ProjectState } from "./reducer";

const StateCtx = createContext<ProjectState>(initialState);
const DispatchCtx = createContext<Dispatch<ProjectAction>>(() => undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export const useProject = () => useContext(StateCtx);
export const useProjectDispatch = () => useContext(DispatchCtx);
export { projectReducer, initialState } from "./reducer";
export type { ProjectState, ProjectAction } from "./reducer";
