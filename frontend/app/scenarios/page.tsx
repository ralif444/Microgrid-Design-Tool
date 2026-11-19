"use client";
// S-11 Scenarios and comparison (M3c) (Doc 7 §6.5): Scenarios = overrides on the current design
// (Doc 3 §3.10), applied by the client (Doc 3 §5.1); compare two or more, first selected is the
// reference (Doc 3 §6.6 default), explicit deltas, no ranking (4.2.5). Static N−1 check (Doc 12 FR-80).
// UX-8 (Doc 12 X3): one bar chart per key metric across the scenarios (run order, no sorting, so no
// ranking is implied); the comparison table with the payload deltas follows the charts.
import { useKept } from "../../components/useKept";
import { useState } from "react";
import type { M3cPayload } from "../../api-types";
import { ExampleGuide, ExampleNext, nextReady } from "../../components/ExampleForm";
import { BarChart } from "../../components/charts/BarChart";
import { CANNOT_UNDO, useConfirmDelete } from "../../components/ConfirmDelete";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { fixed, fixedOr } from "../../components/format";
import { applyOverrides, nMinus1, InfeasibleNote, OutOfDate, METRICS, numericPaths, ParamOptions, paramLabel, paramName, paramUnit, useDependentRun } from "../../components/Further";
import styles from "../../components/Further.module.css";
import { useLanguage } from "../../components/Language";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { ResultSheet } from "../../components/ResultSheet";
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
  const { t } = useLanguage();
  const dispatch = useProjectDispatch();
  const [path, setPath] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const set = (overrides: Scenario["overrides"]) => dispatch({ type: "scenarioUpdated", id: sc.id, patch: { overrides } });
  return (
    <>
      <ul aria-label={t("Overrides of {name}", { name: sc.name })}>
        {sc.overrides.map((o) => (
          <li key={o.parameter_path}>
            {paramName(o.parameter_path)} = {o.value} {paramUnit(o.parameter_path)}{" "}
            <button type="button" onClick={() => set(sc.overrides.filter((x) => x !== o))}>
              {t("Remove {label}", { label: paramLabel(o.parameter_path) })}
            </button>
          </li>
        ))}
      </ul>
      <p>
        <label htmlFor={`path-${sc.id}`}>
          {t("Parameter to change")}<span className="sr-only">{t(" in {name}", { name: sc.name })}</span>
        </label>{" "}
        <select id={`path-${sc.id}`} value={path} onChange={(e) => setPath(e.target.value)}>
          <option value="">{t("Choose…")}</option>
          <ParamOptions paths={paths} />
        </select>
      </p>
      <p>
        <NumberField id={`value-${sc.id}`} label={<>{t("New value")}<span className="sr-only">{t(" for {name}", { name: sc.name })}</span></>} unit={path ? paramUnit(path) : "—"} value={value} onChange={setValue} />
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
        {t("Add change to {name}", { name: sc.name })}
      </button>
    </>
  );
}

type Row = (typeof METRICS)[number];

function Scenarios() {
  const { t } = useLanguage();
  const { dialog, confirm } = useConfirmDelete();
  const { example } = useProject();
  const { scenarios } = useProject();
  const dispatch = useProjectDispatch();
  const { design, fresh, busy, resp, stale, error, clearError, run, m2Infeasible } = useDependentRun("M3c");
  const [selected, setSelected] = useKept<string[]>("selected", []);
  const [name, setName] = useKept("name", "");
  const [runLabels, setRunLabels] = useState<Record<string, string>>({});
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
    { key: "metric", header: t("Metric"), cell: ([, text, unit]) => <strong>{`${t(text)} (${unit})`}</strong> },
    ...results.map((s, k) => ({
      key: s.scenario_id,
      header: `${label(s.scenario_id)} (${s.status})`,
      cell: ([m, , unit]: Row) => {
        const d = p?.deltas.find((x) => x.metric === m && x.scenario_id === s.scenario_id);
        const v = KEY[m] ? s.key_metrics[KEY[m]] : null;
        const rel = d?.relative_delta_ratio;
        return `${KEY[m] ? fixedOr(v as number | null, unit) : ""}${k > 0 && d ? t(" (difference {delta} {unit}{rel})", { delta: fixed(d.delta, d.unit), unit: d.unit, rel: rel === null || rel === undefined ? "" : t(", relative {value} ratio", { value: fixed(rel, "ratio") }) }) : ""}`;
      },
    })),
  ];
  return (
    <>
      <div className={styles.head}>
        <h1>
          {t("Scenarios and comparison")} <span className="code-label">(M3c)</span>
        </h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <ExampleGuide screen="scenarios" />
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      {example && (
        <p data-testid="example-scenarios">
          {t("Example mode: the scenarios come from the guided example's Project file (the stressed design D2S and the near-limit design D2H of the validation plan). The first, the base scenario, is the reference of the comparison.")}
        </p>
      )}
      <div className={styles.study}>
      <div>
      <form
        aria-label={t("New scenario")}
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          dispatch({ type: "scenarioAdded", name: name.trim() });
          setName("");
        }}
      >
        <p>
          <label htmlFor="scenario-name">{t("Scenario name")}</label> <input id="scenario-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </p>
        <button type="submit" disabled={!name.trim()}>
          {t("Save current design as Scenario")}
        </button>
      </form>
      {scenarios.length === 0 && <p>{t("No scenarios yet. Save the current design as a Scenario.")}</p>}
      {scenarios.map((sc) => (
        <section key={sc.id} aria-label={t("Scenario {name}", { name: sc.name })} className={`${styles.form} ${styles.scenario}`}>
          <h2>
            <label>
              <input
                type="checkbox"
                checked={selected.includes(sc.id)}
                onChange={() => setSelected(selected.includes(sc.id) ? selected.filter((x) => x !== sc.id) : [...selected, sc.id])}
              />{" "}
              {t(sc.overrides.length === 1 ? "{name} ({count} change)" : "{name} ({count} changes)", { name: sc.name, count: sc.overrides.length })}
            </label>
          </h2>
          <OverrideEditor sc={sc} paths={paths} />
          <button type="button" onClick={() => confirm(t("Delete {name}?", { name: sc.name }), `${t("Scenario {name} and its changes are removed.", { name: sc.name })} ${t(CANNOT_UNDO)}`, () => dispatch({ type: "scenarioRemoved", id: sc.id }))}>
            {t("Delete {name}", { name: sc.name })}
          </button>
        </section>
      ))}
      <p className={styles.run}>
        <button
          type="button"
          className="primary"
          disabled={busy || fresh !== "current" || chosen.length < 2}
          aria-busy={busy || undefined}
          aria-describedby={chosen.length < 2 ? "compare-missing" : undefined}
          onClick={() => compare(chosen.map((s) => ({ scenario_id: s.id, label: s.name, project_snapshot: applyOverrides(design, s.overrides) })))}
        >
          {busy ? t("Running...") : t("Compare scenarios")}
        </button>
        {chosen.length < 2 && <span id="compare-missing">{t("Missing: two or more selected Scenarios.")}</span>}
      </p>
      <p className={styles.run}>
        <button type="button" disabled={busy || fresh !== "current" || inverterCount < 2} onClick={() => compare(nMinus1(design))}>
          {t("Run N−1 check (base plus one scenario per removed inverter)")}
        </button>
        {inverterCount < 2 && <span>{t("N−1 needs at least two inverters.")}</span>}
      </p>
      </div>
      <div className={styles.result}>
      {error && <Toast message={error} onDismiss={clearError} />}
      <OutOfDate show={stale} />
      {resp && r && (
        <ResultSheet record={resp.run_record}>
          <StatusBanner type="M3c" result={r} />
      {p && resp && (
        <>
          {charted.map(([m, text, unit]) => (
            <BarChart
              key={m}
              title={t("{text} per scenario", { text: t(text) })}
              valueTitle={`${t(text)} (${unit})`}
              categoryTitle={t("Scenario")}
              categories={results.map((s) => `${label(s.scenario_id)} (${s.status})`)}
              series={[{ name: t(text), values: results.map((s) => (s.key_metrics[KEY[m]] as number | null | undefined) ?? null) }]}
              labelWidth={200}
              dots={m === "SYSTEM_FREQUENCY" || m === "MIN_BUS_VOLTAGE"} // far from zero: dots on a fitted axis, as the S-07 voltage profile
              note={t("In run order, reference first ({ref}); not a ranking (4.2.5). The table below gives the explicit differences.", { ref: label(results[0]?.scenario_id ?? "") })}
              record={resp.run_record}
            />
          ))}
          <DataTable
            label={t("Scenario comparison")}
            caption={t("Scenario comparison (reference: {ref})", { ref: label(results[0]?.scenario_id ?? "") })}
            columns={columns}
            rows={METRICS}
            rowKey={([m]) => m}
            rowName={([, text]) => t(text)}
          />
        </>
      )}
        </ResultSheet>
      )}
      {!resp && <EmptyState title={t("Not compared yet.")}>{t("Select two or more Scenarios and compare them, or run the N−1 check.")}</EmptyState>}
      </div>
      </div>
      <ExampleNext screen="scenarios" ready={nextReady(r?.status)} />
      {dialog}
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
