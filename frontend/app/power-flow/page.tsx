"use client";
// S-07 Power flow (M1) on the Project store design (D-46 K7). Readiness is shown before a run
// but never blocks it (Doc 7 P6): a run with problems returns INPUT_INVALID listing all issues.
import Link from "next/link";
import { useState } from "react";
import { runAnalysis } from "../../api-client";
import type { AnalysisResponse, M1Payload } from "../../api-types";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { M1FreshnessBadge } from "../../components/M1Freshness";
import { M1Results } from "../../components/M1Results";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { m1Freshness, useValidation } from "../../components/useValidation";
import { m1Ref, useProject, useProjectDispatch } from "../../store";

const SOLVER = { mismatch_tolerance_w: 0.001, max_iterations: 50, initial_guess: "DEFAULT" as const };

function PowerFlow() {
  const { design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const report = useValidation(design);
  const fresh = m1Freshness(m1Ref(runRecords)?.snapshot_hash ?? null, report);

  async function run() {
    setError(null);
    setBusy(true);
    const out = await runAnalysis("M1", { project_snapshot: design, parameters: {}, solver_config: SOLVER });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setResp(out.data);
    dispatch({ type: "runRecordAdded", record: out.data.run_record });
  }

  const payload = resp?.result.status === "FEASIBLE" ? (resp.result.payload as unknown as M1Payload) : null;
  return (
    <>
      <h1>Power flow (M1)</h1>
      <M1FreshnessBadge f={fresh} />
      <h2>Readiness</h2>
      {report === null ? (
        <p>Checking the design…</p>
      ) : report.valid ? (
        <p>No problems found.</p>
      ) : (
        <ul aria-label="Readiness warnings">
          {report.issues.map((i, k) => (
            <li key={k}>
              {[i.entity, i.id, i.field].filter(Boolean).join(" / ") || "Design"}: {i.message}
            </li>
          ))}
        </ul>
      )}
      <p>
        <button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? "Running..." : "Run M1"}
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
      {resp && <StatusBanner type="M1" result={resp.result} />}
      {payload && <M1Results p={payload} />}
      {payload && <IndicatorPanel />}
      {resp && (
        <p>
          RunRecord <code data-testid="record-id">{resp.run_record.record_id}</code>, snapshot hash{" "}
          <code data-testid="snapshot-hash">{resp.run_record.snapshot_hash}</code>, engine{" "}
          {resp.run_record.engine_kind ?? "not called"}. Runs this session: {runRecords.length}.
        </p>
      )}
      {payload && (
        <p>
          <Link href="/constraint-check/">Continue to the constraint check (M2)</Link>
        </p>
      )}
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
