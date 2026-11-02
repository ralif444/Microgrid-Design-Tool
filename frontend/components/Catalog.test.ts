import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../api-types";
import { initialState, projectReducer, type ProjectAction } from "../store";
import { fromEntry, refText } from "./Catalog";

const conductor: CatalogEntry = {
  id: "E1",
  kind: "CONDUCTOR",
  provenance: { manufacturer: "M", model: "C", document: "D", revision: "r1" },
  sources: { r_ohm_per_km: "p. 2", x_ohm_per_km: "p. 2", ampacity_a: "p. 3" },
  conductor: { r_ohm_per_km: 0.5, x_ohm_per_km: 0.3, ampacity_a: 100, shunt_capacitance_uf_per_km: 0.2 },
};

const run = (actions: ProjectAction[]) => actions.reduce(projectReducer, initialState);
const line = (actions: ProjectAction[]) => run(actions).design.lines![0] as Record<string, unknown>;
const setup: ProjectAction[] = [
  { type: "projectCreated", meta: { id: "p", name: "P", created_at: "t" }, nominal_voltage_kv: 0.4, nominal_frequency_hz: 50 },
  { type: "rowAdded", collection: "lines", row: {} },
];

describe("Catalogue copy into a Line (Doc 12 FR-68, FR-69, FR-70)", () => {
  it("copies r and x with catalog_ref; no capacitance, no current limit without confirmation", () => {
    const l = line([...setup, { type: "rowUpdated", collection: "lines", id: "LN1", patch: fromEntry(conductor, 1) }]);
    expect([l.r_ohm_per_km, l.x_ohm_per_km, l.current_limit_a]).toEqual([0.5, 0.3, undefined]);
    expect(JSON.stringify(l)).not.toContain("capacitance");
    expect(refText(l.catalog_ref as never)).toBe("E1");
  });

  it("confirmed ampacity becomes the labelled limit; editing r marks the element and keeps the ref", () => {
    const filled = [...setup, { type: "rowUpdated", collection: "lines", id: "LN1", patch: fromEntry(conductor, 1, true) } as ProjectAction];
    expect(line(filled).current_limit_a).toBe(100);
    const l = line([...filled, { type: "rowUpdated", collection: "lines", id: "LN1", patch: { r_ohm_per_km: 0.6 } }]);
    expect(refText(l.catalog_ref as never)).toBe("E1; modified from catalogue; current limit: datasheet reference conditions");
    expect(refText(line([...filled, { type: "rowUpdated", collection: "lines", id: "LN1", patch: { length_km: 2 } }]).catalog_ref as never)).not.toContain(
      "modified",
    );
  });
});
