"use client";
// S-11 Scenarios and comparison (M3c) (Doc 7 §6.5): Scenarios = overrides on the current design
// (Doc 3 §3.10), applied by the client (Doc 3 §5.1); compare two or more, first selected is the
// reference (Doc 3 §6.6 default), explicit deltas, no ranking (4.2.5).
import { useState } from "react";
import type { M3cPayload } from "../../api-types";
import { applyOverrides, fmt, InfeasibleNote, METRICS, numericPaths, unitOf, useDependentRun } from "../../components/Further";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { useProject, useProjectDispatch, type Scenario } from "../../store";

const KEY: Record<string, keyof M3cPayload["scenario_results"][number]["key_metrics"]> = {
  SYSTEM_FREQUENCY: "system_frequency_hz",
  MIN_BUS_VOLTAGE: "min_voltage_pu",
  MAX_INVERTER_LOADING: "max_loading_ratio",
  TOTAL_LOSSES: "total_losses_kw",
};

function OverrideEditor({ sc, paths }: { sc: Scenario; paths: string[] }) {
  const dispatch = useProjectDispatch();
  const [path, setPath] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const set = (overrides: Scenario["overrides"]) => dispatch({ type: "scenarioUpdated", id: sc.id, patch: { overrides } });
  return (
    <>
      <ul aria-label={`Overrides of ${sc.name}`}>
        {sc.overrides.map((o) => (
          <li key={o.parameter_path}>
            {o.parameter_path} = {o.value} {unitOf(o.parameter_path)}{" "}
            <button type="button" onClick={() => set(sc.overrides.filter((x) => x !== o))}>
              Remove {o.parameter_path}
            </button>
          </li>
        ))}
      </ul>
      <label htmlFor={`path-${sc.id}`}>Change in {sc.name}</label>{" "}
      <select id={`path-${sc.id}`} value={path} onChange={(e) => setPath(e.target.value)}>
        <option value="">Choose…</option>
        {paths.map((pp) => (
          <option key={pp}>{pp}</option>
        ))}
      </select>{" "}
      <NumberField id={`value-${sc.id}`} label={`New value for ${sc.name}`} unit={path ? unitOf(path) : "—"} value={value} onChange={setValue} />{" "}
      <button
        type="button"
        disabled={!path || value === null}
        onClick={() => {
          if (!path || value === null) return;
          set([...sc.overrides.filter((x) => x.parameter_path !== path), { parameter_path: path, value }]);
          setPath("");
          setValue(null);
        }}
      >
        Add change to {sc.name}
      </button>
    </>
  );
}

function Scenarios() {
  const { scenarios } = useProject();
  const dispatch = useProjectDispatch();
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3c");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const paths = numericPaths(design);
  const chosen = scenarios.filter((s) => selected.includes(s.id));

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3cPayload) : null;
  const label = (id: string) => scenarios.find((s) => s.id === id)?.name ?? id;
  return (
    <>
      <h1>Scenarios and comparison (M3c)</h1>
      <M1FreshnessBadge f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="New scenario"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch({ type: "scenarioAdded", name: name.trim() });
          setName("");
        }}
      >
        <label htmlFor="scenario-name">Scenario name</label> <input id="scenario-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />{" "}
        <button type="submit" disabled={!name.trim()}>
          Save current design as Scenario
        </button>
      </form>
      {scenarios.length === 0 && <p>No scenarios yet. Save the current design as a Scenario.</p>}
      {scenarios.map((sc) => (
        <section key={sc.id} aria-label={`Scenario ${sc.name}`}>
          <h2>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(sc.id)}
                onChange={() => setSelected(selected.includes(sc.id) ? selected.filter((x) => x !== sc.id) : [...selected, sc.id])}
              />{" "}
              {sc.name} ({sc.overrides.length} change(s))
            </label>
          </h2>
          <OverrideEditor sc={sc} paths={paths} />{" "}
          <button type="button" onClick={() => dispatch({ type: "scenarioRemoved", id: sc.id })}>
            Delete {sc.name}
          </button>
        </section>
      ))}
      {chosen.length < 2 && <p>Select two or more Scenarios.</p>}
      <button
        type="button"
        disabled={busy || fresh !== "current" || chosen.length < 2}
        onClick={() =>
          void run({
            parameters: {},
            scenarios: chosen.map((s) => ({ scenario_id: s.id, label: s.name, project_snapshot: applyOverrides(design, s.overrides) })),
          })
        }
      >
        {busy ? "Running..." : "Compare"}
      </button>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M3c" result={r} />}
      {p && (
        <table aria-label="Scenario comparison">
          <caption>Scenario comparison (reference: {label(p.scenario_results[0]?.scenario_id ?? "")})</caption>
          <thead>
            <tr>
              <th>Metric</th>
              {p.scenario_results.map((s) => (
                <th key={s.scenario_id}>
                  {label(s.scenario_id)} ({s.status})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(([m, text, unit]) => (
              <tr key={m}>
                <th scope="row">
                  {text} ({unit})
                </th>
                {p.scenario_results.map((s, k) => {
                  const d = p.deltas.find((x) => x.metric === m && x.scenario_id === s.scenario_id);
                  const v = KEY[m] ? s.key_metrics[KEY[m]] : null;
                  return (
                    <td key={s.scenario_id}>
                      {KEY[m] ? fmt(v as number | null) : ""}
                      {k > 0 && d && ` (difference ${fmt(d.delta)} ${d.unit})`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!resp && <p>Not compared yet.</p>}
    </>
  );
}

export default function ScenariosPage() {
  return (
    <RequireProject>
      <Scenarios />
    </RequireProject>
  );
}
