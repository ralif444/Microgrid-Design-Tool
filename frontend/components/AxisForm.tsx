"use client";
// Axis input shared by S-10 Sweep and S-12 Envelope (Doc 3 §6.5 Axis): PARAMETER, SCALE_FACTOR
// (every element of the chosen kind that has the field, D-56 K98) or LOAD_SCALE λ.
import { useEffect, useState, type ReactNode } from "react";
import { getMeta } from "../api-client";
import type { ProjectSnapshot } from "../api-types";
import type { ExampleField } from "../store/example";
import { ExampleTag, NotSet } from "./ExampleForm";
import { FIELDS, numericPaths, unitOf } from "./Further";
import { NumberField } from "./NumberField";

type Kind = "PARAMETER" | "SCALE_FACTOR" | "LOAD_SCALE";
type Coll = keyof typeof FIELDS;

export interface AxisInput {
  axis: Record<string, unknown>; // ready for the request, range and step_count included
  unit: string;
  name: string; // axis label for plots and tables
  steps: number | null;
  fields: ReactNode;
  reset: () => void; // back to the example axis (Doc 12 X9); no-op without one
}

// Example mode (Doc 12 X9, D-92): `ex` is the example axis, `needs` lists what the example leaves
// empty: "step_count", or "axis" for the whole axis. Outside example mode both are absent.
export interface AxisExample {
  ex: ExampleField | null;
  needs: string[];
}

// "axis_x.step_count" → "step_count", "axis_y" → "axis", for the axis named `key`.
export function axisNeeds(needs: string[] | undefined, key: string): string[] {
  return (needs ?? []).filter((n) => n === key || n.startsWith(`${key}.`)).map((n) => (n === key ? "axis" : n.slice(key.length + 1)));
}

// `prefix` keeps ids and labels unique when two axes share a screen ("" for one axis).
// shortcut: the example sets kind, range and step count only (LOAD_SCALE in guided D2); a PARAMETER or
// SCALE_FACTOR example axis would also need its path or element set here.
export function useAxis(design: ProjectSnapshot, prefix = "", example?: AxisExample): AxisInput {
  const init = example?.ex?.value as { kind?: Kind; range_min?: number; range_max?: number; step_count?: number } | undefined;
  const [tagged, setTagged] = useState(!!init);
  const [kind, setKindRaw] = useState<Kind>(init?.kind ?? "PARAMETER");
  const [path, setPath] = useState("");
  const [coll, setColl] = useState<Coll>("inverters");
  const [field, setField] = useState(FIELDS.inverters[0]);
  const [lo, setLoRaw] = useState<number | null>(init?.range_min ?? null);
  const [hi, setHiRaw] = useState<number | null>(init?.range_max ?? null);
  const [steps, setSteps] = useState<number | null>(init?.step_count ?? null);
  // a typed kind or range is the user's, so the "Example" tag goes
  const setKind = (k: Kind) => (setKindRaw(k), setTagged(false));
  const setLo = (v: number | null) => (setLoRaw(v), setTagged(false));
  const setHi = (v: number | null) => (setHiRaw(v), setTagged(false));
  const reset = () => {
    if (!init) return;
    setKindRaw(init.kind ?? "PARAMETER");
    setLoRaw(init.range_min ?? null);
    setHiRaw(init.range_max ?? null);
    setSteps(init.step_count ?? null);
    setTagged(true);
  };
  const needs = example?.needs ?? [];

  const elementSet = (design[coll] ?? [])
    .filter((r) => typeof (r as Record<string, unknown>)[field] === "number")
    .map((r) => `${coll}/${r.id}`);
  const shape =
    kind === "PARAMETER"
      ? { kind, parameter_path: path }
      : kind === "SCALE_FACTOR"
        ? { kind, element_set: elementSet, field }
        : { kind };
  const unit = kind === "PARAMETER" ? unitOf(path) : "factor";
  const id = (s: string) => `${prefix.trim().replace(/\W+/g, "-").toLowerCase() || "axis"}-${s}`;
  const fields = (
    <>
      <p>
        <label htmlFor={id("kind")}>{prefix}Axis</label>{" "}
        <select id={id("kind")} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="PARAMETER">One parameter</option>
          <option value="SCALE_FACTOR">Shared scale factor over a set of elements</option>
          <option value="LOAD_SCALE">Load scale λ (all loads, fixed power factor)</option>
        </select>
        {tagged && example?.ex && <ExampleTag label={`${prefix}Axis`} source={example.ex.source} />}
        {needs.includes("axis") && !tagged && lo === null && hi === null && <NotSet />}
      </p>
      {kind === "PARAMETER" && (
        <p>
          <label htmlFor={id("path")}>{prefix}Parameter</label>{" "}
          <select id={id("path")} value={path} onChange={(e) => setPath(e.target.value)}>
            <option value="">Choose…</option>
            {numericPaths(design).map((pp) => (
              <option key={pp}>{pp}</option>
            ))}
          </select>
        </p>
      )}
      {kind === "SCALE_FACTOR" && (
        <p>
          <label htmlFor={id("coll")}>{prefix}Elements</label>{" "}
          <select
            id={id("coll")}
            value={coll}
            onChange={(e) => {
              const c = e.target.value as Coll;
              setColl(c);
              setField(FIELDS[c][0]);
            }}
          >
            <option value="inverters">Inverters</option>
            <option value="loads">Loads</option>
            <option value="lines">Lines</option>
          </select>{" "}
          <label htmlFor={id("field")}>{prefix}Field</label>{" "}
          <select id={id("field")} value={field} onChange={(e) => setField(e.target.value)}>
            {FIELDS[coll].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>{" "}
          <span>Applies to: {elementSet.join(", ") || "none"}</span>
        </p>
      )}
      <p>
        <NumberField id={id("min")} label={`${prefix}From`} unit={unit} value={lo} onChange={setLo} />
      </p>
      <p>
        <NumberField id={id("max")} label={`${prefix}To`} unit={unit} value={hi} onChange={setHi} />
      </p>
      <p>
        <NumberField
          id={id("steps")}
          label={`${prefix}Points`}
          unit="count"
          step="1"
          value={steps}
          onChange={setSteps}
          note={(needs.includes("step_count") || needs.includes("axis")) && steps === null ? <NotSet /> : undefined}
        />
      </p>
    </>
  );
  return {
    axis: { ...shape, range_min: lo, range_max: hi, step_count: steps },
    unit,
    name: kind === "PARAMETER" ? path : kind,
    steps,
    fields,
    reset,
  };
}

// SWEEP_CAP from /api/meta (null = unknown, e.g. service unreachable).
export function useSweepCap(): number | null {
  const [cap, setCap] = useState<number | null>(null);
  useEffect(() => {
    void getMeta().then((m) => setCap(m.ok ? (m.data.limits.sweep_cap ?? null) : null));
  }, []);
  return cap;
}

export function SizeIndicator({ points, cap }: { points: number | null; cap: number | null }) {
  const over = cap !== null && points !== null && points > cap;
  return (
    <p data-testid="sweep-size" role={over ? "alert" : undefined}>
      Points: {points ?? "—"} of cap {cap ?? "unknown"} ({over ? "too many; the request will be refused" : "ok"})
    </p>
  );
}
