import { describe, expect, it } from "vitest";
import { keep, keptKey, keptOr } from "./useKept";

describe("kept study inputs (audit O4)", () => {
  it("returns the kept value per Project, screen and key, else the initial value", () => {
    const a = keptKey("p1", "/sweep/", "metric");
    expect(keptOr(a, "system_frequency_hz")).toBe("system_frequency_hz");
    keep(a, "min_bus_voltage_pu");
    expect(keptOr(a, "system_frequency_hz")).toBe("min_bus_voltage_pu");
    expect(keptOr(keptKey("p2", "/sweep/", "metric"), () => "x")).toBe("x"); // another Project starts fresh
    expect(keptOr(keptKey("p1", "/envelope/", "metric"), null)).toBeNull(); // another screen too
  });
});
