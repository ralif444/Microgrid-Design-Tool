"use client";
// S-11 Scenarios and comparison (M3c) (Doc 7 §6.5): Scenarios = overrides on the current design
// (Doc 3 §3.10), applied by the client (Doc 3 §5.1); compare two or more, first selected is the
// reference (Doc 3 §6.6 default), explicit deltas, no ranking (4.2.5). Static N−1 check (Doc 12 FR-80).
// UX-8 (Doc 12 X3): one bar chart per key metric across the scenarios (run order, no sorting, so no
// ranking is implied); the comparison table with the payload deltas follows the charts.
import { useState } from "react";
import type { M3cPayload } from "../../api-types";
import { BarChart } from "../../components/charts/BarChart";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { applyOverrides, fmt, nMinus1, InfeasibleNote, METRICS, numericPaths, unitOf, useDependentRun } from "../../components/Further";
import styles from "../../components/Further.module.css";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import { useProject, useProjectDispatch, type Scenario } from "../../store";

const KEY: Record<string, keyof M3cPayload["scenario_results"][number]["key_metrics"]> = {
  SYSTEM_FREQUENCY: "system_frequency_hz",
  MIN_BUS_VOLTAGE: "min_voltage_pu",
  MAX_INVERTER_LOADING: "max_loading_ratio",
  TOTAL_LOSSES: "total_losses_kw",
  MAX_Q_SHARING_ERROR: "max_q_sharing_error_pu",
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
      <p>
        <label htmlFor={`path-${sc.id}`}>Change in {sc.name}</label>{" "}
        <select id={`path-${sc.id}`} value={path} onChange={(e) => setPath(e.target.value)}>
          <option value="">Choose…</option>
          {paths.map((pp) => (
            <option key={pp}>{pp}</option>
          ))}
        </select>
      </p>
      <p>
        <NumberField id={`value-${sc.id}`} label={`New value for ${sc.name}`} unit={path ? unitOf(path) : "—"} value={value} onChange={setValue} />
      </p>
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

type Row = (typeof METRICS)[number];

function Scenarios() {
  const { scenarios } = useProject();
  const dispatch = useProjectDispatch();
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3c");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [runLabels, setRunLabels] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<string | null>(null);
  const inverterCount = design.inverters?.length ?? 0;
  const paths = numericPaths(design);
  const chosen = scenarios.filter((s) => selected.includes(s.id));

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3cPayload) : null;
  const label = (id: string) => runLabels[id] ?? scenarios.find((s) => s.id === id)?.name ?? id;
  function compare(list: { scenario_id: string; label: string; project_snapshot: typeof design }[]) {
    setRunLabels(Object.fromEntries(list.map((x) => [x.scenario_id, x.label])));
    void run({ parameters: {}, scenarios: list });
  }
  const results = p?.scenario_results ?? [];
  const charted = METRICS.filter(([m]) => KEY[m] && results.some((s) => typeof s.key_metrics[KEY[m]] === "number"));
  const columns: DataColumn<Row>[] = [
    { key: "metric", header: "Metric", cell: ([, text, unit]) => <strong>{`${text} (${unit})`}</strong> },
    ...results.map((s, k) => ({
      key: s.scenario_id,
      header: `${label(s.scenario_id)} (${s.status})`,
      cell: ([m]: Row) => {
        const d = p?.deltas.find((x) => x.metric === m && x.scenario_id === s.scenario_id);
        const v = KEY[m] ? s.key_metrics[KEY[m]] : null;
        const rel = d?.relative_delta_ratio;
        return `${KEY[m] ? fmt(v as number | null) : ""}${k > 0 && d ? ` (difference ${fmt(d.delta)} ${d.unit}${rel === null || rel === undefined ? "" : `, relative ${fmt(rel)} ratio`})` : ""}`;
      },
    })),
  ];
  return (
    <>
      <div className={styles.head}>
        <h1>Scenarios and comparison (M3c)</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="New scenario"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch({ type: "scenarioAdded", name: name.trim() });
          setName("");
        }}
      >
        <p>
          <label htmlFor="scenario-name">Scenario name</label> <input id="scenario-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </p>
        <button type="submit" disabled={!name.trim()}>
          Save current design as Scenario
        </button>
      </form>
      {scenarios.length === 0 && <p>No scenarios yet. Save the current design as a Scenario.</p>}
      {scenarios.map((sc) => (
        <section key={sc.id} aria-label={`Scenario ${sc.name}`} className={`${styles.form} ${styles.scenario}`}>
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
          <OverrideEditor sc={sc} paths={paths} />
          <button type="button" onClick={() => dispatch({ type: "scenarioRemoved", id: sc.id })}>
            Delete {sc.name}
          </button>
        </section>
      ))}
      {chosen.length < 2 && <p>Select two or more Scenarios.</p>}
      <p className={styles.actions}>
        <button
          type="button"
          className="primary"
          disabled={busy || fresh !== "current" || chosen.length < 2}
          aria-busy={busy || undefined}
          onClick={() => compare(chosen.map((s) => ({ scenario_id: s.id, label: s.name, project_snapshot: applyOverrides(design, s.overrides) })))}
        >
          {busy ? "Running..." : "Compare"}
        </button>
        <button type="button" disabled={busy || fresh !== "current" || inverterCount < 2} onClick={() => compare(nMinus1(design))}>
          Run N−1 check (base plus one scenario per removed inverter)
        </button>
      </p>
      {inverterCount < 2 && <p>N−1 needs at least two inverters.</p>}
      {error && error !== dismissed && <Toast message={error} onDismiss={() => setDismissed(error)} />}
      {r && <StatusBanner type="M3c" result={r} />}
      {p && resp && (
        <>
          {charted.map(([m, text, unit]) => (
            <BarChart
              key={m}
              title={`${text} per scenario`}
              valueTitle={`${text} (${unit})`}
              categoryTitle="Scenario"
              categories={results.map((s) => `${label(s.scenario_id)} (${s.status})`)}
              series={[{ name: text, values: results.map((s) => (s.key_metrics[KEY[m]] as number | null | undefined) ?? null) }]}
              labelWidth={200}
              dots={m === "SYSTEM_FREQUENCY" || m === "MIN_BUS_VOLTAGE"} // far from zero: dots on a fitted axis, as the S-07 voltage profile
              note={`In run order, reference first (${label(results[0]?.scenario_id ?? "")}); not a ranking (4.2.5). The table below gives the explicit differences.`}
              record={resp.run_record}
            />
          ))}
          <DataTable
            label="Scenario comparison"
            caption={`Scenario comparison (reference: ${label(results[0]?.scenario_id ?? "")})`}
            columns={columns}
            rows={METRICS}
            rowKey={([m]) => m}
            rowName={([, text]) => text}
          />
          <p className={styles.record}>
            RunRecord <code>{resp.run_record.record_id}</code>, engine {resp.run_record.engine_kind ?? "not called"}.
          </p>
        </>
      )}
      {!resp && <EmptyState title="Not compared yet.">Select two or more Scenarios and compare them, or run the N−1 check.</EmptyState>}
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
