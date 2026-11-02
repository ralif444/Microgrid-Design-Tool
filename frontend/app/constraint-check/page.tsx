"use client";
// S-08 Constraint check (M2) (Doc 7 §6.4): margins m_inv, m_line required without defaults
// (D-46 K11), optional storage settings; Run disabled unless the M1 result is current (§3.1).
import { useState } from "react";
import { runAnalysis } from "../../api-client";
import type { AnalysisResponse, M2Payload } from "../../api-types";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { ConstraintTable, M2Results } from "../../components/M2Results";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { m1Freshness, useValidation } from "../../components/useValidation";
import { m1Ref, useProject, useProjectDispatch } from "../../store";

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

function ConstraintCheck() {
  const { design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const [params, setParams] = useState<M2Params>({
    inverter_margin_ratio: null,
    line_margin_ratio: null,
    autonomy_h: null,
    dc_efficiency_ratio: null,
    depth_of_discharge_ratio: null,
  });
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = m1Ref(runRecords);
  const fresh = m1Freshness(ref?.snapshot_hash ?? null, useValidation(design));

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
    setResp(out.data);
    dispatch({ type: "runRecordAdded", record: out.data.run_record });
  }

  const r = resp?.result;
  const payload = r && (r.status === "FEASIBLE" || r.status === "INFEASIBLE") ? (r.payload as unknown as M2Payload) : null;
  const notices = r?.warnings?.filter((w) => w.code !== "ENGINE_KIND_FAKE") ?? [];
  return (
    <>
      <h1>Constraint check (M2)</h1>
      <M1FreshnessBadge f={fresh} />
      <form
        aria-label="Constraint check settings"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {FIELDS.map(([k, label, unit, step]) => (
          <p key={k}>
            <NumberField id={k} label={label} unit={unit} step={step} value={params[k]} onChange={(v) => setParams({ ...params, [k]: v })} />
          </p>
        ))}
        <button type="submit" disabled={busy || fresh !== "current"}>
          {busy ? "Running..." : "Run M2"}
        </button>
      </form>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M2" result={r} />}
      {notices.map((w, k) => (
        <p key={k} data-testid="m2-warning">
          {w.message}
        </p>
      ))}
      {r?.status === "INFEASIBLE" && <ConstraintTable label="Limiting constraints" rows={r.limiting_constraints ?? []} shortcut />}
      {payload && <M2Results p={payload} />}
      {!resp && <p>Not run yet.</p>}
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
