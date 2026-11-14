import { describe, expect, it } from "vitest";
import { decimalSeparator, localize, translate } from "./i18n";

describe("i18n", () => {
  it("falls back to English while the Indonesian strings are missing", () => {
    expect(translate("en", "area.model")).toBe("Model");
    expect(translate("id", "area.model")).toBe("Model");
  });
  it("swaps the decimal separator through Intl, without grouping", () => {
    expect(decimalSeparator("en")).toBe(".");
    expect(decimalSeparator("id")).toBe(",");
    expect(localize("1500.25", "id")).toBe("1500,25");
    expect(localize("-0.044", "en")).toBe("-0.044");
    expect(localize("1e-7", "id")).toBe("1e-7");
  });
});
