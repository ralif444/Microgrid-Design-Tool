"use client";
// Axis input shared by S-10 Sweep and S-12 Envelope (Doc 3 §6.5 Axis): PARAMETER, SCALE_FACTOR
// (every element of the chosen kind that has the field, D-56 K98) or LOAD_SCALE λ.
import { useEffect, useState, type ReactNode } from "react";
import { getMeta } from "../api-client";
import type { ProjectSnapshot } from "../api-types";
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
}

// `prefix` keeps ids and labels unique when two axes share a screen ("" for one axis).
export function useAxis(design: ProjectSnapshot, prefix = ""): AxisInput {
  const [kind, setKind] = useState<Kind>("PARAMETER");
  const [path, setPath] = useState("");
  const [coll, setColl] = useState<Coll>("inverters");
  const [field, setField] = useState(FIELDS.inverters[0]);
  const [lo, setLo] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);

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
        <NumberField id={id("min")} label={`${prefix}From`} unit={unit} value={lo} onChange={setLo} />{" "}
        <NumberField id={id("max")} label={`${prefix}To`} unit={unit} value={hi} onChange={setHi} />{" "}
        <NumberField id={id("steps")} label={`${prefix}Points`} unit="count" step="1" value={steps} onChange={setSteps} />
      </p>
    </>
  );
  return {
    axis: { ...shape, range_min: lo, range_max: hi, step_count: steps },
    unit,
    name: kind === "PARAMETER" ? path : kind,
    steps,
    fields,
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
