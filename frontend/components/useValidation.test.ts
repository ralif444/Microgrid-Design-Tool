import { describe, expect, it } from "vitest";
import type { ValidationReport } from "../api-types";
import { m1Freshness } from "./useValidation";

const report = (hash: string) => ({ snapshot_hash: hash }) as ValidationReport;

describe("m1Freshness", () => {
  it("is missing without an M1 run", () => expect(m1Freshness(null, report("a"))).toBe("missing"));
  it("is checking until the live check answers, never stale", () => expect(m1Freshness("a", null)).toBe("checking"));
  it("compares the M1 snapshot hash with the current one", () => {
    expect(m1Freshness("a", report("a"))).toBe("current");
    expect(m1Freshness("a", report("b"))).toBe("stale");
  });
});
