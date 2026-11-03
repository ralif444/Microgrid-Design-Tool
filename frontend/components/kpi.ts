// KPI selectors (Doc 12 X2, FR-87): values read straight from the payload. Only select (min, max,
// argmin, argmax) and count; no arithmetic on physical quantities (guideline §1 rule 1).
import type { M1Payload, M2Payload, M4aPayload } from "../api-types";
import { num } from "./format";
import type { IconName } from "./Icon";
import { KIND_WORDS } from "./M2Results";

// `value` is a payload number, or a payload word (the M2 verdict) shown with `icon`.
export type Kpi = { label: string; value: number | string | null; unit: string; detail?: string; icon?: IconName };

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

export function m2Kpis(p: M2Payload): Kpi[] {
  const tight = pick(p.constraint_margins, (c) => c.normalised_margin);
  const l = p.loadability;
  const res = `resolution ${num(l.resolution)}`;
  return [
    { label: "Verdict", value: p.verdict, unit: "", icon: p.verdict === "FEASIBLE" ? "feasible" : "misuse" },
    { label: "Violated constraints", value: p.constraint_margins.filter((c) => c.margin < 0).length, unit: "count" },
    {
      label: "Tightest constraint",
      value: tight?.normalised_margin ?? null,
      unit: "ratio",
      detail: tight ? `normalised margin; ${KIND_WORDS[tight.kind] ?? tight.kind}, ${tight.element_id}` : "no evaluated constraint",
    },
    { label: "Not evaluated", value: p.not_evaluated.length, unit: "count", detail: "no limit given" },
    { label: "Constraint loadability λ_c", value: l.lambda_c, unit: "ratio", detail: res },
    { label: "λ_s", value: l.lambda_s, unit: "ratio", detail: `solution-existence diagnostic, not a stability limit; ${res}` },
  ];
}

const CLASS_ICON: Record<string, IconName> = { STABLE: "feasible", MARGINAL: "warn", UNSTABLE: "misuse" };

/** S-13 tiles; the damping check only when the run was given a threshold (guideline §4). */
export function m4aKpis(p: M4aPayload, thresholdGiven: boolean): Kpi[] {
  const dom = p.dominant_modes[0];
  return [
    { label: "Stability class", value: p.stability_class, unit: "", icon: CLASS_ICON[p.stability_class] },
    { label: "Lowest damping ζ_min", value: p.zeta_min, unit: "ratio", detail: p.zeta_min === null ? "no oscillatory mode" : "of the oscillatory modes" },
    ...(thresholdGiven
      ? [{ label: "Damping check", value: p.damping_pass === null || p.damping_pass === undefined ? null : p.damping_pass ? "passes" : "fails", unit: "", detail: p.damping_pass == null ? "not judged: no oscillatory mode" : "against the given threshold" }]
      : []),
    { label: "Dominant mode frequency", value: dom?.frequency_hz ?? null, unit: "Hz", detail: dom ? `eigenvalue #${dom.eigenvalue_index}${dom.associated_element_ids.length ? `, ${dom.associated_element_ids.join(", ")}` : ""}` : "no dominant mode" },
    { label: "Outside definition", value: p.outside_definition ? "yes" : "no", unit: "", detail: p.outside_definition ? "the operating point violates constraints [19]" : undefined },
  ];
}
