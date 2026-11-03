import { describe, expect, it } from "vitest";
import { num } from "./M2Results";

describe("K147 number display", () => {
  it("hides unit round-trip noise and keeps real digits", () => {
    expect(num(49.75000000000001)).toBe(49.75);
    expect(num(0.12736)).toBe(0.12736);
    expect(num(-0.5)).toBe(-0.5);
  });
});
