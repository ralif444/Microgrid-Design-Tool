"use client";
// S-07 Power flow (M1), thin slice for WP 1.1.6. The design is entered as JSON until the
// editing screens arrive in stage 1.2. Only nominal frequency is prefilled (Doc 3 §3.1 default).
import { useState } from "react";
import { runAnalysis } from "../../api-client";
import type { AnalysisResponse, M1Payload, ProjectSnapshot } from "../../api-types";
import { M1Results } from "../../components/M1Results";
import { StatusBanner } from "../../components/StatusBanner";
import { useProject, useProjectDispatch } from "../../store";

const TEMPLATE = JSON.stringify(
  {
    nominal_voltage_kv: null,
    nominal_frequency_hz: 50,
    buses: [],
    lines: [],
    loads: [],
    load_profile: null,
    inverters: [],
    design_constraints: {},
  },
  null,
  2,
);

const SOLVER = { mismatch_tolerance_w: 0.001, max_iterations: 50, initial_guess: "DEFAULT" as const };

export default function PowerFlowPage() {
  const [text, setText] = useState(TEMPLATE);
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useProjectDispatch();
  const { runRecords } = useProject();

  async function run() {
    setError(null);
    let snapshot: ProjectSnapshot;
    try {
      snapshot = JSON.parse(text) as ProjectSnapshot;
    } catch {
      setError("The design text is not valid JSON.");
      return;
    }
    setBusy(true);
    const out = await runAnalysis("M1", { project_snapshot: snapshot, parameters: {}, solver_config: SOLVER });
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
      <label htmlFor="design">Design (project snapshot, JSON)</label>
      <textarea id="design" rows={18} cols={80} value={text} onChange={(e) => setText(e.target.value)} />
      <p>
        <button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? "Running..." : "Run M1"}
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
      {resp && <StatusBanner type="M1" result={resp.result} />}
      {payload && <M1Results p={payload} />}
      {resp && (
        <p>
          RunRecord <code data-testid="record-id">{resp.run_record.record_id}</code>, snapshot hash{" "}
          <code data-testid="snapshot-hash">{resp.run_record.snapshot_hash}</code>, engine{" "}
          {resp.run_record.engine_kind ?? "not called"}. Runs this session: {runRecords.length}.
        </p>
      )}
    </>
  );
}
