import { describe, expect, it } from "vitest";
import type { AnalysisResult } from "../api-types";
import { bannerText, statusWord } from "./status-text";

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
  const m2 = (notEvaluated: number, margins = 1) =>
    ({ status: "FEASIBLE", status_code: "OK", message: "m", payload: { not_evaluated: Array(notEvaluated).fill({}), constraint_margins: Array(margins).fill({ margin: 1 }) } }) as unknown as AnalysisResult;
  it("says nothing was checked when no margin was evaluated (audit E15)", () => {
    expect(statusWord("M2", m2(9, 0))).toBe("Not evaluated");
    expect(bannerText("M2", m2(9, 0)).headline).toMatch(/^Nothing was checked/);
    expect(statusWord("M2", m2(0))).toBe("Meets the limits");
  });
  it("does not claim every constraint is met when some had no limit", () => {
    expect(bannerText("M2", m2(0)).headline).toBe("The design meets all constraints.");
    expect(bannerText("M2", m2(13)).headline).toContain("13 checks had no limit");
    expect(bannerText("M2", m2(13)).headline).not.toContain("all constraints");
  });
});

describe("BA headline (audit 2026-11-15 B3)", () => {
  const ba = (power: string, autonomy: string) =>
    ({ status: "FEASIBLE", status_code: "OK", message: "m", payload: { banks: [{ power: { outcome: power }, autonomy: { outcome: autonomy } }] } }) as unknown as AnalysisResult;
  it("says Not evaluated only when no bank got a verdict", () => {
    expect(statusWord("BA", ba("NOT_EVALUATED", "NOT_EVALUATED"))).toBe("Not evaluated");
    expect(statusWord("BA", ba("OK", "NOT_EVALUATED"))).toBe("Advice ready");
  });
});
