"use client";
// "Run the whole example" on S-02 (Doc 12 X9 FR-104, PRD §8, D-98): PS → M1 → M2 → M3a → M3b → M3c →
// M3d → M4a → M4b in order, one normal synchronous request at a time (ADR-007), then the Report.
// Each step sends what its screen would start with: the last RunRecord's parameters of that type,
// else the guided example's values (D-92 K233). A step whose example leaves a required field empty
// is skipped; the run stops at the first result that is not FEASIBLE. Nothing is accepted.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { runAnalysis } from "../api-client";
import type { AnalysisRequestBody, AnalysisType, PsPayload, RunRecord, Status } from "../api-types";
import { adviceInputHash, m1Ref, useProject, useProjectDispatch, type ProjectState, type PsParameters } from "../store";
import type { ExampleSettings } from "../store/example";
import { applyOverrides, SOLVER } from "./Further";
import { Icon, type IconName } from "./Icon";

const STEPS: [AnalysisType, string, string][] = [
  ["PS", "Sizing advice (PS)", "sizing"],
  ["M1", "Power flow (M1)", "power-flow"],
  ["M2", "Constraint check (M2)", "constraint-check"],
  ["M3a", "Sensitivity (M3a)", "sensitivity"],
  ["M3b", "Sweep (M3b)", "sweep"],
  ["M3c", "Scenarios (M3c)", "scenarios"],
  ["M3d", "Envelope (M3d)", "envelope"],
  ["M4a", "Small-signal (M4a)", "small-signal"],
  ["M4b", "Transient (M4b)", "transient"],
];
const NO_PS: PsParameters = {
  inverter_margin_ratio: null, unit_count: null, redundancy: null, autonomy_h: null, dc_efficiency_ratio: null, depth_of_discharge_ratio: null,
};
const OPTIONAL = ["settling"]; // M4b classifies without it (Doc 3 §6.9)

type Outcome = { kind: "pending" | "running" | "skipped" | "error"; text?: string } | { kind: "done"; status: Status };

// What the step sends, or null when the example leaves a required field empty.
export function stepRequest(
  type: AnalysisType,
  screen: string,
  s: Pick<ProjectState, "design" | "runRecords" | "scenarios">,
  settings: ExampleSettings,
): Omit<AnalysisRequestBody, "depends_on"> | null {
  const base = { project_snapshot: s.design, solver_config: SOLVER };
  if (type === "M1") return { ...base, parameters: {} };
  if (type === "M3c")
    return {
      ...base,
      parameters: {},
      scenarios: s.scenarios.map((x) => ({ scenario_id: x.id, label: x.name, project_snapshot: applyOverrides(s.design, x.overrides) })),
    };
  const last = s.runRecords.findLast((r) => r.analysis_type === type && r.result.status !== "INPUT_INVALID");
  if (last) return { ...base, parameters: last.parameters as Record<string, unknown> };
  const ex = settings.screens[screen];
  if (!ex || ex.needs_value.some((k) => !OPTIONAL.includes(k))) return type === "M4a" ? { ...base, parameters: {} } : null;
  const parameters: Record<string, unknown> = Object.fromEntries(Object.entries(ex.fields).map(([k, f]) => [k, f.value]));
  if (type === "M4b") {
    if (!ex.presets[0]) return null;
    Object.assign(parameters, ex.presets[0].fields);
  }
  return { ...base, parameters };
}

const ICON: Partial<Record<Status, IconName>> = { FEASIBLE: "feasible", INFEASIBLE: "misuse", SOLVER_FAILED: "alert", PHYSICALLY_INADMISSIBLE: "hex", INPUT_INVALID: "list", UNAVAILABLE: "info" };

export function RunWholeExample() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const router = useRouter();
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const [stopped, setStopped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!state.example) return null;
  const settings = state.example.settings;

  async function runAll() {
    setBusy(true);
    setStopped(null);
    const out: Outcome[] = STEPS.map(() => ({ kind: "pending" }));
    const show = () => setOutcomes([...out]);
    let records: RunRecord[] = state.runRecords; // the store updates after this handler, so track runs here
    for (const [i, [type, label, screen]] of STEPS.entries()) {
      const req = stepRequest(type, screen, { ...state, runRecords: records }, settings);
      if (!req) {
        out[i] = { kind: "skipped", text: "skipped: not set in the example" };
        show();
        continue;
      }
      out[i] = { kind: "running" };
      show();
      const ref = type === "PS" || type === "M1" ? undefined : (m1Ref(records) ?? undefined);
      const res = await runAnalysis(type, { ...req, depends_on: ref });
      if (!res.ok) {
        out[i] = { kind: "error", text: res.message };
        show();
        setStopped(label);
        setBusy(false);
        return;
      }
      const rec = res.data.run_record;
      records = [...records, rec];
      dispatch({ type: "runRecordAdded", record: rec });
      if (type === "PS" && res.data.result.status === "FEASIBLE") {
        // the S-04 form shape, so its stale-advice check matches (Doc 3 §3.8 input_hash)
        const ps: PsParameters = { ...NO_PS, ...(req.parameters as Partial<PsParameters>) };
        dispatch({
          type: "adviceAdded",
          advice: {
            id: rec.record_id,
            created_at: rec.created_at,
            input_hash: await adviceInputHash(state.design, ps),
            ps_parameters: ps,
            state: "PROPOSED", // never accepted on the user's behalf (PRD §3 rule 6)
            result: res.data.result.payload as unknown as PsPayload,
          },
        });
      }
      out[i] = { kind: "done", status: res.data.result.status };
      show();
      if (res.data.result.status !== "FEASIBLE") {
        setStopped(label);
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    router.push("/report/");
  }

  return (
    <section aria-label="Run the whole example">
      <h2>Run the whole example</h2>
      <p>Runs every analysis of the pipeline in order with the example values, then opens the Report. Nothing is accepted or edited.</p>
      <button type="button" className="primary" onClick={() => void runAll()} disabled={busy} aria-busy={busy || undefined}>
        {busy ? "Running..." : "Run the whole example"}
      </button>
      {outcomes && (
        <ol aria-label="Example run progress" data-testid="example-run">
          {STEPS.map(([type, label], i) => {
            const o = outcomes[i];
            return (
              <li key={type} data-step={type} data-state={o.kind === "done" ? o.status : o.kind}>
                {label}:{" "}
                {o.kind === "done" ? (
                  <>
                    <Icon name={ICON[o.status] ?? "info"} size={16} /> {o.status}
                  </>
                ) : o.kind === "running" ? (
                  "running…"
                ) : o.kind === "pending" ? (
                  "not run"
                ) : (
                  o.text
                )}
              </li>
            );
          })}
        </ol>
      )}
      {stopped && (
        <p role="alert" data-testid="example-run-stopped">
          Stopped at {stopped}. Open that screen to see the result.
        </p>
      )}
    </section>
  );
}
