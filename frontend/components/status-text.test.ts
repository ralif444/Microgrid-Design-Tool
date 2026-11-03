import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../api-types";
import { bannerText } from "./status-text";

const dep = (reason?: string) =>
  ({ status: "UNAVAILABLE", status_code: "DEPENDENCY_NOT_MET", message: "m", diagnostics: reason ? { dependency_reason: reason } : {} }) as unknown as AnalysisResult;

describe("NFR-06 DEPENDENCY_NOT_MET banner per reason (Doc 7 §5, WP 1.7.2)", () => {
  it("names missing, stale and not-usable M1 with their own next step", () => {
    expect(bannerText("M2", dep()).hint).toBe("Go to Power flow and run M1.");
    expect(bannerText("M2", dep("MISSING")).hint).toBe("Go to Power flow and run M1.");
    expect(bannerText("M2", dep("STALE")).hint).toBe("Re-run M1, then retry.");
    expect(bannerText("M2", dep("ALTERED")).hint).toBe("Re-run M1, then retry.");
    expect(bannerText("M2", dep("NOT_FEASIBLE")).hint).toBe("Fix the M1 problem first.");
  });
});
