import { describe, expect, it } from "vitest";
import { dashIndex, DASH, SERIES } from "./palette";

describe("dashIndex (Phase 5)", () => {
  it("gives every series up to colours × dashes its own colour and dash pair", () => {
    const n = SERIES.length * DASH.length;
    const pairs = new Set(Array.from({ length: n }, (_, k) => `${k % SERIES.length}/${dashIndex(k)}`));
    expect(pairs.size).toBe(n);
    expect(dashIndex(0)).toBe(0);
    expect(dashIndex(5)).not.toBe(0);
  });
});
