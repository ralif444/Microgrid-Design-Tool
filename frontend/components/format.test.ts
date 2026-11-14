import { describe, expect, it } from "vitest";
import { fixed, num, parseNumber } from "./format";

describe("F1 locale-safe number input", () => {
  it("accepts a dot or a comma as decimal separator", () => {
    expect(parseNumber("0.44")).toBe(0.44);
    expect(parseNumber(" 0,44 ")).toBe(0.44);
    expect(parseNumber("-0,5")).toBe(-0.5);
    expect(parseNumber("1e-3")).toBe(0.001);
    expect(parseNumber(",5")).toBe(0.5);
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("0,440")).toBe(0.44);
  });
  it("returns null for empty and undefined for anything else", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("  ")).toBeNull();
    for (const s of ["abc", "1.234,5", "1,2,3", "0x10", "-", "1,500", "12,000"]) expect(parseNumber(s)).toBeUndefined();
  });
  it("refuses fractions where an integer is required", () => {
    expect(parseNumber("3", true)).toBe(3);
    expect(parseNumber("2,5", true)).toBeUndefined();
  });
});

describe("K147 number display", () => {
  it("hides unit round-trip noise and keeps real digits", () => {
    expect(num(49.75000000000001)).toBe(49.75);
    expect(num(0.12736)).toBe(0.12736);
    expect(num(-0.5)).toBe(-0.5);
  });
});

describe("W1 result decimals per unit", () => {
  it("fixes decimals by unit", () => {
    expect(fixed(49.877363, "Hz")).toBe("49.877");
    expect(fixed(49.75000000000001, "Hz")).toBe("49.750");
    expect(fixed(15.4112, "kW")).toBe("15.41");
    expect(fixed(0.988612, "p.u.")).toBe("0.9886");
    expect(fixed(-0.1534, "deg")).toBe("-0.15");
    expect(fixed(0.23512, "ratio")).toBe("0.235");
    expect(fixed(21.84, "A")).toBe("21.8");
    expect(fixed(0, "kW")).toBe("0.00");
  });
  it("never hides a small value or an unknown unit", () => {
    expect(fixed(0.043, "kW")).toBe("0.043");
    expect(fixed(0.00003, "p.u.")).toBe("0.00003");
    expect(fixed(12, "count")).toBe("12");
    expect(fixed(0.40000000001, "kV")).toBe("0.4");
  });
});
