"use client";
// Result sheet (audit 2026-11-14 §8, variant A "drawing sheet"): a framed sheet with the result on the
// left and, on the right, the basis of the run, the revisions of this result and a title block that
// replaces the run-id strings. Everything shown comes from the RunRecord and the Project; the full run
// id stays in the title attribute, Run history and every export.
import type { ReactNode } from "react";
import type { AnalysisType, ProjectSnapshot, RunRecord } from "../api-types";
import { useProject } from "../store";
import { CONSTRAINT_FIELDS, M2_FIELDS } from "./elementFields";
import { fixed } from "./format";
import { statusWord } from "./status-text";
import styles from "./ResultSheet.module.css";

export const SHEET_NAME: Record<string, string> = {
  PS: "Sizing advice",
  M1: "Power flow (M1)",
  M2: "Constraint check (M2)",
  M3a: "Sensitivity (M3a)",
  M3b: "Sweep (M3b)",
  M3c: "Scenarios (M3c)",
  M3d: "Envelope (M3d)",
  M4a: "Small-signal (M4a)",
  M4b: "Transient (M4b)",
  BA: "Battery adequacy",
  CB: "Cable and breaker sizing",
};

const short = (id: string) => id.slice(0, 8);
const date = (iso: string) => iso.slice(0, 10);
const LABEL: Record<string, [string, string]> = Object.fromEntries([
  ...M2_FIELDS.map(([k, l, u]) => [k, [l.replace(/, optional$/, ""), u]]),
  ["tau_in_s", ["Inner-loop time constant τ_in", "s"]],
  ["damping_threshold_ratio", ["Damping pass threshold", "ratio"]],
  ["step_relative", ["Step, relative", "ratio"]],
  ["step_absolute", ["Step, absolute", "parameter unit"]],
  ["start_hour", ["Start hour", "h"]],
  ["unit_count", ["Number of inverter units n", "count"]],
  ["redundancy", ["Redundancy r", "count"]],
]);

// Sizing owns its own m_inv (O-8), so its basis uses the Sizing field's name.
const PS_LABEL: Record<string, string> = { inverter_margin_ratio: "Inverter margin m_inv" };

/** Scalar settings of the run and the limits it was checked against; nested settings stay in Run history. */
export function basisRows(r: RunRecord): [string, string][] {
  const params = Object.entries((r.parameters ?? {}) as Record<string, unknown>)
    .filter(([k, v]) => LABEL[k] && typeof v === "number")
    .map(([k, v]): [string, string] => [(r.analysis_type === "PS" && PS_LABEL[k]) || LABEL[k][0], `${fixed(v as number, LABEL[k][1])} ${LABEL[k][1]}`]);
  const limits = r.analysis_type === "M2"
    ? CONSTRAINT_FIELDS.flatMap(([k, l, u]): [string, string][] => {
        const v = (r.snapshot as ProjectSnapshot | null)?.design_constraints?.[k];
        return typeof v === "number" ? [[l, `${fixed(v, u)} ${u}`]] : [];
      })
    : [];
  const dep = r.depends_on as { analysis_type?: string; record_id?: string } | null | undefined;
  return [...params, ...limits, ...(dep?.record_id ? [["Operating point", `${dep.analysis_type ?? "M1"} run ${short(dep.record_id)}`] as [string, string]] : [])];
}

// record null (an advice whose run is not in this Project): the result alone, without sheet data
export function ResultSheet({ record, children, basis, sheet }: { record: RunRecord | null; children: ReactNode; basis?: [string, string][]; sheet?: string }) {
  const { project, runRecords } = useProject();
  if (!record) return <>{children}</>;
  const name = sheet ?? SHEET_NAME[record.analysis_type] ?? record.analysis_type;
  const rows = basis ?? basisRows(record);
  const snap = record.snapshot as ProjectSnapshot | null;
  const same = runRecords.filter((x) => x.analysis_type === record.analysis_type);
  const revs = same.map((x, k) => ({ x, rev: k < 26 ? String.fromCharCode(65 + k) : String(k + 1) })).reverse().slice(0, 4);
  const fake = record.engine_kind === "FAKE";
  return (
    <article className={styles.sheet} aria-label={`Sheet: ${name}`}>
      <div className={styles.body}>
        <div className={styles.main}>{children}</div>
        <aside className={styles.side} aria-label={`Sheet data: ${name}`}>
          <section className={styles.basis} aria-label="Basis">
            <h4>Basis of this result</h4>
            {rows.length ? (
              <dl>
                {rows.map(([l, v]) => (
                  <div key={l}>
                    <dt>{l}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>The settings of this run are listed in Run history.</p>
            )}
            <p className={styles.src}>Model: balanced 3-phase, islanded, grid-forming droop (assumptions A1–A6).</p>
          </section>
          {revs.length > 0 && (
            <section className={styles.rev} aria-label="Revisions">
              <h4>Revisions of this result</h4>
              <table>
                <thead>
                  <tr><th>Rev</th><th>Date</th><th>Run</th><th>Outcome</th></tr>
                </thead>
                <tbody>
                  {revs.map(({ x, rev }) => (
                    <tr key={x.record_id} aria-current={x.record_id === record.record_id ? "true" : undefined}>
                      <td>{rev}</td>
                      <td>{date(x.created_at)}</td>
                      <td><code title={x.record_id}>{short(x.record_id)}</code></td>
                      <td>{statusWord(x.analysis_type as AnalysisType, x.result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          <dl className={styles.tblock} aria-label="Title block" data-testid="title-block">
            <div className={styles.wide}><dt>Sheet</dt><dd className={styles.title}>{name}</dd></div>
            <div className={styles.wide}><dt>Project</dt><dd>{project?.name ?? "—"}</dd></div>
            <div><dt>System</dt><dd>{snap?.nominal_voltage_kv ?? "—"} kV LL, {snap?.nominal_frequency_hz ?? "—"} Hz</dd></div>
            <div className={fake ? styles.fake : undefined}><dt>Engine</dt><dd>{record.engine_kind === null || record.engine_kind === undefined ? "not called" : `${record.engine_kind} ${record.engine_version ?? ""}`.trim()}{fake && ": placeholder, not an engine result"}</dd></div>
            <div><dt>Run</dt><dd><code title={record.record_id} data-testid="sheet-run">{short(record.record_id)}</code></dd></div>
            <div><dt>Date</dt><dd>{date(record.created_at)}</dd></div>
            <div className={styles.wide}><dt>Design snapshot</dt><dd><code title={record.snapshot_hash} data-testid="sheet-snapshot">{short(record.snapshot_hash)}</code></dd></div>
          </dl>
        </aside>
      </div>
    </article>
  );
}
