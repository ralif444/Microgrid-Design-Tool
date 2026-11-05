import { describe, expect, it } from "vitest";
import { GLOSSARY, UNIT_TERM } from "./glossary";

describe("FR-91 glossary", () => {
  const entries = Object.values(GLOSSARY);
  it("every entry has a term, a text and a source", () => {
    for (const e of entries) {
      expect(e.term).not.toBe("");
      expect(e.short).not.toBe("");
      expect(e.source).toMatch(/^(Naskah|Doc 3)/);
    }
  });
  it("carries no out-of-scope term (guideline §1 rule 8)", () => {
    const text = entries.map((e) => `${e.term} ${e.short}`).join(" ");
    expect(text).not.toMatch(/\b(GFL|PLL|VSM|grid-following|virtual impedance|secondary control|harmonic|short circuit)\b/i);
  });
  it("every unit term points at an entry", () => {
    for (const k of Object.values(UNIT_TERM)) expect(GLOSSARY[k]).toBeDefined();
  });
});
