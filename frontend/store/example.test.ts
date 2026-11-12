import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectFile } from "../api-types";
import { initialState, projectReducer, toProjectFile, type ProjectAction, type ProjectState } from "./index";
import { fromProjectFile } from "./reducer";
import { sha256Hex } from "./canonical";
import { initialValue, parseExampleSettings } from "./example";

// Doc 12 X9 FR-99 – FR-101 (D-92): the guided-example settings guard, the store slice, and that the
// settings never reach the Project file or the snapshot.
const file = (name: string) =>
  JSON.parse(readFileSync(new URL(`../public/examples/${name}`, import.meta.url), "utf-8")) as Record<string, unknown>;
const settingsRaw = file("guided-d2.example.json");
const guided = file("guided-d2.mgproj.json") as unknown as ProjectFile;
const d2 = file("d2.mgproj.json") as unknown as ProjectFile;
const VERSIONS = { schema_version: 1, app_version: "0.1.0" };

afterEach(() => vi.restoreAllMocks());

describe("guided example settings guard", () => {
  it("accepts the shipped file and keeps every value with a source", () => {
    const s = parseExampleSettings(settingsRaw);
    expect(s).not.toBeNull();
    expect(Object.keys(s!.screens).sort()).toEqual([
      "constraint-check", "constraints", "envelope", "loads", "network", "power-flow", "report", "scenarios", "sensitivity", "sizing",
      "small-signal", "sweep", "transient",
    ]);
    for (const screen of Object.values(s!.screens)) {
      for (const f of Object.values(screen.fields)) expect(f.source.trim()).not.toBe("");
      for (const p of screen.presets) expect(p.source.trim()).not.toBe("");
    }
    expect(s!.screens.sizing.fields.inverter_margin_ratio.value).toBe(0.2);
    expect(s!.screens.sensitivity.needs_value).toEqual(["step_relative"]);
    expect(s!.screens.transient.presets.map((p) => p.id)).toEqual(["DR-01", "TS-02", "DR-02"]);
  });

  // FR-102 (D-97 K250): guidance on every screen S-03 – S-16, with a source, and no result numbers.
  // Identifiers that carry digits (D2, INV1, M1, N−1, λ_c) are allowed; a standalone number is not.
  it("gives every example screen guidance with a source and no standalone number", () => {
    const s = parseExampleSettings(settingsRaw)!;
    for (const [name, screen] of Object.entries(s.screens)) {
      expect(screen.guidance, name).not.toBeNull();
      expect(screen.guidance!.source.trim(), name).not.toBe("");
      expect(screen.guidance!.text, name).not.toMatch(/(?<![\p{L}_−-])\d/u);
    }
    expect("load step at 2.5 kW").toMatch(/(?<![\p{L}_−-])\d/u); // the rule does catch a value
    expect("INV1, D2S, M3a, N−1").not.toMatch(/(?<![\p{L}_−-])\d/u);
  });

  it("drops guidance without text or source", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const raw = structuredClone(settingsRaw) as { screens: Record<string, { guidance?: unknown }> };
    raw.screens.loads.guidance = { text: "Some text." };
    expect(parseExampleSettings(raw)!.screens.loads.guidance).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown keys, screens and fields", () => {
    const raw = structuredClone(settingsRaw) as { screens: Record<string, { fields: Record<string, unknown> }> } & Record<string, unknown>;
    raw.extra = 1;
    raw.screens.nowhere = { fields: { x: { value: 1, source: "s" } } };
    raw.screens.sizing.fields.colour = { value: "red", source: "s" };
    const s = parseExampleSettings(raw)!;
    expect(s.screens.nowhere).toBeUndefined();
    expect(s.screens.sizing.fields.colour).toBeUndefined();
    expect(s.screens.sizing.needs_value).toEqual([]);
  });

  it("drops a value that fails its rule or has no source, and lists it as not set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const raw = structuredClone(settingsRaw) as { screens: Record<string, { fields: Record<string, { value: unknown; source: string }>; presets?: unknown[] }> };
    raw.screens.sizing.fields.inverter_margin_ratio.value = -0.1; // Doc 3 §6.1: ≥ 0
    raw.screens.sizing.fields.redundancy.source = " ";
    raw.screens.sweep.fields.axis.value = { kind: "LOAD_SCALE", range_min: 4, range_max: 1 };
    raw.screens.transient.presets![1] = { id: "TS-02", label: "x", source: "s", fields: { disturbance: { kind: "OUTAGE" }, simulation_end_s: 5 } };
    const s = parseExampleSettings(raw)!;
    expect(s.screens.sizing.fields.inverter_margin_ratio).toBeUndefined();
    expect(s.screens.sizing.needs_value).toEqual(["inverter_margin_ratio", "redundancy"]);
    expect(s.screens.sweep.needs_value).toContain("axis");
    expect(s.screens.transient.presets.map((p) => p.id)).toEqual(["DR-01", "DR-02"]);
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("refuses a missing or wrong-version file", () => {
    expect(parseExampleSettings(null)).toBeNull();
    expect(parseExampleSettings("x")).toBeNull();
    expect(parseExampleSettings({ ...settingsRaw, example_settings_version: 2 })).toBeNull();
    expect(parseExampleSettings({ ...settingsRaw, screens: undefined })).toBeNull();
  });
});

describe("example mode in the store (D-92 K233)", () => {
  const settings = parseExampleSettings(settingsRaw)!;
  const opened: ProjectAction = { type: "exampleOpened", file: guided, id: "p1", created_at: "2026-11-05T00:00:00Z" };
  const run = (actions: ProjectAction[]) => actions.reduce(projectReducer, initialState);

  it("enters only with an open Project and leaves on Leave, load, create or another example", () => {
    expect(run([{ type: "exampleEntered", settings }]).example).toBeNull();
    const inMode = run([opened, { type: "exampleEntered", settings }]);
    expect(inMode.example?.id).toBe("guided-d2");
    expect(projectReducer(inMode, { type: "exampleLeft" }).example).toBeNull();
    expect(projectReducer(inMode, { type: "projectLoaded", file: d2 }).example).toBeNull();
    expect(projectReducer(inMode, opened).example).toBeNull();
    const created: ProjectAction = { type: "projectCreated", meta: { id: "n", name: "n", created_at: "t" }, nominal_voltage_kv: null, nominal_frequency_hz: null };
    expect(projectReducer(inMode, created).example).toBeNull();
  });

  it("leaving keeps the Project, its data and its RunRecords", () => {
    const inMode = run([opened, { type: "exampleEntered", settings }]);
    const { example: _e, ...rest } = projectReducer(inMode, { type: "exampleLeft" });
    const { example: _f, ...before } = inMode;
    expect(rest).toEqual(before);
  });

  it("FR-101: the settings never reach the Project file or the snapshot", async () => {
    const plain = run([opened]);
    const inMode = projectReducer(plain, { type: "exampleEntered", settings });
    const saved = toProjectFile(inMode, VERSIONS, "t");
    expect(saved).toEqual(toProjectFile(plain, VERSIONS, "t"));
    expect(JSON.stringify(saved)).not.toContain("example_settings_version");
    expect(await sha256Hex(inMode.design)).toBe(await sha256Hex(plain.design));
  });

  it("FR-101: the guided design hashes like D2 with the same limits entered by hand", async () => {
    const limits = guided.design_constraints as Record<string, number>;
    const byHand = Object.entries(limits).reduce(
      (s, [field, value]) => projectReducer(s, { type: "constraintSet", field: field as never, value }),
      { ...initialState, ...fromProjectFile(d2) } as ProjectState,
    );
    expect(await sha256Hex(fromProjectFile(guided).design)).toBe(await sha256Hex(byHand.design));
  });
});

describe("initialValue precedence (FR-100, D-92 K233)", () => {
  const mode = { id: "guided-d2", settings: parseExampleSettings(settingsRaw)! };

  it("takes the last-run refill over the example, the example over empty", () => {
    expect(initialValue(mode, "constraint-check", "inverter_margin_ratio", 0.3)).toEqual({ value: 0.3, source: null });
    expect(initialValue(mode, "constraint-check", "inverter_margin_ratio", 0)).toEqual({ value: 0, source: null });
    expect(initialValue(mode, "constraint-check", "inverter_margin_ratio", null)).toEqual({
      value: 0.2,
      source: "Author's study setting (demo script step 5, D-70), D-92 K230",
    });
    expect(initialValue(mode, "constraint-check", "autonomy_h", null)).toEqual({ value: null, source: null });
  });

  it("prefills nothing outside example mode (FR-101)", () => {
    expect(initialValue(null, "constraint-check", "inverter_margin_ratio", null)).toEqual({ value: null, source: null });
    expect(initialValue(null, "sizing", "unit_count", 3)).toEqual({ value: 3, source: null });
  });
});
