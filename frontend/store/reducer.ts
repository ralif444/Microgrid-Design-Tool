// Project store reducer (ADR-005: Context + reducer). The open Project lives here (Doc 7 §7).
import type {
  DesignConstraints,
  ProjectFile,
  ProjectSnapshot,
  PsPayload,
  RunRecord,
  RunRecordRef,
} from "../api-types";
import { sha256Hex } from "./canonical";

export interface ProjectMeta {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  modified_at: string; // set on Save (D-47 K14)
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

// Doc 3 §3.10: a named set of overrides on the current design; no topology changes in v1.
export interface Override {
  parameter_path: string;
  value: number;
}
export interface Scenario {
  id: string;
  name: string;
  description?: string | null;
  overrides: Override[];
}

export interface ProjectState {
  project: ProjectMeta | null;
  design: ProjectSnapshot;
  sizingAdvice: SizingAdvice[];
  scenarios: Scenario[];
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
  // Bus rows carry their user-entered id (D-45 K1); other rows get a generated id.
  | { type: "rowAdded"; collection: Collection; row: Row }
  | { type: "rowUpdated"; collection: Collection; id: string; patch: Row }
  | { type: "rowRemoved"; collection: Collection; id: string }
  | { type: "constraintSet"; field: keyof DesignConstraints; value: number | null }
  | { type: "adviceAdded"; advice: SizingAdvice }
  | { type: "adviceDecided"; id: string; state: "ACCEPTED" | "SKIPPED" }
  | { type: "runRecordAdded"; record: RunRecord }
  // Scenarios (Doc 7 S-11, D-56 K96): not design data, so they never make M1 stale.
  | { type: "scenarioAdded"; name: string }
  | { type: "scenarioUpdated"; id: string; patch: Partial<Omit<Scenario, "id">> }
  | { type: "scenarioRemoved"; id: string }
  // Project file (D-47): load replaces the open Project; save clears the unsaved flag.
  | { type: "projectLoaded"; file: ProjectFile }
  // Example Project (Doc 12 FR-85): a new unsaved copy with its own id; the example stays as is.
  | { type: "exampleOpened"; file: ProjectFile; id: string; created_at: string }
  | { type: "projectSaved"; modified_at: string }
  | { type: "runRecordImported"; record: RunRecord };

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
  scenarios: [],
  runRecords: [],
  unsaved: false,
};

export type Collection = "buses" | "lines" | "loads" | "inverters";
type Row = { id?: string | null; [field: string]: unknown };

// Generated ids (Doc 9 D-45 K3, D-46 K8); never reuses a number still present.
export const ID_PREFIX: Record<Exclude<Collection, "buses">, string> = { loads: "L", lines: "LN", inverters: "INV" };

export function nextId(prefix: string, rows: { id?: string | null }[]): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const used = rows.map((r) => re.exec(r.id ?? "")?.[1]).filter(Boolean).map(Number);
  return `${prefix}${Math.max(0, ...used) + 1}`;
}

// FR-69: editing a value copied from the Catalogue marks the element; catalog_ref is kept.
const COPIED: Partial<Record<Collection, string[]>> = { lines: ["r_ohm_per_km", "x_ohm_per_km"], inverters: ["rated_kva"] };

function markModified(collection: Collection, row: Row, patch: Row): Row {
  const ref = row.catalog_ref as { current_limit_confirmed?: boolean } | null | undefined;
  if (!ref || "catalog_ref" in patch) return { ...row, ...patch };
  const copied = [...(COPIED[collection] ?? []), ...(ref.current_limit_confirmed ? ["current_limit_a"] : [])];
  const touched = copied.some((f) => f in patch && patch[f] !== row[f]);
  return { ...row, ...patch, ...(touched ? { catalog_ref: { ...ref, modified: true } } : {}) };
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
    case "rowAdded": {
      const rows: Row[] = d[action.collection] ?? [];
      const id = action.collection === "buses" ? action.row.id : nextId(ID_PREFIX[action.collection], rows);
      return edit(state, { [action.collection]: [...rows, { ...action.row, id }] });
    }
    case "rowUpdated": {
      const rows: Row[] = d[action.collection] ?? [];
      return edit(state, {
        [action.collection]: rows.map((x) => (x.id === action.id ? markModified(action.collection, x, action.patch) : x)),
      });
    }
    case "rowRemoved": {
      const rows: Row[] = d[action.collection] ?? [];
      return edit(state, { [action.collection]: rows.filter((x) => x.id !== action.id) });
    }
    case "constraintSet":
      return edit(state, { design_constraints: { ...d.design_constraints, [action.field]: action.value } });
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
    case "scenarioAdded":
      return {
        ...state,
        scenarios: [...state.scenarios, { id: nextId("S", state.scenarios), name: action.name, overrides: [] }],
        unsaved: true,
      };
    case "scenarioUpdated":
      return {
        ...state,
        scenarios: state.scenarios.map((x) => (x.id === action.id ? { ...x, ...action.patch } : x)),
        unsaved: true,
      };
    case "scenarioRemoved":
      return { ...state, scenarios: state.scenarios.filter((x) => x.id !== action.id), unsaved: true };
    case "projectLoaded":
      return { ...fromProjectFile(action.file), unsaved: false };
    case "exampleOpened": {
      const loaded = fromProjectFile(action.file);
      const { id, created_at } = action;
      return { ...loaded, project: loaded.project && { ...loaded.project, id, created_at, modified_at: created_at }, unsaved: true };
    }
    case "projectSaved":
      return state.project
        ? { ...state, project: { ...state.project, modified_at: action.modified_at }, unsaved: false }
        : state;
    case "runRecordImported":
      return { ...state, runRecords: [...state.runRecords, action.record], unsaved: true };
  }
}

// Doc 3 §3.8: SHA-256 of canonical {loads, load_profile, ps_parameters}.
export function adviceInputHash(design: ProjectSnapshot, ps: PsParameters): Promise<string> {
  return sha256Hex({ loads: design.loads ?? [], load_profile: design.load_profile ?? null, ps_parameters: ps });
}

// Latest FEASIBLE M1 as the dependency reference for M2 (Doc 3 §5.1 RunRecordRef), or null.
export function m1Ref(runRecords: RunRecord[]): RunRecordRef | null {
  const rec = runRecords.findLast((r) => r.analysis_type === "M1" && r.result.status === "FEASIBLE");
  if (!rec) return null;
  return {
    record_id: rec.record_id,
    analysis_type: "M1",
    snapshot_hash: rec.snapshot_hash,
    status: rec.result.status,
    result_hash: rec.result_hash,
    result_payload: rec.result.payload ?? null,
  };
}

// The inverse of toProjectFile (projectFile.ts) for a file the server accepted (Doc 6 §3.6).
export function fromProjectFile(f: ProjectFile): Omit<ProjectState, "unsaved"> {
  const { nominal_voltage_kv, nominal_frequency_hz, ...meta } = f.project;
  return {
    project: { ...meta, description: meta.description ?? null },
    design: {
      nominal_voltage_kv: nominal_voltage_kv ?? null,
      nominal_frequency_hz: nominal_frequency_hz ?? null,
      buses: f.buses,
      lines: f.lines,
      loads: f.loads,
      load_profile: f.load_profile,
      inverters: f.inverters,
      design_constraints: f.design_constraints,
    },
    sizingAdvice: f.sizing_advice as unknown as SizingAdvice[],
    scenarios: (f.scenarios ?? []) as Scenario[],
    runRecords: f.run_records as RunRecord[],
  };
}
