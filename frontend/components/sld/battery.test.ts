import { describe, expect, it } from "vitest";
import type { BatteryBank, ProjectSnapshot } from "../../api-types";
import { buildSldModel } from "./buildSldModel";

// Battery round BESS-2 (Doc 12 FR-75, guideline §5; D-108): one design-data row, no symbol.
const design: ProjectSnapshot = { buses: [{ id: "B1" }], inverters: [{ id: "INV1", bus_id: "B1" }] } as ProjectSnapshot;
const bank = { inverter_id: "INV1", module: { catalog_ref: { entry_id: "MOD-T1", provenance: {}, catalog_schema_version: 1 } }, series_count: 8, parallel_count: 2 } as BatteryBank;

describe("FR-75 battery bank row in the SLD tooltip and Inspector", () => {
  it("the SLD inverter rows gain one battery-bank row, none without a bank", () => {
    const row = (banks: BatteryBank[]) =>
      buildSldModel({ design: design, banks }).inverters[0].sections[0].rows.filter((r) => r.label === "Battery bank");
    expect(row([])).toEqual([]);
    expect(row([bank])).toEqual([{ label: "Battery bank", value: "8 × 2 of MOD-T1" }]);
  });
});
