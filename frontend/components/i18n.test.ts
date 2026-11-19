import { afterEach, describe, expect, it } from "vitest";
import { fixed } from "./format";
import { decimalSeparator, ID, localize, setDisplayLang, translate } from "./i18n";

describe("i18n", () => {
  afterEach(() => setDisplayLang("en"));
  it("keeps the manuscript area names and English text as the key", () => {
    expect(translate("en", "area.model")).toBe("Model");
    expect(translate("id", "area.check")).toBe("Pemeriksaan");
    expect(translate("en", "Run M1")).toBe("Run M1");
    expect(translate("id", "no such text {x}", { x: 3 })).toBe("no such text 3");
  });
  it("looks up Indonesian text and fills placeholders", () => {
    const key = Object.keys(ID).find((k) => k.includes("{count}"));
    expect(key).toBeDefined();
    expect(translate("id", key!, { count: 2 })).toBe(ID[key!].replaceAll("{count}", "2"));
    expect(translate("en", key!, { count: 2 })).toBe(key!.replaceAll("{count}", "2"));
  });
  it("swaps the decimal separator through Intl, without grouping", () => {
    expect(decimalSeparator("en")).toBe(".");
    expect(decimalSeparator("id")).toBe(",");
    expect(localize("1500.25", "id")).toBe("1500,25");
    expect(localize("-0.044", "en")).toBe("-0.044");
    expect(localize("1e-7", "id")).toBe("1e-7");
  });
  it("localizes fixed() with the display language", () => {
    const en = fixed(0.95, "pu");
    setDisplayLang("id");
    expect(fixed(0.95, "pu")).toBe(en.replace(".", ","));
  });
});
