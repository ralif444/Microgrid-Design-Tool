// KPI selectors (Doc 12 X2, FR-87): values read straight from the payload. Only select (min, max,
// argmin, argmax) and count; no arithmetic on physical quantities (guideline §1 rule 1).
import type { M1Payload } from "../api-types";

export type Kpi = { label: string; value: number | null; unit: string; detail?: string };

// The row with the smallest (sign -1: largest) value, or null for an empty list.
export function pick<R>(rows: R[], get: (r: R) => number, sign: 1 | -1 = 1): R | null {
  return rows.reduce<R | null>((best, r) => (best === null || sign * get(r) < sign * get(best) ? r : best), null);
}

export function m1Kpis(p: M1Payload): Kpi[] {
  const lo = pick(p.bus_results, (b) => b.voltage_pu);
  const hi = pick(p.bus_results, (b) => b.voltage_pu, -1);
  const load = pick(p.inverter_results, (i) => i.loading_ratio, -1);
  return [
    { label: "System frequency", value: p.system_frequency_hz, unit: "Hz" },
    { label: "Lowest bus voltage", value: lo?.voltage_pu ?? null, unit: "p.u.", detail: lo?.bus_id },
    { label: "Highest bus voltage", value: hi?.voltage_pu ?? null, unit: "p.u.", detail: hi?.bus_id },
    { label: "Highest inverter loading", value: load?.loading_ratio ?? null, unit: "ratio", detail: load?.inverter_id },
    { label: "Total load, active", value: p.total_load_kw, unit: "kW" },
    { label: "Total load, reactive", value: p.total_load_kvar, unit: "kvar" },
    { label: "Total losses", value: p.total_losses_kw, unit: "kW" },
    { label: "Iterations", value: p.iterations, unit: "count" },
    { label: "Validity indicator ε_X", value: p.epsilon_x_ratio, unit: "ratio", detail: "threshold not yet calibrated" },
  ];
}
