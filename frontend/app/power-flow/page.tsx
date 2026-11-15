"use client";
// S-07 Power flow (M1) on the Project store design (D-46 K7). Readiness is shown before a run
// but never blocks it (Doc 7 P6): a run with problems returns INPUT_INVALID listing all issues.
import { issueWhere } from "../../components/elementFields";
import Link from "next/link";
import { useState } from "react";
import type { M2Payload, M1Payload } from "../../api-types";
import { ExampleGuide, ExampleNext, nextReady } from "../../components/ExampleForm";
import { EmptyState } from "../../components/EmptyState";
import { asResponse } from "../../components/Further";
import { CheckStrip } from "../../components/CheckStrip";
import { Icon } from "../../components/Icon";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { Inspector, type ElementRef } from "../../components/Inspector";
import { m1Kpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { M1Results } from "../../components/M1Results";
import { RequireProject } from "../../components/RequireProject";
import { ResultsDiagram } from "../../components/sld/ResultsDiagram";
import { ResultSheet } from "../../components/ResultSheet";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import { SOLVER, useAnalysisCall } from "../../components/useAnalysisCall";
import { m1Freshness, useValidationState } from "../../components/useValidation";
import { CheckFailed } from "../../components/M1Freshness";
import { latestRun, m1Ref, useProject, useProjectDispatch } from "../../store";
import styles from "./power-flow.module.css";

function PowerFlow() {
  const { design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const { busy, error, setError, call } = useAnalysisCall();
  const [inspect, setInspect] = useState<ElementRef | null>(null);
  const check = useValidationState(design);
  const report = check.report;
  const resp = asResponse(latestRun(runRecords, "M1", report?.snapshot_hash ?? null));
  const ref = m1Ref(runRecords);
  const fresh = m1Freshness(ref?.snapshot_hash ?? null, report);
  const m1Record = runRecords.find((r) => r.record_id === ref?.record_id) ?? null;

  async function run() {
    const data = await call("M1", { project_snapshot: design, parameters: {}, solver_config: SOLVER });
    if (data) dispatch({ type: "runRecordAdded", record: data.run_record });
  }

  const payload = resp?.result.status === "FEASIBLE" ? (resp.result.payload as unknown as M1Payload) : null;
  const r2 = latestRun(runRecords, "M2", report?.snapshot_hash ?? null)?.result;
  const m2 = r2 && (r2.status === "FEASIBLE" || r2.status === "INFEASIBLE") ? (r2.payload as unknown as M2Payload) : null;
  return (
    <>
      <div className={styles.head}>
        <h1>
          Power flow <span className="code-label">(M1)</span>
        </h1>
        <button type="button" className="primary" onClick={() => void run()} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run M1"}
        </button>
      </div>
      <CheckStrip fresh={fresh} m1={payload} m1Record={m1Record} />
      <ExampleGuide screen="power-flow" />
      <h2>Readiness</h2>
      {check.error ? (
        <CheckFailed error={check.error} onRetry={check.retry} />
      ) : report === null ? (
        <p className={styles.checking}>Checking the design…</p>
      ) : report.valid ? (
        <p className="all-clear">
          <Icon name="feasible" />
          No problems found.
        </p>
      ) : (
        <div className="problems">
          <Icon name="list" size={20} />
          <ul aria-label="Readiness warnings">
            {report.issues.map((i, k) => (
              <li key={k}>
                {issueWhere(i)}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report && !report.valid && <p className={styles.note}>You can still run M1; the result will list every problem.</p>}
      {error && <Toast message={error} onDismiss={() => setError(null)} />}
      {!resp &&
        !busy &&
        (fresh === "missing" ? (
          <EmptyState title="Not run yet.">Run M1 to see bus voltages, inverter outputs and line flows.</EmptyState>
        ) : (
          // the design changed after the last run (FR-93); that run stays in Run history and the Report
          <EmptyState title="No result on this screen." action={<Link href="/runs/">Open run history</Link>}>
            The design changed after the last run. Run M1 again to see the results here.
          </EmptyState>
        ))}
      {resp && (
        <ResultSheet record={resp.run_record}>
          <StatusBanner type="M1" result={resp.result} />
          {payload && <KpiStrip label="Power flow key figures" kpis={m1Kpis(payload)} record={resp.run_record} />}
          {payload && <M1Results p={payload} charts={{ limits: design.design_constraints, record: resp.run_record }} onInspect={setInspect} check={{ design, m2 }} />}
          {payload && <IndicatorPanel />}
        </ResultSheet>
      )}
      <ResultsDiagram fresh={fresh} selected={inspect?.id ?? null} onSelect={setInspect} />
      {inspect && <Inspector target={inspect} onClose={() => setInspect(null)} />}
      {payload && (
        <p className={styles.next}>
          <Link href="/constraint-check/">Continue to the constraint check (M2)</Link>
        </p>
      )}
      <ExampleNext screen="power-flow" ready={nextReady(resp?.result.status)} />
    </>
  );
}

export default function PowerFlowPage() {
  return (
    <RequireProject>
      <PowerFlow />
    </RequireProject>
  );
}
