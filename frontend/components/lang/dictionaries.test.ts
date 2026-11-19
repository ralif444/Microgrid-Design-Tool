import { describe, expect, it } from "vitest";
import { ID_MODEL } from "./id-model";
import { ID_PAGES } from "./id-pages";
import { ID_REPORT } from "./id-report";
import { ID_SHARED } from "./id-shared";
import { ID_SHELL } from "./id-shell";
import { ID_STUDIES } from "./id-studies";

const GROUPS = { ID_SHELL, ID_PAGES, ID_MODEL, ID_STUDIES, ID_REPORT, ID_SHARED };

describe("Indonesian dictionaries", () => {
  it("give one translation per English text across groups", () => {
    const seen = new Map<string, string>();
    const conflicts: string[] = [];
    for (const d of Object.values(GROUPS))
      for (const [k, v] of Object.entries(d)) {
        if (seen.has(k) && seen.get(k) !== v) conflicts.push(`${k} => ${seen.get(k)} | ${v}`);
        seen.set(k, v);
      }
    expect(conflicts).toEqual([]);
  });
  it("keep every {placeholder} of the English key", () => {
    const bad = Object.values(GROUPS).flatMap((d) =>
      Object.entries(d).filter(([k, v]) => (k.match(/\{\w+\}/g) ?? []).some((p) => !v.includes(p))).map(([k]) => k),
    );
    expect(bad).toEqual([]);
  });
});
