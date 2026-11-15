import { describe, expect, it } from "vitest";
import type { LimitingConstraint, M2Payload } from "../api-types";
import { countsText } from "./CheckStrip";
import { marginStatus } from "./M2Results";

const lc = (margin: number, normalised_margin: number) => ({ element_id: "B1", kind: "BUS_VOLTAGE_MIN", value: 1, limit: 1, unit: "p.u.", margin, normalised_margin }) as LimitingConstraint;

// W3 status strip and margins table share one status rule (FR-26 near limit, Eq. 4.18).
describe("margin status and strip counts (W3)", () => {
  it("classifies violated, near limit and pass", () => {
    expect(marginStatus(lc(-0.1, -0.1), 0.05)).toBe("violated");
    expect(marginStatus(lc(0.01, 0.02), 0.05)).toBe("near");
    expect(marginStatus(lc(0.01, 0.02), null)).toBe("pass"); // no MARGIN_WARN yet: not judged near
    expect(marginStatus(lc(0.5, 0.5), 0.05)).toBe("pass");
  });

  it("counts near-limit rows as passing and leaves zero counts out", () => {
    const p = { constraint_margins: [lc(0.5, 0.5), lc(0.01, 0.02), lc(-1, -1)], not_evaluated: [{}, {}] } as unknown as M2Payload;
    expect(countsText(p, 0.05)).toBe("2 pass (1 near limit), 1 violated, 2 not evaluated");
    expect(countsText({ constraint_margins: [lc(0.5, 0.5)], not_evaluated: [] } as unknown as M2Payload, 0.05)).toBe("1 pass");
  });
});
