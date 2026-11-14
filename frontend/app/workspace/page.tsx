"use client";
// Diagram workspace (ADR-016 option B; plan-workspace.md W4): the Model and Check areas, picked by
// `?area=` from the header tabs (AreaNav). Element list, diagram, inspector beside it (FR-90, FR-91) and,
// in Check, the results drawer. Runs follow the S-07 / S-08 rules: M2 needs the current M1 (FR-38,
// FR-40, FR-93). Studies and Report are their own routes under the same tabs.
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { M1Payload, M2Payload } from "../../api-types";
import { CheckStrip } from "../../components/CheckStrip";
import { ElementForm, LimitsForm } from "../../components/ElementForm";
import { lastM2Params, M2_FIELDS, type M2Params } from "../../components/elementFields";
import { EmptyState } from "../../components/EmptyState";
import { ExampleNext, nextReady, useExampleForm } from "../../components/ExampleForm";
import { asResponse } from "../../components/Further";
import { Icon } from "../../components/Icon";
import { Inspector, type ElementRef } from "../../components/Inspector";
import inspectorStyles from "../../components/Inspector.module.css";
import { M1BlockedNote } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { M1Results } from "../../components/M1Results";
import { ConstraintTable, M2Results } from "../../components/M2Results";
import { RunWholeExample } from "../../components/RunWholeExample";
import { RequireProject } from "../../components/RequireProject";
import { ResultsDiagram } from "../../components/sld/ResultsDiagram";
import { SingleLineDiagram } from "../../components/sld/SingleLineDiagram";
import { useSldModel } from "../../components/sld/useSldModel";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import { SOLVER, useAnalysisCall } from "../../components/useAnalysisCall";
import { m1Freshness, useValidation } from "../../components/useValidation";
import { ID_PREFIX, latestRun, m1Ref, nextId, useProject, useProjectDispatch } from "../../store";
import styles from "./workspace.module.css";

type Selection = ElementRef | { kind: "limits" } | null;
const MARK_WORD = { violated: "Violated", limiting: "Limiting", near: "Near limit" } as const;

function ElementList({ selected, onSelect, editable }: { selected: Selection; onSelect: (s: Selection) => void; editable: boolean }) {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const { full } = useSldModel();
  const [busId, setBusId] = useState("");
  const firstBus = design.buses?.[0]?.id ?? null;
  // a new element opens in the inspector at once; the id is the one the reducer will give it
  const add = (collection: "inverters" | "lines" | "loads", kind: "inverter" | "line" | "load", row: Record<string, unknown>) => {
    const id = nextId(ID_PREFIX[collection], design[collection] ?? []);
    dispatch({ type: "rowAdded", collection, row });
    onSelect({ kind, id });
  };
  const groups = [
    { title: "Inverters", kind: "inverter", list: full.inverters, add: () => add("inverters", "inverter", { bus_id: firstBus }) },
    { title: "Buses", kind: "bus", list: full.buses, add: null },
    { title: "Lines", kind: "line", list: full.lines, add: () => add("lines", "line", { from_bus_id: null, to_bus_id: null }) },
    { title: "Loads", kind: "load", list: full.loads, add: () => add("loads", "load", { bus_id: firstBus, p_kw: null, q_kvar: null }) },
  ] as const;
  const isSel = (kind: string, id?: string) => selected?.kind === kind && (!id || ("id" in selected && selected.id === id));
  return (
    <nav aria-label="Elements" className={styles.list}>
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2>
            <span>{g.title}</span>
            <span>{g.list.length}</span>
          </h2>
          <ul>
            {g.list.map((e) => {
              const flag =
                e.mark && e.mark !== "pass" ? MARK_WORD[e.mark] : e.issues.length ? `${e.issues.length} ${e.issues.length === 1 ? "issue" : "issues"}` : null;
              return (
                <li key={e.id}>
                  <button type="button" aria-pressed={isSel(g.kind, e.id)} onClick={() => onSelect({ kind: g.kind, id: e.id })}>
                    {e.id}
                    {flag && (
                      <span className={styles.flag} data-mark={e.mark ?? "issue"}>
                        <Icon name="warn" size={12} />
                        {flag}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {editable && g.kind === "bus" && (
            <form
              className={styles.add}
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: "rowAdded", collection: "buses", row: { id: busId.trim() } });
                onSelect({ kind: "bus", id: busId.trim() });
                setBusId("");
              }}
            >
              <label htmlFor="ws-bus-id">New bus id</label>
              <input id="ws-bus-id" required value={busId} onChange={(e) => setBusId(e.target.value)} />
              <button type="submit">Add bus</button>
            </form>
          )}
          {editable && g.add && (
            <button type="button" className={styles.add} onClick={g.add}>
              + Add {g.kind}
            </button>
          )}
        </section>
      ))}
      <section aria-label="Limits">
        <h2>
          <span>Limits</span>
        </h2>
        <ul>
          <li>
            <button type="button" aria-pressed={isSel("limits")} onClick={() => onSelect({ kind: "limits" })}>
              Design limits
            </button>
          </li>
        </ul>
      </section>
    </nav>
  );
}

function Workspace() {
  const { design, runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const area = useSearchParams().get("area") === "check" ? "check" : "model";
  const [sel, setSel] = useState<Selection>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [drawer, setDrawer] = useState(true);
  const [tab, setTab] = useState<"margins" | "pf">("margins");
  const sld = useSldModel();
  const report = useValidation(design);
  const ref = m1Ref(runRecords);
  const fresh = m1Freshness(ref?.snapshot_hash ?? null, report);
  const m1Record = runRecords.find((r) => r.record_id === ref?.record_id) ?? null;
  const m1Resp = asResponse(latestRun(runRecords, "M1", report?.snapshot_hash ?? null));
  const m1 = m1Resp?.result.status === "FEASIBLE" ? (m1Resp.result.payload as unknown as M1Payload) : null;
  const m2Resp = asResponse(latestRun(runRecords, "M2", report?.snapshot_hash ?? null));
  const r2 = m2Resp?.result;
  const m2 = r2 && (r2.status === "FEASIBLE" || r2.status === "INFEASIBLE") ? (r2.payload as unknown as M2Payload) : null;
  // starts from the user's last M2 entry, or the guided example's (K147, D-92 K230), as on S-08
  const ex = useExampleForm<M2Params>("constraint-check", lastM2Params(runRecords));
  const params = ex.values;
  const marginsSet = params.inverter_margin_ratio !== null && params.line_margin_ratio !== null;
  const { busy, error, setError, call } = useAnalysisCall();

  const select = (s: Selection) => {
    setSel(s);
    setFocusKey((k) => k + 1);
  };
  async function runM1() {
    const data = await call("M1", { project_snapshot: design, parameters: {}, solver_config: SOLVER });
    if (data) dispatch({ type: "runRecordAdded", record: data.run_record });
  }
  async function runM2() {
    if (!ref) return;
    const parameters = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null));
    const data = await call("M2", { project_snapshot: design, parameters, solver_config: SOLVER, depends_on: ref });
    if (data) dispatch({ type: "runRecordAdded", record: data.run_record });
  }

  const element = sel && sel.kind !== "limits" ? sel : null;
  const issues = report?.issues ?? [];
  const designIssues = issues.filter((i) => i.level === "topology" || !["Bus", "Line", "Inverter", "Load"].includes(i.entity ?? ""));

  return (
    <div className={styles.ws} data-area={area}>
      <div className={`no-print ${styles.bar}`}>
        <h1>{area === "check" ? "Check" : "Model"}</h1>
        <span className={styles.spacer} />
        <button type="button" onClick={() => void runM1()} disabled={busy} aria-busy={busy || undefined}>
          Run M1
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => void runM2()}
          disabled={busy || fresh !== "current" || !marginsSet}
          aria-busy={busy || undefined}
        >
          Run M2
        </button>
      </div>

      <ElementList selected={sel} onSelect={select} editable={area === "model"} />

      <div className={styles.canvas}>
        {area === "check" && <CheckStrip fresh={fresh} m1={m1} m1Record={m1Record} m2={m2} />}
        {area === "check" && <M1BlockedNote f={fresh} />}
        {area === "check" && (
          <details className={styles.settings} open={!marginsSet || undefined}>
            <summary>Constraint check settings{marginsSet ? "" : ": enter both design margins to run M2"}</summary>
            <form aria-label="Constraint check settings" onSubmit={(e) => (e.preventDefault(), void runM2())}>
              {M2_FIELDS.map(([k, label, unit, step]) => (
                <NumberField
                  key={k}
                  id={k}
                  label={label}
                  unit={unit}
                  step={step}
                  value={params[k]}
                  onChange={(v) => ex.set(k, v)}
                  adornment={ex.tag(k, label)}
                  note={ex.note(k)}
                />
              ))}
              {ex.resetButton}
            </form>
          </details>
        )}
        {error && <Toast message={error} onDismiss={() => setError(null)} />}
        {area === "model" && <RunWholeExample />}
        {area === "model" ? (
          <section aria-label="Single-line diagram">
            <h2 className="sr-only">Single-line diagram</h2>
            <SingleLineDiagram drawing={sld.design} details={sld.full} selected={element?.id ?? null} onSelect={select} breakers={sld.breakers} />
          </section>
        ) : (
          <ResultsDiagram fresh={fresh} checks selected={element?.id ?? null} onSelect={select} />
        )}
        {area === "model" && (
          <section aria-label="Design issues" className={styles.issues}>
            <h2>Design issues</h2>
            {designIssues.length === 0 ? (
              <p className="all-clear">
                <Icon name="feasible" />
                No network-level problems found.
              </p>
            ) : (
              <ul>
                {designIssues.map((i, k) => (
                  <li key={k}>
                    {[i.entity, i.id, i.field].filter(Boolean).join(" / ") || "Design"}: {i.message}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <div className={styles.insp}>
        {sel?.kind === "limits" ? (
          <aside aria-label="Inspector: Design limits" className={`no-print ${inspectorStyles.docked}`}>
            <div className={inspectorStyles.top}>
              <h2>Design limits</h2>
              <button type="button" onClick={() => setSel(null)}>
                Close inspector
              </button>
            </div>
            <LimitsForm />
          </aside>
        ) : element ? (
          <Inspector
            docked
            target={element}
            focusKey={focusKey}
            onClose={() => setSel(null)}
            edit={
              area === "model" ? (
                <ElementForm
                  key={`${element.kind}:${element.id}`}
                  target={element}
                  onRename={(id) => setSel({ kind: "bus", id })}
                  onDeleted={() => setSel(null)}
                />
              ) : undefined
            }
          />
        ) : (
          <p className={styles.empty}>Choose an element in the list or on the diagram.</p>
        )}
      </div>

      {area === "check" && (
        <section aria-label="Results" className={styles.dock}>
          <div className={styles.tabs}>
            <div role="tablist" aria-label="Result tables">
              <button type="button" role="tab" aria-selected={tab === "margins"} onClick={() => (setTab("margins"), setDrawer(true))}>
                Margins
              </button>
              <button type="button" role="tab" aria-selected={tab === "pf"} onClick={() => (setTab("pf"), setDrawer(true))}>
                Power flow
              </button>
            </div>
            <span className={styles.spacer} />
            <button type="button" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}>
              {drawer ? "Hide results" : "Show results"}
            </button>
          </div>
          {drawer && (
            <div role="tabpanel" aria-label={tab === "margins" ? "Margins" : "Power flow"} className={styles.panel}>
              {tab === "margins" ? (
                <>
                  {r2 && <StatusBanner type="M2" result={r2} />}
                  {r2?.status === "INFEASIBLE" && <ConstraintTable label="Limiting constraints" rows={r2.limiting_constraints ?? []} shortcut />}
                  {m2 && m2Resp ? (
                    <M2Results p={m2} charts={{ record: m2Resp.run_record }} />
                  ) : (
                    !r2 && <EmptyState title="No current constraint check.">Run M2 on the current design to see the margins.</EmptyState>
                  )}
                  <ExampleNext screen="constraint-check" ready={nextReady(r2?.status)} />
                </>
              ) : (
                <>
                  {m1Resp && <StatusBanner type="M1" result={m1Resp.result} />}
                  {m1 && m1Resp ? (
                    <M1Results p={m1} charts={{ limits: design.design_constraints, record: m1Resp.run_record }} onInspect={select} />
                  ) : (
                    !m1Resp && (
                      <EmptyState title="No current power flow.">Run M1 on the current design to see bus voltages, inverter outputs and line flows.</EmptyState>
                    )
                  )}
                  <ExampleNext screen="power-flow" ready={nextReady(m1Resp?.result.status)} />
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <RequireProject>
      {/* useSearchParams in a static export needs a Suspense boundary */}
      <Suspense fallback={null}>
        <Workspace />
      </Suspense>
    </RequireProject>
  );
}
