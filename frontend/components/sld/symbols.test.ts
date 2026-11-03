import { describe, expect, it } from "vitest";
import type { SldElement } from "./buildSldModel";
import { decorations } from "./symbols";

// Doc 12 X8 (FR-94): every element state is an icon plus a word, never colour alone (guideline R6).
const el = (over: Partial<SldElement>): SldElement => ({ kind: "bus", id: "B1", label: "Bus B1", tags: ["B1"], sections: [], mark: null, issues: [], ...over });

describe("SLD state words (FR-94)", () => {
  it("names each state with an icon and a word", () => {
    expect(decorations(el({ mark: "violated" }))).toEqual([{ icon: "misuse", word: "Violated", tone: "negative" }]);
    expect(decorations(el({ mark: "limiting" }))[0].word).toBe("Limiting");
    expect(decorations(el({ mark: "near" }))[0]).toMatchObject({ icon: "warn", word: "Near limit" });
    expect(decorations(el({ issues: ["a", "b"] }))[0]).toMatchObject({ icon: "alert", word: "2 issues" });
    expect(decorations(el({}))).toEqual([]);
  });

  it("says 'not connected' in lowercase for an isolated Bus (FR-14 E2E text)", () => {
    expect(decorations(el({}), true)).toEqual([{ icon: "warn", word: "not connected", tone: "caution" }]);
  });
});
