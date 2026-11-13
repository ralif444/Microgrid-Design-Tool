// P11 hour sweep view (Doc 12 FR-79; Doc 9 D-113 K337, K338): the worst FEASIBLE hour per key
// metric, by a fixed direction per metric. Frequency counts by its distance from the nominal.
import type { KeyMetrics, SweepPoint } from "../api-types";

export const HOUR_AXIS = { kind: "LOAD_PROFILE_HOUR", range_min: 0, range_max: 23, step_count: 24 } as const;

type Metric = keyof KeyMetrics;
const LOWEST = new Set<Metric>(["min_voltage_pu", "lambda_c", "zeta_min"]);

export type Worst = { metric: Metric; hour: number; value: number };

export function worstHours(points: SweepPoint[], fNominalHz: number | null | undefined): Worst[] {
  const ok = points.filter((p) => p.status === "FEASIBLE" && typeof p.value === "number");
  const metrics = new Set(ok.flatMap((p) => (Object.keys(p.key_metrics) as Metric[]).filter((k) => typeof p.key_metrics[k] === "number")));
  const out: Worst[] = [];
  for (const m of metrics) {
    const score = (v: number) => (m === "system_frequency_hz" ? Math.abs(v - (fNominalHz ?? v)) : LOWEST.has(m) ? -v : v);
    let best: Worst | null = null;
    for (const p of ok) {
      const v = p.key_metrics[m];
      if (typeof v !== "number") continue;
      if (best === null || score(v) > score(best.value)) best = { metric: m, hour: p.value as number, value: v };
    }
    if (best) out.push(best);
  }
  return out;
}
