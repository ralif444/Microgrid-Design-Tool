"use client";
// S-09 Sensitivity (M3a) (Doc 7 §6.5): parameters and output metrics, one step size without a
// default (Doc 3 §6.4); results ranked per metric by absolute normalised effect.
import { useState } from "react";
import type { M3aPayload, OutputMetric } from "../../api-types";
import { fmt, InfeasibleNote, METRICS, numericPaths, useDependentRun } from "../../components/Further";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";

function Sensitivity() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3a");
  const [paths, setPaths] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<OutputMetric[]>([]);
  const [stepKind, setStepKind] = useState<"step_relative" | "step_absolute">("step_relative");
  const [step, setStep] = useState<number | null>(null);
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3aPayload) : null;
  return (
    <>
      <h1>Sensitivity (M3a)</h1>
      <M1FreshnessBadge f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Sensitivity settings"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { parameter_paths: paths, output_metrics: metrics, ...(step === null ? {} : { [stepKind]: step }) } });
        }}
      >
        <fieldset>
          <legend>Parameters</legend>
          {numericPaths(design).map((pp) => (
            <label key={pp}>
              <input type="checkbox" checked={paths.includes(pp)} onChange={() => setPaths(toggle(paths, pp))} /> {pp}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Output metrics</legend>
          {METRICS.map(([m, label, unit]) => (
            <label key={m}>
              <input type="checkbox" checked={metrics.includes(m)} onChange={() => setMetrics(toggle(metrics, m))} /> {label} ({unit})
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Step size (Eq. 4.17)</legend>
          <label>
            <input type="radio" checked={stepKind === "step_relative"} onChange={() => setStepKind("step_relative")} /> relative to the parameter value
          </label>
          <label>
            <input type="radio" checked={stepKind === "step_absolute"} onChange={() => setStepKind("step_absolute")} /> absolute, in the parameter unit
          </label>
          <p>
            <NumberField id="step" label="Step" unit={stepKind === "step_relative" ? "ratio" : "parameter unit"} value={step} onChange={setStep} />
          </p>
        </fieldset>
        {paths.length === 0 && <p>Pick at least one parameter.</p>}
        <button type="submit" disabled={busy || fresh !== "current"}>
          {busy ? "Running..." : "Run M3a"}
        </button>
      </form>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M3a" result={r} />}
      {p &&
        METRICS.filter(([m]) => p.sensitivities.some((s) => s.metric === m)).map(([m, label]) => {
          const rank = new Map(p.ranking.filter((x) => x.metric === m).map((x) => [x.parameter_path, x.rank]));
          const rows = p.sensitivities
            .filter((s) => s.metric === m)
            .sort((a, b) => (rank.get(a.parameter_path) ?? Infinity) - (rank.get(b.parameter_path) ?? Infinity));
          return (
            <table key={m} aria-label={`Sensitivity of ${label}`}>
              <caption>Sensitivity of {label}</caption>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Parameter</th>
                  <th>dy/dp</th>
                  <th>Normalised</th>
                  <th>Scheme</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.parameter_path}>
                    <td>{rank.get(s.parameter_path) ?? "—"}</td>
                    <td>{s.parameter_path}</td>
                    <td>
                      {fmt(s.value)} {s.value === null ? "" : s.unit}
                    </td>
                    <td>{fmt(s.normalised_value)}</td>
                    <td>{s.scheme ?? "—"}</td>
                    <td>{[s.reason, s.status_change ? "status differs between the two sides" : null].filter(Boolean).join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      {!resp && <p>Not run yet.</p>}
    </>
  );
}

export default function SensitivityPage() {
  return (
    <RequireProject>
      <Sensitivity />
    </RequireProject>
  );
}
