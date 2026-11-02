"use client";
// Validity-indicator panel (Doc 12 P1; FR-61, FR-61a, FR-62) on S-07, S-13, S-14 and S-16. It only
// displays engine output: the latest M4a on the current design, else ε_X from the latest M1 on it.
// Not calibrated (stage 1.6): raw values, the label, and no colour.
import { useEffect, useState } from "react";
import { getMeta } from "../api-client";
import type { M1Payload, M4aPayload, RunRecord } from "../api-types";
import { fmt } from "./Further";
import { useValidation } from "./useValidation";
import { useProject } from "../store";

type Key = keyof M4aPayload["indicators"];

const ROWS: [Key, string, string][] = [
  ["r_tau", "A1", "r_τ line-to-filter time ratio (Eq. 4.23)"],
  ["kappa", "A1", "κ dominant-mode speed (Eq. 4.23)"],
  ["r_in", "A2", "r_in inner-loop ratio (Eq. 4.23)"],
  ["epsilon_x", "A4", "ε_X validity indicator (Eq. 4.1)"],
];

export interface IndicatorRow {
  key: Key;
  assumption: string;
  label: string;
  value: number | null; // null = not evaluated, `reason` says why
  reason: string | null;
  record: RunRecord | null;
}

export function indicatorRows(records: RunRecord[], current: string | null): IndicatorRow[] {
  const latest = (t: string, ok: string[]) =>
    current === null
      ? null
      : (records.findLast((r) => r.analysis_type === t && r.snapshot_hash === current && ok.includes(r.result.status)) ?? null);
  const m4a = latest("M4a", ["FEASIBLE"]);
  const m1 = latest("M1", ["FEASIBLE", "INFEASIBLE"]);
  return ROWS.map(([key, assumption, label]) => {
    const row = { key, assumption, label };
    if (m4a) {
      const i = (m4a.result.payload as unknown as M4aPayload).indicators[key];
      const value = i.evaluated ? i.value : null;
      return { ...row, value, reason: value === null ? (i.reason ?? "reason not given") : null, record: m4a };
    }
    if (key === "epsilon_x" && m1)
      return { ...row, value: (m1.result.payload as unknown as M1Payload).epsilon_x_ratio, reason: null, record: m1 };
    const run = key === "epsilon_x" ? "power flow (M1) or small-signal (M4a)" : "small-signal (M4a)";
    return { ...row, value: null, reason: `run ${run} on the current design`, record: null };
  });
}

export function useIndicatorRows(): IndicatorRow[] {
  const { design, runRecords } = useProject();
  const current = useValidation(design)?.snapshot_hash ?? null;
  return indicatorRows(runRecords, current);
}

export const indicatorText = (r: IndicatorRow) =>
  r.value === null ? `not evaluated: ${r.reason}` : fmt(r.value);

export const sourceText = (r: IndicatorRow) =>
  r.record ? `${r.record.analysis_type} run ${r.record.record_id}${r.record.engine_kind === "FAKE" ? " (Fake Engine)" : ""}` : "none";

export function IndicatorPanel() {
  const rows = useIndicatorRows();
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    void getMeta().then((m) => m.ok && setVersion(m.data.indicator_threshold_version ?? null));
  }, []);
  return (
    <table aria-label="Validity indicators" data-testid="indicator-panel">
      <caption>
        Validity indicators: {version === null ? "threshold not yet calibrated" : `threshold version ${version}`}
      </caption>
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Checks assumption</th>
          <th>Value (ratio)</th>
          <th>From</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td>{r.label}</td>
            <td>{r.assumption}</td>
            <td>{indicatorText(r)}</td>
            <td>{sourceText(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
