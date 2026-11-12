import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProjectFile, RunRecord } from "../api-types";
import { fromProjectFile } from "../store/reducer";
import { parseExampleSettings } from "../store/example";
import { stepRequest } from "./RunWholeExample";

// Doc 12 X9 FR-104 (D-98): what each step of "Run the whole example" sends.
const file = (name: string) => JSON.parse(readFileSync(new URL(`../public/examples/${name}`, import.meta.url), "utf-8"));
const settings = parseExampleSettings(file("guided-d2.example.json"))!;
const s = { ...fromProjectFile(file("guided-d2.mgproj.json") as ProjectFile), runRecords: [] as RunRecord[] };

describe("run the whole example: step requests", () => {
  it("sends the example values, and skips steps the example leaves unset", () => {
    expect(stepRequest("PS", "sizing", s, settings)?.parameters).toEqual({ inverter_margin_ratio: 0.2, unit_count: 2, redundancy: 0 });
    expect(stepRequest("M2", "constraint-check", s, settings)?.parameters).toEqual({ inverter_margin_ratio: 0.2, line_margin_ratio: 0.2 });
    for (const [t, screen] of [["M3a", "sensitivity"], ["M3b", "sweep"], ["M3d", "envelope"]] as const)
      expect(stepRequest(t, screen, s, settings), t).toBeNull(); // NEEDS VALUE (D-92 K231)
    expect(stepRequest("M4a", "small-signal", s, settings)?.parameters).toEqual({});
    const m4b = stepRequest("M4b", "transient", s, settings)!.parameters as Record<string, unknown>;
    expect(m4b).toEqual({ disturbance: settings.screens.transient.presets[0].fields.disturbance, simulation_end_s: 4 }); // DR-01, no settling
    expect(stepRequest("M3c", "scenarios", s, settings)!.scenarios!.map((x) => x.label)).toEqual(["D2 base", "D2S load × 2.4", "D2H load × 4.0"]);
  });

  it("prefers the last run of a step over the example, as its screen does", () => {
    const rec = { analysis_type: "M3a", result: { status: "FEASIBLE" }, parameters: { step_relative: 0.01 } } as unknown as RunRecord;
    expect(stepRequest("M3a", "sensitivity", { ...s, runRecords: [rec] }, settings)?.parameters).toEqual({ step_relative: 0.01 });
  });
});
