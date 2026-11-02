"use client";
// Shared parts of the further-analysis screens S-09..S-11 (Doc 7 §6.5, Doc 9 D-56).
import { useState } from "react";
import { runAnalysis } from "../api-client";
import type { AnalysisRequestBody, AnalysisResponse, AnalysisType, OutputMetric, ProjectSnapshot } from "../api-types";
import { m1Ref, useProject, useProjectDispatch } from "../store";
import { m1Freshness, useValidation } from "./useValidation";

export const SOLVER = { mismatch_tolerance_w: 0.001, max_iterations: 50, initial_guess: "DEFAULT" as const };

// Doc 3 §6.4 metrics with the contract unit of the Real adapter (D-55 K93).
export const METRICS: [OutputMetric, string, string][] = [
  ["SYSTEM_FREQUENCY", "System frequency", "Hz"],
  ["MIN_BUS_VOLTAGE", "Lowest bus voltage", "pu"],
  ["MAX_BUS_VOLTAGE", "Highest bus voltage", "pu"],
  ["MAX_INVERTER_LOADING", "Highest inverter loading", "ratio"],
  ["MAX_LINE_CURRENT", "Highest line current", "A"],
  ["TOTAL_LOSSES", "Total line losses", "kW"],
];

// Numeric fields a parameter path may name (Doc 3 §3.3, §3.4, §3.6; D-56 K97).
export const FIELDS: Record<"loads" | "lines" | "inverters", string[]> = {
  loads: ["p_kw", "q_kvar", "power_factor"],
  lines: ["r_ohm_per_km", "x_ohm_per_km", "length_km", "current_limit_a"],
  inverters: [
    "rated_kva",
    "frequency_droop_hz_per_kw",
    "voltage_droop_kv_per_kvar",
    "frequency_setpoint_hz",
    "voltage_setpoint_kv",
    "p_setpoint_kw",
    "q_setpoint_kvar",
    "tau_p_s",
    "tau_q_s",
  ],
};

// Every `<collection>/<id>/<field>` of the current design whose field holds a number.
export function numericPaths(d: ProjectSnapshot): string[] {
  return (Object.keys(FIELDS) as (keyof typeof FIELDS)[]).flatMap((c) =>
    (d[c] ?? []).flatMap((row) =>
      FIELDS[c]
        .filter((f) => typeof (row as Record<string, unknown>)[f] === "number")
        .map((f) => `${c}/${row.id}/${f}`),
    ),
  );
}

// Unit from the field suffix (Doc 3 §1); longest suffix first.
const SUFFIX: [string, string][] = [
  ["_hz_per_s", "Hz/s"], ["_per_s", "1/s"], ["_pu", "p.u."], ["_ratio", "ratio"], ["_kwh", "kWh"],
  ["_hz_per_kw", "Hz/kW"], ["_kv_per_kvar", "kV/kvar"], ["_ohm_per_km", "Ω/km"], ["_kva", "kVA"],
  ["_kvar", "kvar"], ["_kw", "kW"], ["_kv", "kV"], ["_hz", "Hz"], ["_km", "km"], ["_s", "s"], ["_a", "A"],
];
export const unitOf = (path: string) => SUFFIX.find(([s]) => path.endsWith(s))?.[1] ?? "1";

export function applyOverrides(d: ProjectSnapshot, overrides: { parameter_path: string; value: number }[]): ProjectSnapshot {
  let out = d;
  for (const o of overrides) {
    const [c, id, f] = o.parameter_path.split("/") as [keyof typeof FIELDS, string, string];
    out = { ...out, [c]: (out[c] ?? []).map((r) => (r.id === id ? { ...r, [f]: o.value } : r)) };
  }
  return out;
}

// Doc 12 P7 (FR-84): M3a pre-fill from a limiting constraint; null for kinds without a metric.
const SHORTCUT_METRIC: Record<string, OutputMetric> = {
  BUS_VOLTAGE_MIN: "MIN_BUS_VOLTAGE",
  BUS_VOLTAGE_MAX: "MAX_BUS_VOLTAGE",
  FREQUENCY_MIN: "SYSTEM_FREQUENCY",
  FREQUENCY_MAX: "SYSTEM_FREQUENCY",
  INVERTER_LOADING: "MAX_INVERTER_LOADING",
  LINE_CURRENT: "MAX_LINE_CURRENT",
};

export function shortcutPrefill(d: ProjectSnapshot, kind: string, elementId: string): { paths: string[]; metric: OutputMetric } | null {
  const metric = SHORTCUT_METRIC[kind];
  if (!metric) return null;
  const wanted = (pp: string) => {
    const [c, id, f] = pp.split("/");
    if (c === "inverters") return ["rated_kva", "frequency_droop_hz_per_kw", "voltage_droop_kv_per_kvar"].includes(f);
    return c === "lines" && id === elementId && (f === "r_ohm_per_km" || f === "x_ohm_per_km");
  };
  return { paths: numericPaths(d).filter(wanted), metric };
}

// Doc 12 P12 (FR-80): the base design plus one snapshot per Inverter with that Inverter removed.
// Sent as M3c snapshots only; stored Scenarios stay overrides without topology changes (D-62).
export function nMinus1(d: ProjectSnapshot): { scenario_id: string; label: string; project_snapshot: ProjectSnapshot }[] {
  const inv = d.inverters ?? [];
  return [
    { scenario_id: "BASE", label: "Base design", project_snapshot: d },
    ...inv.map((x) => ({
      scenario_id: `N-1 ${x.id}`,
      label: `Without ${x.id}`,
      project_snapshot: { ...d, inverters: inv.filter((y) => y !== x) },
    })),
  ];
}

// Run gate and request state shared by S-09..S-11: Run needs a current M1 (Doc 7 §3.1).
export function useDependentRun(type: AnalysisType) {
  const { design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const ref = m1Ref(runRecords);
  const fresh = m1Freshness(ref?.snapshot_hash ?? null, useValidation(design));
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function run(extra: Pick<AnalysisRequestBody, "parameters" | "scenarios">) {
    if (!ref) return;
    setError(null);
    setBusy(true);
    const out = await runAnalysis(type, { project_snapshot: design, solver_config: SOLVER, depends_on: ref, ...extra });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setResp(out.data);
    dispatch({ type: "runRecordAdded", record: out.data.run_record });
  }
  return { design, fresh, busy, resp, error, run, m2Infeasible: lastM2Infeasible(runRecords) };
}

function lastM2Infeasible(records: { analysis_type: string; result: { status: string } }[]): boolean {
  return records.findLast((r) => r.analysis_type === "M2")?.result.status === "INFEASIBLE";
}

// FR-41 note (Doc 7 §3.1).
export function InfeasibleNote({ show }: { show: boolean }) {
  return show ? <p>This design violates constraints; further analyses are still allowed.</p> : null;
}

export const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "—" : String(Number(v.toPrecision(6))));
