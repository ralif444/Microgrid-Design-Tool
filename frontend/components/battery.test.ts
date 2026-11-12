import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../api-types";
import { admissibleSeries, moduleHint, noPowerCapability, socSeries } from "./battery";

// Fictitious TEST ONLY module MOD-T1 and hand values of docs/BESS_VERIFICATION_FRAMEWORK.md §3.1, §3.2.
const MOD_T1 = { energy_kwh: 5, voltage_min_v: 44.8, voltage_max_v: 57.6, discharge_power_kw: 2.5 };
const E_NOM = 100 / 0.95 / 0.8; // PS Eq. 4.13 on PF-T, 4 h, η_dc 0.95, DoD 0.8

describe("FR-74 module hint (Eq. 12.3 – 12.5)", () => {
  it("V1: window W-A fits, smallest series count used", () => {
    const h = moduleHint(E_NOM, MOD_T1, { min: 350, max: 800 });
    expect(h).toMatchObject({ verdict: "fit", series: [8, 9, 10, 11, 12, 13], moduleCount: 27, ns: 8, np: 4, installedCount: 32, installedKwh: 160 });
    if (h.verdict === "fit") expect(h.extraKwh).toBeCloseTo(28.4211, 4);
  });

  it("V2: window W-B gives no-fit, module count still shown", () => {
    expect(moduleHint(E_NOM, MOD_T1, { min: 400, max: 440 })).toMatchObject({ verdict: "no-fit", series: [], moduleCount: 27, np: null });
  });

  it("missing window is unknown; missing nominal energy is not evaluated", () => {
    expect(moduleHint(E_NOM, MOD_T1, { min: null, max: 800 })).toMatchObject({ verdict: "unknown", moduleCount: 27 });
    expect(moduleHint(null, MOD_T1, { min: 350, max: 800 })).toEqual({ verdict: "not evaluated", reason: "PS has no nominal energy" });
  });

  it("a picked series count inside the range is used, outside it falls back to the smallest", () => {
    expect(moduleHint(E_NOM, MOD_T1, { min: 350, max: 800 }, 10)).toMatchObject({ ns: 10, np: 3, installedCount: 30 });
    expect(moduleHint(E_NOM, MOD_T1, { min: 350, max: 800 }, 20)).toMatchObject({ ns: 8 });
  });

  it("boundary products count exactly", () => {
    expect(admissibleSeries(40, 50, 400, 500)).toEqual([10]);
    expect(admissibleSeries(0.1, 0.1, 0.3, 0.3)).toEqual([3]); // 3 × 0.1 is not 0.3 in floating point
  });
});

describe("FR-73 power capability warning", () => {
  const e = (m: CatalogEntry["battery_module"]): CatalogEntry => ({ id: "M", kind: "BATTERY_MODULE", provenance: {}, sources: {}, battery_module: m });
  it("warns only without both discharge power and C-rate", () => {
    expect(noPowerCapability(e({ energy_kwh: 5 }))).toBe(true);
    expect(noPowerCapability(e({ energy_kwh: 5, c_rate_per_h: 0.2 }))).toBe(false);
    expect(noPowerCapability(e(MOD_T1))).toBe(false);
  });
});

describe("FR-120 depletion chart data", () => {
  it("starts at SoC_0, stops after depletion, adds the limit line", () => {
    const curve = [0.9, 0.5, 0.1].map((soc, j) => ({ step: j, clock_hour: j, inverter_p_kw: 1, cumulative_energy_kwh: j, soc_ratio: soc }));
    const p = { caveat_text: "", hours: [], banks: [{ inverter_id: "INV1", bank: { series_count: 1, parallel_count: 1, module_count: 1, energy_kwh: 5 }, power: {} as never, autonomy: { outcome: "DEPLETED" as const, reason: null, usable_energy_kwh: 1, start_hour: 0, autonomy_h: 2.5, depletion_clock_hour: 2, end_soc_ratio: null, curve } }] };
    const { x, series } = socSeries(p, [{ inverter_id: "INV1", depth_of_discharge_ratio: 0.8, initial_soc_ratio: 1 }]);
    expect(x).toHaveLength(25);
    expect(series[0].values.slice(0, 5)).toEqual([1, 0.9, 0.5, 0.1, null]);
    expect(series[1].name).toBe("INV1 discharge limit");
    expect(series[1].values[24]).toBeCloseTo(0.2, 12);
  });
});
