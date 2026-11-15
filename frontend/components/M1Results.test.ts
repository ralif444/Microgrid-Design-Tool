import { describe, expect, it } from "vitest";
import type { M2Payload } from "../api-types";
import { statusCell } from "./M1Results";

const m2 = {
  constraint_margins: [{ kind: "LINE_CURRENT", element_id: "LN1", value: 30, limit: 25, margin: -5, normalised_margin: -0.2, unit: "A" }],
  not_evaluated: [{ kind: "LINE_CURRENT", element_id: "LN2" }],
} as unknown as M2Payload;

describe("statusCell", () => {
  it("names the missing check, a missing limit and a pending threshold in words", () => {
    expect(statusCell("LN1", ["LINE_CURRENT"], null, 0.05)).toBe("Run the constraint check");
    expect(statusCell("LN2", ["LINE_CURRENT"], m2, 0.05)).toBe("Not evaluated");
    expect(statusCell("LN3", ["LINE_CURRENT"], m2, 0.05)).toBe("—");
    expect(statusCell("LN1", ["LINE_CURRENT"], m2, null)).not.toBe("Checking"); // a violation needs no threshold
  });
});
