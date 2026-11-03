"use client";
// S-16 Report (Doc 7 §6.7; FR-48, FR-58, FR-59, FR-60): built from the latest RunRecord per
// analysis in the store; validity indicators and the A1–A6 checklist (Doc 12 FR-61, FR-63). Section toggles (Should) are not built yet; printing uses the browser.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta } from "../../api-client";
import type { AnalysisType, M1Payload, M2Payload, MetaInfo, PsPayload, RunRecord } from "../../api-types";
import { AdvisoryPanel } from "../../components/AdvisoryPanel";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { IndicatorPanel, indicatorText, useIndicatorRows } from "../../components/IndicatorPanel";
import { M1Results } from "../../components/M1Results";
import { num } from "../../components/format";
import { ConstraintTable, KIND_WORDS, M2Results } from "../../components/M2Results";
import { RequireProject } from "../../components/RequireProject";
import { statusIcon, TOKEN_ROLE } from "../../components/StatusBanner";
import { bannerText } from "../../components/status-text";
import { useValidation } from "../../components/useValidation";
import { BarChart } from "../../components/charts/BarChart";
import { useProject } from "../../store";
import styles from "./report.module.css";

// Manuscript Tabel 1.1 (Bab 1 §1.5), quoted as extracted (Doc 9 D-47 K19); handling per Doc 12 FR-63.
const MODEL_ASSUMPTIONS: [string, string, string][] = [
  ["A1", "Jaringan kuasi-statis (saluran dimodelkan aljabar)", "Checked by indicator (r_τ, κ)"],
  ["A2", "Inverter sebagai sumber tegangan ideal inner loop dalam, filter LC, PLL, dan pembatas arus", "By construction; checked by indicator (r_in)"],
  ["A3", "Konstanta waktu filter daya ditetapkan pengguna", "Set by the user; explored by sweep (M3b)"],
  ["A4", "Reaktansi saluran tidak diperbarui terhadap frekuensi; tanpa shunt", "Checked by indicator (ε_X)"],
  ["A5", "Kendali droop primer saja", "By construction"],
  ["A6", "Tiga fasa seimbang", "By construction"],
];

const HAS_PAYLOAD = new Set(["FEASIBLE", "INFEASIBLE"]);

type Summary = [string, number | string, string];
const SUMMARY: DataColumn<Summary>[] = [
  { key: "q", header: "Quantity", cell: (r) => r[0] },
  { key: "v", header: "Value", numeric: true, cell: (r) => r[1] },
  { key: "u", header: "Unit", cell: (r) => r[2] },
];

function Report() {
  const { project, design, runRecords } = useProject();
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  useEffect(() => {
    void getMeta().then((r) => r.ok && setMeta(r.data));
  }, []);
  const current = useValidation(design)?.snapshot_hash ?? null;
  const indicators = useIndicatorRows();

  const latest = (t: AnalysisType) =>
    runRecords.findLast((r) => r.analysis_type === t && r.result.status !== "INPUT_INVALID") ?? null;
  const m1 = latest("M1");
  const m2 = latest("M2");
  const ps = latest("PS");
  const used = [ps, m1, m2, latest("M4a")].filter((r): r is RunRecord => r !== null);

  if (used.length === 0)
    return (
      <>
        <h1>Report</h1>
        <EmptyState
          title="No results yet."
          action={
            <p>
              <Link href="/power-flow/">Power flow</Link>, <Link href="/constraint-check/">Constraint check</Link>
            </p>
          }
        >
          Run M1 and M2 first.
        </EmptyState>
      </>
    );

  const outdated = (r: RunRecord) =>
    current !== null && r.snapshot_hash !== current ? (
      <p className={`outdated ${styles.outdated}`} data-testid="outdated">
        <Icon name="clock" size={14} />
        outdated: design changed after this run
      </p>
    ) : null;
  const m1p = m1 && HAS_PAYLOAD.has(m1.result.status) ? (m1.result.payload as unknown as M1Payload) : null;
  const m2p = m2 && HAS_PAYLOAD.has(m2.result.status) ? (m2.result.payload as unknown as M2Payload) : null;
  const psp = ps?.result.status === "FEASIBLE" ? (ps.result.payload as unknown as PsPayload) : null;
  const limiting = m2?.result.limiting_constraints ?? [];

  return (
    <article className={`report ${styles.report}`}>
      <div className={`no-print ${styles.controls}`}>
        <button type="button" className="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
        <p>The print layout hides these controls and the app header.</p>
      </div>
      <h1 className={styles.title}>Report: {project?.name}</h1>
      <p className={styles.meta}>
        <span>
          Date <strong>{new Date().toISOString().slice(0, 10)}</strong>
        </span>
        <span>
          Engine <strong>{meta ? `${meta.engine.engine_kind} ${meta.engine.engine_version}` : "…"}</strong>
        </span>
        <span>
          App <strong>{meta?.app_version ?? "…"}</strong>
        </span>
      </p>
      {used.some((r) => r.engine_kind === "FAKE") && (
        <p role="note" data-testid="fake-note" className="problems">
          <Icon name="warn" size={20} />
          <span>
            <strong>FAKE engine:</strong> These results come from the Fake Engine. They are placeholders, not engineering results.
          </span>
        </p>
      )}

      <h2>1 Verdict</h2>
      {m2 ? (
        <section data-testid="verdict" className={styles.verdict} data-role={TOKEN_ROLE[bannerText("M2", m2.result).role]}>
          <p>
            <strong className={styles.word}>
              <Icon name={statusIcon(m2.result)} size={20} />
              {m2.result.status}
            </strong>
            : {bannerText("M2", m2.result).headline}
          </p>
          {outdated(m2)}
        </section>
      ) : (
        <p data-testid="verdict">No constraint check (M2) yet, so there is no verdict.</p>
      )}

      <h2>2 Limiting constraints</h2>
      {limiting.length === 0 ? (
        <p>None.</p>
      ) : (
        <>
          <ul className={styles.sentences}>
            {limiting.map((c, k) => (
              <li key={k}>
                {KIND_WORDS[c.kind] ?? c.kind} at {c.element_id}: {num(c.value)} {c.unit} against the limit {num(c.limit)} {c.unit}.
              </li>
            ))}
          </ul>
          <ConstraintTable label="Limiting constraints" rows={limiting} />
        </>
      )}

      <h2>3 Margins and checks not evaluated</h2>
      {m2p ? <M2Results p={m2p} /> : <p>No M2 result with margins.</p>}

      <h2>4 Design summary</h2>
      <DataTable
        label="Design summary"
        columns={SUMMARY}
        rowKey={(r) => r[0]}
        rowName={(r) => r[0]}
        rows={[
          ["Nominal voltage, line-to-line", design.nominal_voltage_kv ?? "not set", "kV"],
          ["Nominal frequency", design.nominal_frequency_hz ?? "not set", "Hz"],
          ["Buses", design.buses?.length ?? 0, "count"],
          ["Lines", design.lines?.length ?? 0, "count"],
          ["Loads", design.loads?.length ?? 0, "count"],
          ["Inverters", design.inverters?.length ?? 0, "count"],
        ]}
      />

      <h2>5 Results and charts</h2>
      {m1p ? (
        <>
          {m1 && outdated(m1)}
          <div className={styles.chart}>
            <BarChart
              title="Bus voltage magnitude from the latest power flow (M1)"
              valueTitle="Bus voltage (p.u.)"
              categoryTitle="Bus"
              bars={m1p.bus_results.map((b) => ({ label: b.bus_id, value: b.voltage_pu }))}
              refs={[{ value: 1, label: "1.0 p.u." }]}
              record={m1}
            />
          </div>
          <M1Results p={m1p} />
        </>
      ) : (
        <p className={styles.muted}>No power flow (M1) result{m1 ? `: the latest run ended with ${m1.result.status}` : ""}.</p>
      )}

      <h2>6 Assumptions</h2>
      {psp && (
        <AdvisoryPanel label="Sizing advice basis" title="Sizing advice (advice, not design data)">
          <p className={styles.muted}>
            {psp.required_inverter_kva.basis} {psp.required_inverter_kva.assumptions.join(" ")}
          </p>
        </AdvisoryPanel>
      )}
      {m2p && (
        <p className={styles.muted}>
          Sizing check: {m2p.sizing_check.basis} {m2p.sizing_check.assumptions.join(" ")}
        </p>
      )}
      <IndicatorPanel />
      <table aria-label="Model assumptions">
        <caption>Model assumptions (manuscript Tabel 1.1) and how each is handled</caption>
        <thead>
          <tr><th>Assumption</th><th>Statement</th><th>Handling</th><th>Indicator values</th><th>RunRecord result hash</th></tr>
        </thead>
        <tbody>
          {MODEL_ASSUMPTIONS.map(([n, text, handling]) => {
            const rows = indicators.filter((i) => i.assumption === n);
            return (
              <tr key={n}>
                <th scope="row">{n}</th>
                <td lang="id">{text}</td>
                <td>{handling}</td>
                <td>{rows.map((i) => `${i.label.split(" ")[0]}: ${indicatorText(i)}`).join("; ")}</td>
                <td>{[...new Set(rows.flatMap((i) => (i.record ? [i.record.result_hash] : [])))].map((h) => <code key={h}>{h}</code>)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>7 Traceability</h2>
      <table aria-label="Traceability">
        <thead>
          <tr><th>Analysis</th><th>RunRecord id</th><th>Snapshot hash</th><th>Result hash</th></tr>
        </thead>
        <tbody>
          {used.map((r) => (
            <tr key={r.record_id}>
              <td>{r.analysis_type}</td><td>{r.record_id}</td><td><code>{r.snapshot_hash}</code></td><td><code>{r.result_hash}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export default function ReportPage() {
  return (
    <RequireProject>
      <Report />
    </RequireProject>
  );
}
