import { describe, expect, it } from "vitest";
import { m4bKpis } from "./kpi";
import type { M4bPayload } from "../api-types";

describe("m4bKpis (FR-87)", () => {
  it("shows the class with its icon, settled and the RoCoF as given", () => {
    const k = m4bKpis({ transient_class: "CRITERIA_VIOLATED", settled: true, max_rocof_hz_per_s: 0.5 } as unknown as M4bPayload);
    expect(k.map((t) => [t.label, t.value])).toEqual([
      ["Transient class", "CRITERIA_VIOLATED"],
      ["Settled", "yes"],
      ["Largest RoCoF", 0.5],
    ]);
    expect(k[0]).toMatchObject({ icon: "warn", detail: undefined });
  });
  it("says not classified with the reason, and keeps a null settled as null", () => {
    const k = m4bKpis({ transient_class: null, class_reason: "no settling criteria given", settled: null, max_rocof_hz_per_s: 0 } as unknown as M4bPayload);
    expect(k[0]).toMatchObject({ value: "not classified", icon: undefined, detail: "no settling criteria given" });
    expect(k[1]).toMatchObject({ value: null, detail: "not judged: no settling criteria" });
  });
});
