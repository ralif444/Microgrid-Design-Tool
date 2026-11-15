"use client";
// S-09 Sensitivity (M3a) (Doc 7 §6.5): parameters and output metrics, one step size without a
// default (Doc 3 §6.4); results ranked per metric by absolute normalised effect. Pre-filled from an
// M2 limiting constraint via ?kind=&element= (Doc 12 FR-84); nothing runs until Run is pressed.
// UX-8 (Doc 12 X3): one tornado chart per metric (normalised values in payload rank order; a null
// is listed as not reported with its reason, never drawn); a status change is flagged with icon + word.
import { useKept } from "../../components/useKept";
import { useEffect } from "react";
import type { M3aPayload, OutputMetric } from "../../api-types";
import { BarChart } from "../../components/charts/BarChart";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ExampleGuide, ExampleNext, nextReady, NotSet, useExampleForm } from "../../components/ExampleForm";
import { fixedOr } from "../../components/format";
import { InfeasibleNote, METRICS, numericPaths, OutOfDate, paramLabel, RunButton, shortcutPrefill, useDependentRun } from "../../components/Further";
import styles from "../../components/Further.module.css";
import { Icon } from "../../components/Icon";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { ResultSheet } from "../../components/ResultSheet";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";

type Sens = M3aPayload["sensitivities"][number];
const FLAG = "status differs between the two sides";

function Sensitivity() {
  const { design, fresh, busy, resp, stale, error, clearError, run, m2Infeasible } = useDependentRun("M3a");
  // Example mode (Doc 12 X9, D-92 K230): paths and metrics from the guided example; a path that does not
  // resolve on this Project is dropped (Doc 7 §2.3). The step stays the user's (D-92 K231).
  const ex = useExampleForm<{ parameter_paths: string[] | null; output_metrics: OutputMetric[] | null }>(
    "sensitivity",
    { parameter_paths: null, output_metrics: null },
    {
      resolve: (k, v) => {
        if (k !== "parameter_paths") return v;
        const ok = (v as string[]).filter((pp) => numericPaths(design).includes(pp));
        return ok.length ? ok : null;
      },
    },
  );
  const paths = ex.values.parameter_paths ?? [];
  const metrics = ex.values.output_metrics ?? [];
  const setPaths = (v: string[]) => ex.set("parameter_paths", v);
  const setMetrics = (v: OutputMetric[]) => ex.set("output_metrics", v);
  const [stepKind, setStepKind] = useKept<"step_relative" | "step_absolute">("stepKind", "step_relative");
  const [step, setStep] = useKept<number | null>("step", null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pre = shortcutPrefill(design, q.get("kind") ?? "", q.get("element") ?? "");
    if (!pre) return;
    setPaths(pre.paths);
    setMetrics([pre.metric]);
    // runs once on arrival; later edits are the user's
  }, []);
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3aPayload) : null;
  return (
    <>
      <div className={styles.head}>
        <h1>
          Sensitivity <span className="code-label">(M3a)</span>
        </h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <ExampleGuide screen="sensitivity" />
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <div className={styles.study}>
      <form
        aria-label="Sensitivity settings"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { parameter_paths: paths, output_metrics: metrics, ...(step === null ? {} : { [stepKind]: step }) } });
        }}
      >
        <fieldset className={`${styles.box} ${styles.params}`}>
          <legend>Parameters ({paths.length} selected)</legend>
          {ex.tag("parameter_paths", "Parameters")}
          {/* grouped per element, bounded height (audit 2026-11-15 D14) */}
          {[...Map.groupBy(numericPaths(design), (pp) => pp.split("/")[1])].map(([id, pps]) => (
            <details key={id} open>
              <summary>
                {id} ({pps.filter((pp) => paths.includes(pp)).length} of {pps.length} selected)
              </summary>
              {pps.map((pp) => (
                <label key={pp}>
                  <input type="checkbox" checked={paths.includes(pp)} onChange={() => setPaths(toggle(paths, pp))} /> {paramLabel(pp)}
                </label>
              ))}
            </details>
          ))}
        </fieldset>
        <fieldset className={styles.box}>
          <legend>Output metrics</legend>
          {ex.tag("output_metrics", "Output metrics")}
          {METRICS.map(([m, label, unit]) => (
            <label key={m}>
              <input type="checkbox" checked={metrics.includes(m)} onChange={() => setMetrics(toggle(metrics, m))} /> {label} ({unit})
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.box}>
          <legend>
            Step size <span className="code-label">(Eq. 4.17)</span>
          </legend>
          <label>
            <input type="radio" name="step-kind" checked={stepKind === "step_relative"} onChange={() => setStepKind("step_relative")} /> relative to the parameter value
          </label>
          <label>
            <input type="radio" name="step-kind" checked={stepKind === "step_absolute"} onChange={() => setStepKind("step_absolute")} /> absolute, in the parameter unit
          </label>
          <NumberField
            id="step"
            label="Step"
            unit={stepKind === "step_relative" ? "ratio" : "parameter unit"}
            value={step}
            onChange={setStep}
            note={ex.needs("step_relative") && step === null ? <NotSet /> : undefined}
          />
        </fieldset>
        {ex.resetButton}
        <RunButton label="Run sensitivity" busy={busy} fresh={fresh} missing={[!paths.length && "a parameter", !metrics.length && "an output metric", step === null && "the step"].filter((x): x is string => !!x)} />
      </form>
      <div className={styles.result}>
      {error && <Toast message={error} onDismiss={clearError} />}
      <OutOfDate show={stale} />
      {resp && r && (
        <ResultSheet record={resp.run_record}>
          <StatusBanner type="M3a" result={r} />
      {p &&
        resp &&
        METRICS.filter(([m]) => p.sensitivities.some((s) => s.metric === m)).map(([m, label, unit]) => {
          const rank = new Map(p.ranking.filter((x) => x.metric === m).map((x) => [x.parameter_path, x.rank]));
          const rows = p.sensitivities
            .filter((s) => s.metric === m)
            .sort((a, b) => (rank.get(a.parameter_path) ?? Infinity) - (rank.get(b.parameter_path) ?? Infinity));
          const drawn = rows.filter((s) => s.normalised_value !== null && s.normalised_value !== undefined);
          const missing = rows.filter((s) => !drawn.includes(s));
          const flagged = rows.filter((s) => s.status_change);
          const columns: DataColumn<Sens>[] = [
            { key: "rank", header: "Rank", numeric: true, cell: (s) => rank.get(s.parameter_path) ?? "—" },
            { key: "path", header: "Parameter", cell: (s) => paramLabel(s.parameter_path) },
            { key: "v", header: "dy/dp", cell: (s) => `${fixedOr(s.value, s.unit ?? "")}${s.value === null || !s.unit ? "" : ` ${s.unit}`}` },
            { key: "n", header: "Normalised", unit: "ratio", numeric: true, cell: (s) => fixedOr(s.normalised_value, "ratio") },
            { key: "s", header: "Scheme", cell: (s) => s.scheme ?? "—" },
            {
              key: "note",
              header: "Note",
              cell: (s) => (
                <>
                  {s.status_change && (
                    <>
                      <Icon name="warn" /> {FLAG}
                      {s.reason ? "; " : ""}
                    </>
                  )}
                  {s.reason ?? (s.status_change ? "" : "—")}
                </>
              ),
            },
          ];
          return (
            <section key={m} aria-label={`Results for ${label}`}>
              <BarChart
                title={`Tornado: ${label}`}
                valueTitle="Normalised sensitivity (ratio)"
                categoryTitle="Parameter"
                categories={drawn.map((s) => `${paramLabel(s.parameter_path)}${s.status_change ? " (status differs)" : ""}`)}
                series={[{ name: label, values: drawn.map((s) => s.normalised_value ?? null) }]}
                labelWidth={230}
                note={[
                  `Bars in the payload's rank order (largest absolute normalised effect first); metric unit ${unit}.`,
                  missing.length ? `Not reported: ${missing.map((s) => `${paramLabel(s.parameter_path)} (${s.reason ?? "no reason given"})`).join("; ")}.` : null,
                  flagged.length ? `Status differs between the two sides for: ${flagged.map((s) => paramLabel(s.parameter_path)).join(", ")}.` : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                record={resp.run_record}
              />
              <DataTable label={`Sensitivity of ${label}`} caption={`Sensitivity of ${label}`} columns={columns} rows={rows} rowKey={(s) => s.parameter_path} rowName={(s) => paramLabel(s.parameter_path)} />
            </section>
          );
        })}
        </ResultSheet>
      )}
      {!resp && <EmptyState title="Not run yet.">Pick parameters, output metrics and a step, then run M3a to rank the parameters by effect.</EmptyState>}
      </div>
      </div>
      <ExampleNext screen="sensitivity" ready={nextReady(r?.status)} />
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
