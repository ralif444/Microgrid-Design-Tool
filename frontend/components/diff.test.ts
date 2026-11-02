import { describe, expect, it } from "vitest";
import { jsonDiff } from "./diff";

describe("RunRecord diff (Doc 12 FR-83)", () => {
  it("lists changed leaves by path, arrays keyed by id", () => {
    const a = { lines: [{ id: "LN1", r_ohm_per_km: 0.5 }, { id: "LN2", r_ohm_per_km: 1 }], f_hz: 50 };
    const b = { lines: [{ id: "LN2", r_ohm_per_km: 1 }, { id: "LN1", r_ohm_per_km: 0.6 }], f_hz: 50, extra: true };
    expect(jsonDiff(a, b)).toEqual([
      { path: "lines[LN1].r_ohm_per_km", a: 0.5, b: 0.6 },
      { path: "extra", a: undefined, b: true },
    ]);
  });
});
