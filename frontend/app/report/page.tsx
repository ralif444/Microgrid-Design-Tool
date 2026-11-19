"use client";
// S-16 Report (Doc 7 §6.7; FR-48, FR-58, FR-59, FR-60): built from the latest RunRecord per
// analysis in the store; validity indicators and the A1–A6 checklist (Doc 12 FR-61, FR-63). Section toggles (Should) are not built yet; printing uses the browser.
// UX-9 (Doc 12 X3): static versions of the S-07, S-08 and M4a charts; captions add the result hash, no crosshair.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta } from "../../api-client";
import type { AnalysisType, M1Payload, M2Payload, M4aPayload, MetaInfo, ProjectSnapshot, PsPayload, RunRecord } from "../../api-types";
import { AdvisoryPanel } from "../../components/AdvisoryPanel";
import { BatteryReportSection, useCurrentBa } from "../../components/BatteryResults";
import { currentCb, useCableSizingFlag } from "../../components/cable";
import { CableReportSection } from "../../components/CableReport";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { ExampleGuide } from "../../components/ExampleForm";
import { Icon } from "../../components/Icon";
import { useLanguage } from "../../components/Language";
import { IndicatorPanel, indicatorText, useIndicatorRows } from "../../components/IndicatorPanel";
import { M1Results } from "../../components/M1Results";
import { fixed } from "../../components/format";
import { ConstraintTable, KIND_WORDS, M2Results } from "../../components/M2Results";
import { RequireProject } from "../../components/RequireProject";
import { SldFigure } from "../../components/sld/SldFigure";
import { ResultSheet } from "../../components/ResultSheet";
import { statusIcon, TOKEN_ROLE } from "../../components/StatusBanner";
import { bannerText, statusWord } from "../../components/status-text";
import { useValidation } from "../../components/useValidation";
import { BarChart } from "../../components/charts/BarChart";
import { ReportCharts } from "../../components/charts/ChartFrame";
import { M4aCharts } from "../../components/M4aCharts";
import { GUIDANCE, needsReactorAdvice } from "../../components/ReactorAdvice";
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

function Report() {
  const { t } = useLanguage();
  const SUMMARY: DataColumn<Summary>[] = [
    { key: "q", header: t("Quantity"), cell: (r) => r[0] },
    { key: "v", header: t("Value"), numeric: true, cell: (r) => r[1] },
    { key: "u", header: t("Unit"), cell: (r) => r[2] },
  ];
  const { project, design, runRecords, example } = useProject();
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  useEffect(() => {
    void getMeta().then((r) => r.ok && setMeta(r.data));
  }, []);
  const current = useValidation(design)?.snapshot_hash ?? null;
  const indicators = useIndicatorRows();
  const ba = useCurrentBa(current);
  const cbShown = useCableSizingFlag() === true && currentCb(current) !== null;

  const latest = (t: AnalysisType) =>
    runRecords.findLast((r) => r.analysis_type === t && r.result.status !== "INPUT_INVALID") ?? null;
  const m1 = latest("M1");
  const m2 = latest("M2");
  const ps = latest("PS");
  const m4a = latest("M4a");
  const used = [ps, m1, m2, m4a].filter((r): r is RunRecord => r !== null);

  if (used.length === 0)
    return (
      <>
        <h1>{t("Report")}</h1>
        <ExampleGuide screen="report" runnable={false} />
        <EmptyState
          title={t("No results yet.")}
          action={
            <p>
              <Link href="/power-flow/">{t("Power flow")}</Link>, <Link href="/constraint-check/">{t("Constraint check")}</Link>
            </p>
          }
        >
          {t("Run M1 and M2 first.")}
        </EmptyState>
      </>
    );

  const outdated = (r: RunRecord) =>
    current !== null && r.snapshot_hash !== current ? (
      <p className={`outdated ${styles.outdated}`} data-testid="outdated">
        <Icon name="clock" size={14} />
        {t("outdated: design changed after this run")}
      </p>
    ) : null;
  const m1p = m1 && HAS_PAYLOAD.has(m1.result.status) ? (m1.result.payload as unknown as M1Payload) : null;
  const m2p = m2 && HAS_PAYLOAD.has(m2.result.status) ? (m2.result.payload as unknown as M2Payload) : null;
  const psp = ps?.result.status === "FEASIBLE" ? (ps.result.payload as unknown as PsPayload) : null;
  const m4ap = m4a?.result.status === "FEASIBLE" ? (m4a.result.payload as unknown as M4aPayload) : null;
  const limiting = m2?.result.limiting_constraints ?? [];

  return (
    <ReportCharts.Provider value>
    <article className={`report ${styles.report}`}>
      <div className={`no-print ${styles.controls}`}>
        <button type="button" className="primary" onClick={() => window.print()}>
          {t("Print / Save as PDF")}
        </button>
        <p>{t("The print layout hides these controls and the app header.")}</p>
      </div>
      <ExampleGuide screen="report" runnable={false} />
      <h1 className={styles.title}>{t("Report: {name}", { name: project?.name ?? "" })}</h1>
      <p className={styles.meta}>
        <span>
          {t("Date")} <strong>{new Date().toISOString().slice(0, 10)}</strong>
        </span>
        <span>
          {t("Engine")} <strong>{meta ? `${meta.engine.engine_kind} ${meta.engine.engine_version}` : "…"}</strong>
        </span>
        <span>
          {t("App")} <strong>{meta?.app_version ?? "…"}</strong>
        </span>
      </p>
      {example && (
        <p data-testid="example-report">{t("Produced in example mode from the guided example D2.")}</p>
      )}
      {used.some((r) => r.engine_kind === "FAKE") && (
        <p role="note" data-testid="fake-note" className="problems">
          <Icon name="warn" size={20} />
          <span>
            <strong>{t("FAKE engine:")}</strong> {t("These results come from the Fake Engine. They are placeholders, not engineering results.")}
          </span>
        </p>
      )}

      <h2>{t("1 Verdict")}</h2>
      {m2 ? (
        <section data-testid="verdict" className={styles.verdict} data-role={TOKEN_ROLE[bannerText("M2", m2.result).role]}>
          <p>
            <strong className={styles.word}>
              <Icon name={statusIcon(m2.result)} size={20} />
              {t(statusWord("M2", m2.result))}
            </strong>
            : {t(bannerText("M2", m2.result).headline)}
          </p>
          {outdated(m2)}
        </section>
      ) : (
        <p data-testid="verdict">{t("No constraint check (M2) yet, so there is no verdict.")}</p>
      )}

      <h2>{t("2 Limiting constraints")}</h2>
      {limiting.length === 0 ? (
        <p>{t("None.")}</p>
      ) : (
        <>
          <ul className={styles.sentences}>
            {limiting.map((c, k) => (
              <li key={k}>
                {t("{kind} at {id}: {value} {unit} against the limit {limit} {unit}.", { kind: t(KIND_WORDS[c.kind] ?? c.kind), id: c.element_id, value: fixed(c.value, c.unit), unit: c.unit, limit: fixed(c.limit, c.unit) })}
              </li>
            ))}
          </ul>
          <ConstraintTable label={t("Limiting constraints")} rows={limiting} note={false} />
        </>
      )}

      <h2>{t("3 Margins and checks not evaluated")}</h2>
      {m2p && m2 ? <ResultSheet record={m2}><M2Results p={m2p} charts={{ record: m2 }} /></ResultSheet> : <p>{t("No M2 result with margins.")}</p>}

      <h2>{t("4 Design summary")}</h2>
      <DataTable
        label={t("Design summary")}
        columns={SUMMARY}
        rowKey={(r) => r[0]}
        rowName={(r) => r[0]}
        rows={[
          [t("Nominal voltage, line-to-line"), design.nominal_voltage_kv ?? t("not set"), "kV"],
          [t("Nominal frequency"), design.nominal_frequency_hz ?? t("not set"), "Hz"],
          [t("Buses"), design.buses?.length ?? 0, t("count")],
          [t("Lines"), design.lines?.length ?? 0, t("count")],
          [t("Loads"), design.loads?.length ?? 0, t("count")],
          [t("Inverters"), design.inverters?.length ?? 0, t("count")],
        ]}
      />

      {/* FR-97: the design the reported M1 analysed, with that run's results */}
      {m1 && (
        <>
          {outdated(m1)}
          <SldFigure record={m1} />
        </>
      )}

      <h2>{t("5 Results and charts")}</h2>
      {m1p ? (
        <>
          {m1 && outdated(m1)}
          <ResultSheet record={m1}>
          <div className={styles.chart}>
            <BarChart
              title={t("Bus voltage magnitude from the latest power flow (M1)")}
              valueTitle={t("Bus voltage (p.u.)")}
              categoryTitle={t("Bus")}
              categories={m1p.bus_results.map((b) => b.bus_id)}
              series={[{ name: t("Voltage"), values: m1p.bus_results.map((b) => b.voltage_pu) }]}
              refs={[{ value: 1, label: "1.0 p.u." }]}
              record={m1}
            />
          </div>
          {/* limits as the reported run saw them, so the reference lines match that run */}
          {m1 && <M1Results p={m1p} charts={{ limits: (m1.snapshot as ProjectSnapshot | null)?.design_constraints, record: m1, voltage: false }} check={m1.snapshot ? { design: m1.snapshot as ProjectSnapshot, m2: m2?.snapshot_hash === m1.snapshot_hash ? m2p : null } : undefined} />}
          </ResultSheet>
        </>
      ) : (
        <p className={styles.muted}>{m1 ? t("No power flow (M1) result: the latest run ended with “{status}”.", { status: t(statusWord("M1", m1.result)) }) : t("No power flow (M1) result.")}</p>
      )}

      {m4ap && m4a && (
        <>
          <h3>{t("Small-signal (M4a): {status}", { status: t(statusWord("M4a", m4a.result)) })}</h3>
          {outdated(m4a)}
          <ResultSheet record={m4a}>
            <M4aCharts p={m4ap} record={m4a} reason={m4a.result.diagnostics?.participation_reason} />
          </ResultSheet>
          {needsReactorAdvice(m4ap) && <p data-testid="report-reactor-guidance">{t(GUIDANCE)}</p>}
        </>
      )}

      <h2>{t("6 Assumptions")}</h2>
      {psp && (
        <AdvisoryPanel label={t("Sizing advice basis")} title={t("Sizing advice (advice, not design data)")}>
          <p className={styles.muted}>
            {psp.required_inverter_kva.basis} {psp.required_inverter_kva.assumptions.join(" ")}
          </p>
        </AdvisoryPanel>
      )}
      {m2p && (
        <p className={styles.muted}>
          {t("Sizing check:")} {m2p.sizing_check.basis} {m2p.sizing_check.assumptions.join(" ")}
        </p>
      )}
      <IndicatorPanel />
      <table aria-label={t("Model assumptions")}>
        <caption>{t("Model assumptions (manuscript Tabel 1.1) and how each is handled")}</caption>
        <thead>
          <tr><th>{t("Assumption")}</th><th>{t("Statement (as in the manuscript)")}</th><th>{t("Handling")}</th><th>{t("Indicator values")}</th><th>{t("RunRecord result hash")}</th></tr>
        </thead>
        <tbody>
          {MODEL_ASSUMPTIONS.map(([n, text, handling]) => {
            const rows = indicators.filter((i) => i.assumption === n);
            return (
              <tr key={n}>
                <th scope="row">{n}</th>
                <td lang="id">{text}</td>
                <td>{n === "A2" && ba ? t("{handling}; battery not modelled, see the battery adequacy section", { handling: t(handling) }) : t(handling)}</td>
                <td>{rows.map((i) => `${i.label.split(" ")[0]}: ${indicatorText(i)}`).join("; ")}</td>
                <td>{[...new Set(rows.flatMap((i) => (i.record ? [i.record.result_hash] : [])))].map((h) => <code key={h}>{h}</code>)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>{t("7 Traceability")}</h2>
      <table aria-label={t("Traceability")}>
        <thead>
          <tr><th>{t("Analysis")}</th><th>{t("RunRecord id")}</th><th>{t("Snapshot hash")}</th><th>{t("Result hash")}</th></tr>
        </thead>
        <tbody>
          {used.map((r) => (
            <tr key={r.record_id}>
              <td>{r.analysis_type}</td><td>{r.record_id}</td><td><code>{r.snapshot_hash}</code></td><td><code>{r.result_hash}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
      <CableReportSection current={current} />
      {ba && <BatteryReportSection record={ba} n={cbShown ? 9 : 8} />}
    </article>
    </ReportCharts.Provider>
  );
}

export default function ReportPage() {
  return (
    <RequireProject>
      <Report />
    </RequireProject>
  );
}
