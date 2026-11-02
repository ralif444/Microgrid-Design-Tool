import { describe, expect, it } from "vitest";
import type { RunRecord } from "../api-types";
import { indicatorRows, indicatorText } from "./IndicatorPanel";

const rec = (analysis_type: string, snapshot_hash: string, payload: unknown) =>
  ({ analysis_type, snapshot_hash, record_id: analysis_type, result_hash: "h", result: { status: "FEASIBLE", payload } }) as unknown as RunRecord;

const ind = (value: number | null, reason: string | null = null) => ({ value, evaluated: value !== null, reason });

describe("Validity-indicator rows (Doc 12 FR-61, FR-61a)", () => {
  it("shows M4a values as given, never a blank or zero for one not evaluated", () => {
    const m4a = rec("M4a", "s1", { indicators: { r_tau: ind(0.5), kappa: ind(2), r_in: ind(null, "no tau_in"), epsilon_x: ind(0.01) } });
    const rows = indicatorRows([m4a], "s1");
    expect(rows.map((r) => r.assumption)).toEqual(["A1", "A1", "A2", "A4"]);
    expect(rows.map(indicatorText)).toEqual(["0.5", "2", "not evaluated: no tau_in", "0.01"]);
  });

  it("falls back to ε_X of M1 and ignores runs on another design", () => {
    const m1 = rec("M1", "s1", { epsilon_x_ratio: 0.02 });
    const old = rec("M4a", "s0", { indicators: { r_tau: ind(9), kappa: ind(9), r_in: ind(9), epsilon_x: ind(9) } });
    const rows = indicatorRows([old, m1], "s1");
    expect(rows[3].value).toBe(0.02);
    expect(rows[3].record).toBe(m1);
    expect(rows[0].reason).toBe("run small-signal (M4a) on the current design");
  });
});
