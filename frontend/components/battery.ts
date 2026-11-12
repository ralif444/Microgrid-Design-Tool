// Battery round (Doc 12 B1, B2; D-106, D-107). Client-side helpers for the Catalogue kind
// BATTERY_MODULE and the S-04 module hint of FR-74 (Eq. 12.3 – 12.5, level L1: a hint over the PS
// result, never stored, PS values unchanged).
import type { CatalogEntry } from "../api-types";

type Module = NonNullable<CatalogEntry["battery_module"]>;

// FR-73: stored, but B2 cannot use it (the warning lives on S-18 only, D-107).
export const noPowerCapability = (e: CatalogEntry): boolean =>
  e.kind === "BATTERY_MODULE" && e.battery_module?.discharge_power_kw == null && e.battery_module?.c_rate_per_h == null;

export const NO_POWER_WARNING = "No continuous discharge power and no C-rate: the battery power check (B2) cannot use this module.";

// Eq. 12.3: n with n·V_mod_min ≥ V_dc_min and n·V_mod_max ≤ V_dc_max. The products are compared
// with a 1e-9 relative slack so a boundary like 3 × 0.1 V = 0.3 V is not lost to floating point.
const EPS = 1e-9;
export function admissibleSeries(vModMin: number, vModMax: number, vDcMin: number, vDcMax: number): number[] {
  const out: number[] = [];
  const lo = Math.max(1, Math.ceil(vDcMin / vModMin) - 1);
  for (let n = lo; n <= Math.floor(vDcMax / vModMax) + 1; n++)
    if (n * vModMin >= vDcMin * (1 - EPS) && n * vModMax <= vDcMax * (1 + EPS)) out.push(n);
  return out;
}

export type ModuleHint =
  | { verdict: "not evaluated"; reason: string }
  | {
      verdict: "fit" | "no-fit" | "unknown";
      series: number[];
      moduleCount: number; // N_mod, Eq. 12.4
      ns: number | null;
      np: number | null; // Eq. 12.5
      installedCount: number | null;
      installedKwh: number | null;
      extraKwh: number | null;
    };

export function moduleHint(
  eNomKwh: number | null | undefined,
  m: Module,
  dc: { min: number | null | undefined; max: number | null | undefined },
  nsPick?: number | null,
): ModuleHint {
  if (eNomKwh == null) return { verdict: "not evaluated", reason: "PS has no nominal energy" };
  if (m.energy_kwh == null) return { verdict: "not evaluated", reason: "the module has no energy value" };
  const moduleCount = Math.ceil(eNomKwh / m.energy_kwh);
  const none = { series: [], ns: null, np: null, installedCount: null, installedKwh: null, extraKwh: null, moduleCount };
  if (dc.min == null || dc.max == null || m.voltage_min_v == null || m.voltage_max_v == null) return { verdict: "unknown", ...none };
  const series = admissibleSeries(m.voltage_min_v, m.voltage_max_v, dc.min, dc.max);
  if (series.length === 0) return { verdict: "no-fit", ...none };
  const ns = nsPick != null && series.includes(nsPick) ? nsPick : series[0];
  const np = Math.ceil(moduleCount / ns);
  const installedKwh = ns * np * m.energy_kwh;
  return { verdict: "fit", series, moduleCount, ns, np, installedCount: ns * np, installedKwh, extraKwh: installedKwh - eNomKwh };
}

// BA payload (Doc 12 B2 Eq. 12.6 – 12.8, B3 Eq. 12.14 – 12.18; ADR-015; guideline §4.2).
export type BaPower = {
  outcome: "OK" | "SHORT" | "NOT_EVALUATED";
  reason: string | null;
  capability_kw: number | null;
  capability_source: "discharge_power" | "c_rate" | null;
  inverter_p_kw: number | null;
  dc_side_power_kw: number | null;
  margin_kw: number | null;
};
export type BaPoint = { step: number; clock_hour: number; inverter_p_kw: number; cumulative_energy_kwh: number; soc_ratio: number };
export type BaAutonomy = {
  outcome: "DEPLETED" | "NOT_DEPLETED" | "NOT_EVALUATED";
  reason: string | null;
  usable_energy_kwh: number | null;
  start_hour: number;
  autonomy_h: number | null;
  depletion_clock_hour: number | null;
  end_soc_ratio: number | null;
  curve: BaPoint[];
};
export type BaBank = {
  inverter_id: string;
  bank: { series_count: number; parallel_count: number; module_count: number; energy_kwh: number | null };
  power: BaPower;
  autonomy: BaAutonomy;
};
export type BaHour = { clock_hour: number; lambda: number; m1_status: string; m1_status_code: string; system_frequency_hz: number | null };
export type BaPayload = { banks: BaBank[]; hours: BaHour[]; caveat_text: string };

// Carbon support colours with icon and word; no red, no "Violated" (Doc 7 §2.5).
export const POWER_OUTCOME: Record<BaPower["outcome"], { word: string; role: "success" | "negative" | "neutral"; icon: "feasible" | "warn" | "dot" }> = {
  OK: { word: "OK", role: "success", icon: "feasible" },
  SHORT: { word: "Short", role: "negative", icon: "warn" },
  NOT_EVALUATED: { word: "Not evaluated", role: "neutral", icon: "dot" },
};
export const AUTONOMY_OUTCOME: Record<BaAutonomy["outcome"], { word: string; role: "success" | "negative" | "neutral"; icon: "feasible" | "warn" | "dot" }> = {
  NOT_DEPLETED: { word: "Not depleted", role: "success", icon: "feasible" },
  DEPLETED: { word: "Depleted", role: "negative", icon: "warn" },
  NOT_EVALUATED: { word: "Not evaluated", role: "neutral", icon: "dot" },
};

// Depletion chart data (FR-120): x = hours from start, 0 … 24; SoC(0) = SoC_0 and SoC after step j
// at x = j + 1 (Eq. 12.17); null after depletion so the line stops. One flat series per bank marks
// the discharge limit 1 − D_i (the chart has no reference-line primitive).
export function socSeries(p: BaPayload, banks: { inverter_id: string; depth_of_discharge_ratio?: number | null; initial_soc_ratio?: number | null }[]) {
  const x = Array.from({ length: 25 }, (_, k) => k);
  const series: { name: string; values: (number | null)[] }[] = [];
  for (const b of p.banks) {
    const sent = banks.find((s) => s.inverter_id === b.inverter_id);
    const soc0 = sent?.initial_soc_ratio;
    const dod = sent?.depth_of_discharge_ratio;
    if (b.autonomy.curve.length === 0 || soc0 == null || dod == null) continue;
    series.push({ name: b.inverter_id, values: x.map((k) => (k === 0 ? soc0 : (b.autonomy.curve[k - 1]?.soc_ratio ?? null))) });
    series.push({ name: `${b.inverter_id} discharge limit`, values: x.map(() => 1 - dod) });
  }
  return { x, series };
}
