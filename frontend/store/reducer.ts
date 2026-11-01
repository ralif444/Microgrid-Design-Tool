// Project store reducer (ADR-005: Context + reducer). The open Project lives here (Doc 7 §7).
import type { Load, ProjectSnapshot, PsPayload, RunRecord } from "../api-types";
import { sha256Hex } from "./canonical";

export interface ProjectMeta {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  modified_at: string; // shortcut: set at creation only; the save in WP 1.2.3 updates it
}

// PS parameters of Doc 3 §6.1; null = not entered (no defaults).
export interface PsParameters {
  inverter_margin_ratio: number | null;
  unit_count: number | null;
  redundancy: number | null;
  autonomy_h: number | null;
  dc_efficiency_ratio: number | null;
  depth_of_discharge_ratio: number | null;
}

// Doc 3 §3.8. EDITED is part of the contract; the Edit action is deferred (Doc 9 D-45 K5).
export interface SizingAdvice {
  id: string;
  created_at: string;
  input_hash: string;
  ps_parameters: PsParameters;
  state: "PROPOSED" | "ACCEPTED" | "EDITED" | "SKIPPED";
  result: PsPayload;
  edited_values?: Partial<PsPayload>;
}

export interface ProjectState {
  project: ProjectMeta | null;
  design: ProjectSnapshot;
  sizingAdvice: SizingAdvice[];
  runRecords: RunRecord[];
  unsaved: boolean;
}

export type ProjectAction =
  | {
      type: "projectCreated";
      meta: Pick<ProjectMeta, "id" | "name" | "created_at">;
      nominal_voltage_kv: number | null;
      nominal_frequency_hz: number | null;
    }
  | {
      type: "projectUpdated";
      name?: string;
      nominal_voltage_kv?: number | null;
      nominal_frequency_hz?: number | null;
    }
  | { type: "busAdded"; id: string }
  | { type: "busRemoved"; id: string }
  | { type: "loadAdded"; busId: string | null }
  | { type: "loadUpdated"; id: string; patch: Partial<Load> }
  | { type: "loadRemoved"; id: string }
  | { type: "adviceAdded"; advice: SizingAdvice }
  | { type: "adviceDecided"; id: string; state: "ACCEPTED" | "SKIPPED" }
  | { type: "runRecordAdded"; record: RunRecord };

const emptyDesign = (): ProjectSnapshot => ({
  nominal_voltage_kv: null,
  nominal_frequency_hz: null,
  buses: [],
  lines: [],
  loads: [],
  load_profile: null,
  inverters: [],
  design_constraints: {},
});

export const initialState: ProjectState = {
  project: null,
  design: emptyDesign(),
  sizingAdvice: [],
  runRecords: [],
  unsaved: false,
};

// Generated Load ids L1, L2, … (Doc 9 D-45 K3); never reuses a number still present.
export function nextLoadId(loads: Load[]): string {
  const used = loads.map((l) => /^L(\d+)$/.exec(l.id ?? "")?.[1]).filter(Boolean).map(Number);
  return `L${Math.max(0, ...used) + 1}`;
}

function edit(state: ProjectState, design: Partial<ProjectSnapshot>): ProjectState {
  return { ...state, design: { ...state.design, ...design }, unsaved: true };
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  const d = state.design;
  switch (action.type) {
    case "projectCreated":
      return {
        ...initialState,
        project: { ...action.meta, description: null, modified_at: action.meta.created_at },
        design: {
          ...emptyDesign(),
          nominal_voltage_kv: action.nominal_voltage_kv,
          nominal_frequency_hz: action.nominal_frequency_hz,
        },
        unsaved: true,
      };
    case "projectUpdated": {
      if (!state.project) return state;
      const { type: _t, name, ...nominal } = action;
      const next = edit(state, nominal);
      return name === undefined ? next : { ...next, project: { ...state.project, name } };
    }
    case "busAdded":
      return edit(state, { buses: [...(d.buses ?? []), { id: action.id }] });
    case "busRemoved":
      return edit(state, { buses: (d.buses ?? []).filter((b) => b.id !== action.id) });
    case "loadAdded": {
      const loads = d.loads ?? [];
      const row = { id: nextLoadId(loads), bus_id: action.busId, p_kw: null, q_kvar: null };
      return edit(state, { loads: [...loads, row] });
    }
    case "loadUpdated":
      return edit(state, {
        loads: (d.loads ?? []).map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)),
      });
    case "loadRemoved":
      return edit(state, { loads: (d.loads ?? []).filter((l) => l.id !== action.id) });
    case "adviceAdded":
      return { ...state, sizingAdvice: [...state.sizingAdvice, action.advice], unsaved: true };
    case "adviceDecided":
      // Advice stays advisory: no design entity changes here (FR-08).
      return {
        ...state,
        sizingAdvice: state.sizingAdvice.map((a) =>
          a.id === action.id ? { ...a, state: action.state } : a,
        ),
        unsaved: true,
      };
    case "runRecordAdded":
      return { ...state, runRecords: [...state.runRecords, action.record] };
  }
}

// Doc 3 §3.8: SHA-256 of canonical {loads, load_profile, ps_parameters}.
export function adviceInputHash(design: ProjectSnapshot, ps: PsParameters): Promise<string> {
  return sha256Hex({ loads: design.loads ?? [], load_profile: design.load_profile ?? null, ps_parameters: ps });
}
