import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERIES } from "./palette";
import { linearScale, nearestIndex, niceDomain, niceTicks, splitAtNulls } from "./scale";

// Doc 12 X1 (FR-86): chart geometry and palette.
describe("chart scale (FR-86)", () => {
  it("maps a domain onto a range, and a zero span onto the middle", () => {
    expect(linearScale([0, 10], [100, 200])(5)).toBe(150);
    expect(linearScale([0, 10], [200, 100])(10)).toBe(100);
    expect(linearScale([3, 3], [0, 10])(3)).toBe(5);
  });

  it("pads the data range, skips nulls, and widens a single value", () => {
    expect(niceDomain([0, null, 10])).toEqual([-0.8, 10.8]);
    expect(niceDomain([2, 2], 0)).toEqual([1, 3]);
    expect(niceDomain([null])).toEqual([0, 1]);
  });

  it("puts ticks on 1, 2 or 5 steps inside the domain", () => {
    expect(niceTicks([0, 10])).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks([49.7, 50.3])).toEqual([49.7, 49.8, 49.9, 50, 50.1, 50.2, 50.3]);
    expect(niceTicks([0.93, 1.07], 3)).toEqual([0.95, 1, 1.05]);
    expect(niceTicks([4, 4])).toEqual([4]);
  });

  it("snaps to the nearest real sample", () => {
    expect(nearestIndex([0, 1, 2, 4], 2.9)).toBe(2);
    expect(nearestIndex([0, 1, 2, 4], 3.1)).toBe(3);
    expect(nearestIndex([0, 1], -5)).toBe(0);
  });

  it("splits a series at nulls, so a missing value is a gap, never zero", () => {
    expect(splitAtNulls([1, 2, null, 4, null, null, 7])).toEqual([[0, 1], [3], [6]]);
    expect(splitAtNulls([null, null])).toEqual([]);
    expect(splitAtNulls([1, Number.NaN, 3])).toEqual([[0], [2]]);
  });

  it("uses no status colour for a series (guideline §1 rule 4)", () => {
    // series values per theme from tokens.css; status: @carbon/colors support values and the role colours
    const css = readFileSync(new URL("../../app/tokens.css", import.meta.url), "utf8");
    const series = [...css.matchAll(/--series-\d: (#[0-9a-f]{6})/g)].map((m) => m[1]);
    const status = ["#24a148", "#42be65", "#198038", "#da1e28", "#fa4d56", "#ff832b", "#f1c21b", "#0043ce", "#4589ff",
      "#b53b0b", "#f0834a", "#8a5a0b", "#e0b050", "#a2191f", "#ffb3b8"];
    expect(SERIES).toEqual([1, 2, 3, 4, 5].map((k) => `var(--series-${k})`));
    expect(series).toHaveLength(10); // light and dark
    expect(series.filter((c) => status.includes(c))).toEqual([]);
    expect(new Set(series.slice(0, 5)).size).toBe(5);
    expect(new Set(series.slice(5)).size).toBe(5);
  });
});
