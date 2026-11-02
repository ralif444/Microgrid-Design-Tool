import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../api-types";
import { initialState, projectReducer, type ProjectAction } from "../store";
import { catalogHints, entryWarnings, fromEntry, refText, tauInSource } from "./Catalog";

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

const inv = (id: string, rated_kva: number, tau_in_s?: number): CatalogEntry => ({ id, kind: "INVERTER", inverter: { rated_kva, tau_in_s } });

describe("PS hint (Doc 12 FR-72)", () => {
  it("lists the usable inverter entries meeting the unit rating and leaves the advice untouched", () => {
    const entries = [inv("E1", 5), inv("E2", 10), inv("E3", 20), inv("E4", 30), conductor];
    const checks = ["E1", "E2", "E3", "E4"].map((id) => ({ entry_id: id, usable: id !== "E4", reasons: [] }));
    const advice = { unit_rating_kva: 10 };
    const before = JSON.stringify(advice);
    expect(catalogHints(entries, advice.unit_rating_kva, checks).map((e) => e.id)).toEqual(["E2", "E3"]);
    expect(JSON.stringify(advice)).toBe(before);
  });
});

describe("Mismatch warnings (D-61 K114)", () => {
  const e: CatalogEntry = {
    id: "E1",
    kind: "INVERTER",
    inverter: {
      rated_kva: 10,
      nominal_voltage_kv: 0.4,
      nominal_frequency_hz: 50,
      frequency_droop_min_hz_per_kw: 0.01,
      frequency_droop_max_hz_per_kw: 0.1,
      voltage_droop_min_kv_per_kvar: 0.001,
      voltage_droop_max_kv_per_kvar: 0.01,
    },
  };
  it("warns on a nominal mismatch or a droop gain outside the range; silent when all match or are unset", () => {
    const w = entryWarnings(e, { nominal_voltage_kv: 0.44, nominal_frequency_hz: 50 }, { frequency_droop_hz_per_kw: 0.2, voltage_droop_kv_per_kvar: 0.005 });
    expect(w).toHaveLength(2);
    expect(w[0]).toContain("0.44 kV");
    expect(w[1]).toContain("P–f droop 0.2");
    expect(entryWarnings(e, { nominal_voltage_kv: 0.4, nominal_frequency_hz: 50 }, { frequency_droop_hz_per_kw: 0.05 })).toEqual([]);
    expect(entryWarnings(conductor, { nominal_voltage_kv: 0.44 }, {})).toEqual([]);
  });
});

describe("τ_in pre-fill (Doc 12 FR-71, D-61 K116)", () => {
  const ref = (e: CatalogEntry) => ({ catalog_ref: fromEntry(e, 1).catalog_ref as never });
  it("pre-fills one shared value; none without τ_in or when entries disagree", () => {
    expect(tauInSource([ref(inv("E1", 10, 0.002)), {}]).from?.tau_in_s).toBe(0.002);
    expect(tauInSource([ref(inv("E1", 10))])).toEqual({ from: null, conflict: false });
    expect(tauInSource([ref(inv("E1", 10, 0.002)), ref(inv("E2", 10, 0.003))])).toEqual({ from: null, conflict: true });
  });
});
