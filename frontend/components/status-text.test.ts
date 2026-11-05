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

describe("M2 FEASIBLE headline (WP 1.7.4)", () => {
  const m2 = (notEvaluated: number) =>
    ({ status: "FEASIBLE", status_code: "OK", message: "m", payload: { not_evaluated: Array(notEvaluated).fill({}) } }) as unknown as AnalysisResult;
  it("does not claim every constraint is met when some had no limit", () => {
    expect(bannerText("M2", m2(0)).headline).toBe("The design meets all constraints.");
    expect(bannerText("M2", m2(13)).headline).toContain("13 check(s) had no limit");
    expect(bannerText("M2", m2(13)).headline).not.toContain("all constraints");
  });
});
