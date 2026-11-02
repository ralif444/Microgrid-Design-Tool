"use client";
// S-10 Sweep (M3b) (Doc 7 §6.5, F4): one axis, range and point count; size indicator against
// SWEEP_CAP from /api/meta; over the cap the request is still sendable and comes back
// INPUT_INVALID / SWEEP_CAP_EXCEEDED (Doc 7 §3.1).
import { useEffect, useState } from "react";
import { getMeta } from "../../api-client";
import type { KeyMetrics, M3bPayload } from "../../api-types";
import { FIELDS, fmt, InfeasibleNote, numericPaths, unitOf, useDependentRun } from "../../components/Further";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { ConstraintTable } from "../../components/M2Results";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { SweepChart } from "../../components/SweepChart";

type Kind = "PARAMETER" | "SCALE_FACTOR" | "LOAD_SCALE";
type Coll = keyof typeof FIELDS;

const KEY_METRICS: [keyof KeyMetrics, string][] = [
  ["system_frequency_hz", "System frequency (Hz)"],
  ["min_voltage_pu", "Lowest bus voltage (pu)"],
  ["max_loading_ratio", "Highest inverter loading (ratio)"],
  ["total_losses_kw", "Total line losses (kW)"],
  ["epsilon_x_ratio", "ε_X validity indicator (ratio)"],
];

function Sweep() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3b");
  const [kind, setKind] = useState<Kind>("PARAMETER");
  const [path, setPath] = useState("");
  const [coll, setColl] = useState<Coll>("inverters");
  const [field, setField] = useState(FIELDS.inverters[0]);
  const [lo, setLo] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [cap, setCap] = useState<number | null>(null);
  const [metric, setMetric] = useState<keyof KeyMetrics>("system_frequency_hz");
  useEffect(() => {
    void getMeta().then((m) => setCap(m.ok ? (m.data.limits.sweep_cap ?? null) : null));
  }, []);

  // D-56 K98: SCALE_FACTOR applies to every element of the chosen kind that has the field.
  const elementSet = (design[coll] ?? [])
    .filter((r) => typeof (r as Record<string, unknown>)[field] === "number")
    .map((r) => `${coll}/${r.id}`);
  const axis =
    kind === "PARAMETER"
      ? { kind, parameter_path: path }
      : kind === "SCALE_FACTOR"
        ? { kind, element_set: elementSet, field }
        : { kind };
  const unit = kind === "PARAMETER" ? unitOf(path) : "factor";
  const over = cap !== null && steps !== null && steps > cap;

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3bPayload) : null;
  return (
    <>
      <h1>Sweep (M3b)</h1>
      <M1FreshnessBadge f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Sweep settings"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { axis: { ...axis, range_min: lo, range_max: hi, step_count: steps } } });
        }}
      >
        <p>
          <label htmlFor="axis-kind">Axis</label>{" "}
          <select id="axis-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="PARAMETER">One parameter</option>
            <option value="SCALE_FACTOR">Shared scale factor over a set of elements</option>
            <option value="LOAD_SCALE">Load scale λ (all loads, fixed power factor)</option>
          </select>
        </p>
        {kind === "PARAMETER" && (
          <p>
            <label htmlFor="axis-path">Parameter</label>{" "}
            <select id="axis-path" value={path} onChange={(e) => setPath(e.target.value)}>
              <option value="">Choose…</option>
              {numericPaths(design).map((pp) => (
                <option key={pp}>{pp}</option>
              ))}
            </select>
          </p>
        )}
        {kind === "SCALE_FACTOR" && (
          <p>
            <label htmlFor="axis-coll">Elements</label>{" "}
            <select
              id="axis-coll"
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
            <label htmlFor="axis-field">Field</label>{" "}
            <select id="axis-field" value={field} onChange={(e) => setField(e.target.value)}>
              {FIELDS[coll].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>{" "}
            <span>Applies to: {elementSet.join(", ") || "none"}</span>
          </p>
        )}
        <p>
          <NumberField id="range-min" label="From" unit={unit} value={lo} onChange={setLo} />{" "}
          <NumberField id="range-max" label="To" unit={unit} value={hi} onChange={setHi} />{" "}
          <NumberField id="step-count" label="Points" unit="count" step="1" value={steps} onChange={setSteps} />
        </p>
        <p data-testid="sweep-size" role={over ? "alert" : undefined}>
          Points: {steps ?? "—"} of cap {cap ?? "unknown"} ({over ? "too many; the request will be refused" : "ok"})
        </p>
        <button type="submit" disabled={busy || fresh !== "current"}>
          {busy ? "Running..." : "Run sweep"}
        </button>
      </form>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M3b" result={r} />}
      {p && (
        <>
          <p data-testid="first-infeasible">
            First infeasible value:{" "}
            {p.first_infeasible_value === null ? "none in range" : `${fmt(p.first_infeasible_value)} ${unit}`}
          </p>
          <p>
            <label htmlFor="plot-metric">Plot</label>{" "}
            <select id="plot-metric" value={metric} onChange={(e) => setMetric(e.target.value as keyof KeyMetrics)}>
              {KEY_METRICS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </p>
          <SweepChart
            points={p.points}
            metric={metric}
            xLabel={`${kind === "PARAMETER" ? path : kind} (${unit})`}
            yLabel={KEY_METRICS.find(([k]) => k === metric)?.[1] ?? metric}
          />
          <table aria-label="Sweep points">
            <caption>Sweep points</caption>
            <thead>
              <tr>
                <th>Value ({unit})</th>
                <th>Status</th>
                {KEY_METRICS.map(([k, label]) => (
                  <th key={k}>{label}</th>
                ))}
                <th>Limiting constraint</th>
              </tr>
            </thead>
            <tbody>
              {p.points.map((pt, k) => (
                <tr key={k}>
                  <td>{fmt(pt.value)}</td>
                  <td>{pt.status}</td>
                  {KEY_METRICS.map(([m]) => (
                    <td key={m}>{fmt(pt.key_metrics[m])}</td>
                  ))}
                  <td>
                    {pt.limiting_constraint ? (
                      <ConstraintTable label={`Limiting constraint at ${fmt(pt.value)}`} rows={[pt.limiting_constraint]} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!resp && <p>No sweep run yet.</p>}
    </>
  );
}

export default function SweepPage() {
  return (
    <RequireProject>
      <Sweep />
    </RequireProject>
  );
}
