import { describe, expect, it } from "vitest";
import type { M4aPayload } from "../api-types";
import { GUIDANCE, needsReactorAdvice } from "./ReactorAdvice";

// X11 F4 (FR-126): fixed qualitative guidance, shown when M4a is not STABLE or misses its threshold.
describe("reactor guidance (FR-126)", () => {
  it("carries no numbers", () => expect(GUIDANCE).not.toMatch(/\d/));
  it("is shown only for an unstable or under-damped result", () => {
    const p = (stability_class: string, damping_pass: boolean | null) => ({ stability_class, damping_pass }) as unknown as M4aPayload;
    expect(needsReactorAdvice(null)).toBe(false);
    expect(needsReactorAdvice(p("STABLE", true))).toBe(false);
    expect(needsReactorAdvice(p("STABLE", null))).toBe(false);
    expect(needsReactorAdvice(p("STABLE", false))).toBe(true);
    expect(needsReactorAdvice(p("UNSTABLE", null))).toBe(true);
  });
});
