// Example mode (Doc 12 X9, Doc 7 §2.3, D-92): the guided-example settings file and its type guard.
// The settings are prefill only; they never enter the Project file, the snapshot or a RunRecord.
// Unknown screens and fields are ignored; a value that fails its stage-1 rule is dropped with a
// console warning and listed as not set (needs_value), so no screen ever shows an unchecked value.

export interface ExampleField {
  value: unknown;
  source: string;
}
export interface ExamplePreset {
  id: string;
  label: string;
  source: string;
  fields: { disturbance: Record<string, unknown>; simulation_end_s: number };
}
export interface ExampleScreen {
  fields: Record<string, ExampleField>;
  needs_value: string[];
  presets: ExamplePreset[];
}
export interface ExampleSettings {
  example_settings_version: 1;
  id: string;
  project: string; // example file name, as for getExample
  screens: Record<string, ExampleScreen>;
}

type Check = (v: unknown) => boolean;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const ratio: Check = (v) => num(v) && v >= 0; // Doc 3 §6.1, §6.3: ≥ 0, no default
const oneOf = (xs: readonly unknown[]): Check => (v) => xs.includes(v);
const listOf = (item: Check): Check => (v) => Array.isArray(v) && v.length > 0 && v.every(item);
const PATH = /^(buses|lines|loads|inverters)\/[^/]+\/[a-z_]+$/; // Doc 3 §3.10 form; resolved per Project on use
const AXIS_KINDS = ["PARAMETER", "SCALE_FACTOR", "LOAD_SCALE"];
const axis: Check = (v) => {
  if (v === null || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  const steps = a.step_count === undefined || (Number.isInteger(a.step_count) && (a.step_count as number) >= 1);
  return oneOf(AXIS_KINDS)(a.kind) && num(a.range_min) && num(a.range_max) && a.range_min < a.range_max && steps;
};

// Stage-1 rule per field (Doc 3 §6.1 – §6.6), by screen route.
const FIELD_RULES: Record<string, Record<string, Check>> = {
  sizing: {
    inverter_margin_ratio: ratio,
    unit_count: (v) => Number.isInteger(v) && (v as number) >= 1,
    redundancy: oneOf([0, 1]), // shortcut: r = 1 needs n ≥ 2, checked by stage 1 on Run
  },
  "constraint-check": { inverter_margin_ratio: ratio, line_margin_ratio: ratio },
  sensitivity: {
    parameter_paths: listOf((p) => typeof p === "string" && PATH.test(p)),
    output_metrics: listOf(
      oneOf(["SYSTEM_FREQUENCY", "MIN_BUS_VOLTAGE", "MAX_BUS_VOLTAGE", "MAX_INVERTER_LOADING", "MAX_LINE_CURRENT", "TOTAL_LOSSES", "MAX_Q_SHARING_ERROR"]),
    ),
  },
  sweep: {
    axis,
    point_metrics: listOf(oneOf(["LAMBDA_C", "ZETA_MIN", "RE_LAMBDA_DOM", "INDICATORS"])),
    include_eigenvalues: (v) => typeof v === "boolean",
  },
  envelope: { axis_x: axis, axis_y: axis },
  "small-signal": { tau_in_s: (v) => num(v) && v > 0, damping_threshold_ratio: ratio },
  transient: {},
};

const DISTURBANCE_KINDS = ["LOAD_STEP", "LOAD_SCALING", "REFERENCE_STEP", "INVERTER_OUTAGE"];
const preset = (v: unknown): v is ExamplePreset => {
  if (v === null || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  const f = p.fields as { disturbance?: Record<string, unknown>; simulation_end_s?: unknown } | undefined;
  const d = f?.disturbance;
  const end = f?.simulation_end_s;
  return (
    typeof p.id === "string" &&
    typeof p.label === "string" &&
    typeof p.source === "string" &&
    p.source.trim() !== "" &&
    !!d &&
    oneOf(DISTURBANCE_KINDS)(d.kind) &&
    typeof d.element_id === "string" &&
    num(d.start_time_s) &&
    d.start_time_s >= 0 &&
    num(end) &&
    end > d.start_time_s
  );
};

export function parseExampleSettings(raw: unknown): ExampleSettings | null {
  if (raw === null || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.example_settings_version !== 1 || typeof r.id !== "string" || typeof r.project !== "string") return null;
  if (r.screens === null || typeof r.screens !== "object") return null;
  const screens: Record<string, ExampleScreen> = {};
  for (const [name, s] of Object.entries(r.screens as Record<string, unknown>)) {
    const rules = FIELD_RULES[name];
    if (!rules || s === null || typeof s !== "object") continue; // unknown screen: ignored
    const src = s as Record<string, unknown>;
    const needs = Array.isArray(src.needs_value) ? src.needs_value.filter((x): x is string => typeof x === "string") : [];
    const fields: Record<string, ExampleField> = {};
    for (const [field, e] of Object.entries((src.fields ?? {}) as Record<string, unknown>)) {
      if (!(field in rules)) continue; // unknown field: ignored
      const entry = e as Partial<ExampleField> | null;
      if (entry && typeof entry.source === "string" && entry.source.trim() !== "" && rules[field](entry.value)) {
        fields[field] = { value: entry.value, source: entry.source };
      } else {
        console.warn(`Example settings: ${name}.${field} dropped (no source or fails its rule)`);
        needs.push(field);
      }
    }
    const presets = (Array.isArray(src.presets) ? src.presets : []).filter((p) => {
      if (preset(p)) return true;
      console.warn(`Example settings: a ${name} preset was dropped (fails its rule)`);
      return false;
    }) as ExamplePreset[];
    screens[name] = { fields, needs_value: needs, presets };
  }
  return { example_settings_version: 1, id: r.id, project: r.project, screens };
}

export type ExampleMode = { id: string; settings: ExampleSettings } | null;

// Doc 12 X9 precedence per field (PRD §3 rule 5, D-92 K233): typed > refill from the last run of the
// screen (K149) > example value > empty. Typed values live in the form, so this gives the initial
// value; `source` is set only when the value comes from the example.
export function initialValue(
  example: ExampleMode,
  screen: string,
  field: string,
  refill: unknown,
): { value: unknown; source: string | null } {
  if (refill !== null && refill !== undefined) return { value: refill, source: null };
  const e = example?.settings.screens[screen]?.fields[field];
  return e ? { value: e.value, source: e.source } : { value: null, source: null };
}
