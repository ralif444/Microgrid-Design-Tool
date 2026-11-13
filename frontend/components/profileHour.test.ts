import { describe, expect, it } from "vitest";
import type { SweepPoint } from "../api-types";
import { worstHours } from "./profileHour";

const pt = (h: number, status: string, km: Record<string, number | null>): SweepPoint =>
  ({ value: h, status, status_code: "OK", limiting_constraint: null, key_metrics: km }) as unknown as SweepPoint;

describe("FR-79 worst hour per key metric (D-113 K338)", () => {
  const pts = [
    pt(0, "FEASIBLE", { system_frequency_hz: 49.9, min_voltage_pu: 0.98, max_loading_ratio: 0.5, zeta_min: 0.3, epsilon_x_ratio: null }),
    pt(1, "FEASIBLE", { system_frequency_hz: 50.05, min_voltage_pu: 0.95, max_loading_ratio: 0.7, zeta_min: 0.1, epsilon_x_ratio: null }),
    pt(2, "SOLVER_FAILED", { system_frequency_hz: 49.0, min_voltage_pu: 0.5, max_loading_ratio: 2, zeta_min: 0, epsilon_x_ratio: null }),
  ];
  it("takes the direction per metric, FEASIBLE hours only, metrics with values only", () => {
    const w = Object.fromEntries(worstHours(pts, 50).map((x) => [x.metric, x.hour]));
    expect(w).toEqual({ system_frequency_hz: 0, min_voltage_pu: 1, max_loading_ratio: 1, zeta_min: 1 });
  });
});
