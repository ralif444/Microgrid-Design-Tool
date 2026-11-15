// Field lists of the design elements, shared by the tables (S-03, S-05, S-06) and the workspace
// inspector (W4), so both edit the same fields with the same labels and units.
import type { CatalogRef, DesignConstraints, Load, RunRecord } from "../api-types";
import { refText } from "./Catalog";
import type { Column } from "./EntityTable";

const times = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a * b : null);

export const BUS_COLUMNS: Column[] = [{ field: "id", label: "Bus id", kind: "text" }];

export const LINE_COLUMNS: Column[] = [
  { field: "from_bus_id", label: "From bus", kind: "bus" },
  { field: "to_bus_id", label: "To bus", kind: "bus" },
  { field: "r_ohm_per_km", label: "R", kind: "number", unit: "Ω/km" },
  { field: "x_ohm_per_km", label: "X", kind: "number", unit: "Ω/km" },
  { field: "length_km", label: "Length", kind: "number", unit: "km" },
  { field: "current_limit_a", label: "Current limit, optional", kind: "number", unit: "A" },
  { label: "Total R, derived, read-only", kind: "derived", unit: "Ω", value: (r) => times(r.r_ohm_per_km, r.length_km) },
  { label: "Total X, derived, read-only", kind: "derived", unit: "Ω", value: (r) => times(r.x_ohm_per_km, r.length_km) },
  { label: "From catalogue", kind: "derived", unit: "entry", value: (r) => refText(r.catalog_ref as CatalogRef | null) },
];

export const INVERTER_COLUMNS: Column[] = [
  { field: "bus_id", label: "Bus", kind: "bus" },
  { field: "rated_kva", label: "Rating", kind: "number", unit: "kVA" },
  { field: "frequency_droop_hz_per_kw", label: "P–f droop", kind: "number", unit: "Hz/kW", term: "mp" },
  { field: "voltage_droop_kv_per_kvar", label: "Q–V droop", kind: "number", unit: "kV/kvar", term: "nq" },
  { field: "frequency_setpoint_hz", label: "Frequency setpoint", kind: "number", unit: "Hz" },
  { field: "voltage_setpoint_kv", label: "Voltage setpoint, line-to-line", kind: "number", unit: "kV" },
  { field: "p_setpoint_kw", label: "P setpoint, optional", kind: "number", unit: "kW" },
  { field: "q_setpoint_kvar", label: "Q setpoint, optional", kind: "number", unit: "kvar" },
  { field: "tau_p_s", label: "τ_P, needed for M4", kind: "number", unit: "s" },
  { field: "tau_q_s", label: "τ_Q, needed for M4", kind: "number", unit: "s" },
  { label: "From catalogue", kind: "derived", unit: "entry", value: (r) => refText(r.catalog_ref as CatalogRef | null) },
];

// S-06 (FR-15, FR-16): no numeric defaults; an empty limit is "not evaluated".
export const CONSTRAINT_FIELDS: [keyof DesignConstraints, string, string][] = [
  ["voltage_min_pu", "Bus voltage, lower limit", "p.u."],
  ["voltage_max_pu", "Bus voltage, upper limit", "p.u."],
  ["frequency_min_hz", "Frequency, lower limit", "Hz"],
  ["frequency_max_hz", "Frequency, upper limit", "Hz"],
  ["inverter_loading_limit_ratio", "Inverter loading limit", "ratio of rating"],
  ["line_current_limit_a", "Line current limit, all lines", "A"],
  ["balance_tolerance_kw", "Power-balance tolerance, optional", "kW"],
];

// S-03 (FR-03): Q or power factor per load. The choice is a screen state, not data: both empty reads as Q.
export type LoadMode = "Q" | "PF";
export const loadMode = (l: Load, chosen?: LoadMode): LoadMode => chosen ?? (l.power_factor != null || l.pf_direction != null ? "PF" : "Q");
export const modePatch = (m: LoadMode): Partial<Load> => (m === "Q" ? { power_factor: null, pf_direction: null } : { q_kvar: null });
export const PF_DIRECTIONS: [string, string][] = [
  ["LAGGING", "lagging"],
  ["LEADING", "leading"],
];

// S-08 settings (D-46 K11): margins required without defaults, storage settings optional.
export type M2Params = Record<
  "inverter_margin_ratio" | "line_margin_ratio" | "autonomy_h" | "dc_efficiency_ratio" | "depth_of_discharge_ratio",
  number | null
>;

export const M2_FIELDS: [keyof M2Params, string, string, string][] = [
  ["inverter_margin_ratio", "Inverter design margin m_inv", "ratio", "any"],
  ["line_margin_ratio", "Line design margin m_line", "ratio", "any"],
  ["autonomy_h", "Storage autonomy t_aut, optional", "h", "1"],
  ["dc_efficiency_ratio", "DC efficiency η_dc, optional", "ratio", "any"],
  ["depth_of_discharge_ratio", "Depth of discharge DoD, optional", "ratio", "any"],
];

// K147: start from the user's own last M2 entry (RunRecord), never from a default.
export function lastM2Params(runRecords: RunRecord[]): M2Params {
  const last = runRecords.findLast((r) => r.analysis_type === "M2")?.parameters as Partial<M2Params> | undefined;
  return Object.fromEntries(M2_FIELDS.map(([k]) => [k, last?.[k] ?? null])) as M2Params;
}
