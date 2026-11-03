"use client";
// S-08 Constraint check (M2) (Doc 7 §6.4): margins m_inv, m_line required without defaults
// (D-46 K11), optional storage settings; Run disabled unless the M1 result is current (§3.1). The
// single-line diagram carries the M1 labels and M2 marks (Doc 12 FR-96) and opens the Inspector.
import { useState } from "react";
import { runAnalysis } from "../../api-client";
import type { M2Payload, RunRecord } from "../../api-types";
import Link from "next/link";
import { EmptyState } from "../../components/EmptyState";
import { asResponse } from "../../components/Further";
import { Icon } from "../../components/Icon";
import { Inspector, type ElementRef } from "../../components/Inspector";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { ConstraintTable, M2Results } from "../../components/M2Results";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { ResultsDiagram } from "../../components/sld/ResultsDiagram";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import { m1Freshness, useValidation } from "../../components/useValidation";
import { latestRun, m1Ref, useProject, useProjectDispatch } from "../../store";
import styles from "./constraint-check.module.css";

const SOLVER = { mismatch_tolerance_w: 0.001, max_iterations: 50, initial_guess: "DEFAULT" as const };

type M2Params = Record<
  "inverter_margin_ratio" | "line_margin_ratio" | "autonomy_h" | "dc_efficiency_ratio" | "depth_of_discharge_ratio",
  number | null
>;

const FIELDS: [keyof M2Params, string, string, string][] = [
  ["inverter_margin_ratio", "Inverter design margin m_inv", "ratio", "any"],
  ["line_margin_ratio", "Line design margin m_line", "ratio", "any"],
  ["autonomy_h", "Storage autonomy t_aut, optional", "h", "1"],
  ["dc_efficiency_ratio", "DC efficiency η_dc, optional", "ratio", "any"],
  ["depth_of_discharge_ratio", "Depth of discharge DoD, optional", "ratio", "any"],
];

function lastM2Params(runRecords: RunRecord[]): M2Params {
  const last = runRecords.findLast((r) => r.analysis_type === "M2")?.parameters as Partial<M2Params> | undefined;
  return Object.fromEntries(FIELDS.map(([k]) => [k, last?.[k] ?? null])) as M2Params;
}

function ConstraintCheck() {
  const { design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  // K147: start from the user's own last M2 entry (RunRecord), never from a default.
  const [params, setParams] = useState<M2Params>(() => lastM2Params(runRecords));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<ElementRef | null>(null);
  const ref = m1Ref(runRecords);
  const report = useValidation(design);
  const fresh = m1Freshness(ref?.snapshot_hash ?? null, report);
  const resp = asResponse(latestRun(runRecords, "M2", report?.snapshot_hash ?? null));

  async function run() {
    if (!ref) return;
    setError(null);
    setBusy(true);
    const parameters = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null));
    const out = await runAnalysis("M2", { project_snapshot: design, parameters, solver_config: SOLVER, depends_on: ref });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    dispatch({ type: "runRecordAdded", record: out.data.run_record });
  }

  const r = resp?.result;
  const payload = r && (r.status === "FEASIBLE" || r.status === "INFEASIBLE") ? (r.payload as unknown as M2Payload) : null;
  const notices = r?.warnings?.filter((w) => w.code !== "ENGINE_KIND_FAKE") ?? [];
  return (
    <>
      <div className={styles.head}>
        <h1>Constraint check (M2)</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <M1BlockedNote f={fresh} />
      <form
        aria-label="Constraint check settings"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {FIELDS.map(([k, label, unit, step]) => (
          <NumberField key={k} id={k} label={label} unit={unit} step={step} value={params[k]} onChange={(v) => setParams({ ...params, [k]: v })} />
        ))}
        <button type="submit" disabled={busy || fresh !== "current"} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run M2"}
        </button>
      </form>
      {error && <Toast message={error} onDismiss={() => setError(null)} />}
      {r && <StatusBanner type="M2" result={r} />}
      {notices.map((w, k) => (
        <p key={k} data-testid="m2-warning" className="problems">
          <Icon name="warn" size={20} />
          {w.message}
        </p>
      ))}
      {r?.status === "INFEASIBLE" && <ConstraintTable label="Limiting constraints" rows={r.limiting_constraints ?? []} shortcut />}
      <ResultsDiagram fresh={fresh} checks selected={inspect?.id ?? null} onSelect={setInspect} />
      {inspect && <Inspector target={inspect} onClose={() => setInspect(null)} />}
      {payload && <M2Results p={payload} />}
      {!resp &&
        fresh === "current" &&
        (runRecords.some((x) => x.analysis_type === "M2") ? (
          // the design changed after the last M2 (FR-93); that run stays in Run history and the Report
          <EmptyState title="No result on this screen." action={<Link href="/runs/">Open run history</Link>}>
            The design changed after the last run. Run M2 again to see the results here.
          </EmptyState>
        ) : (
          <EmptyState title="Not run yet.">Enter both design margins, then run M2.</EmptyState>
        ))}
    </>
  );
}

export default function ConstraintCheckPage() {
  return (
    <RequireProject>
      <ConstraintCheck />
    </RequireProject>
  );
}
