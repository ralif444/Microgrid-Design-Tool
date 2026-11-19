"use client";
// S-13 Small-signal (M4a) (Doc 7 §6.6, Doc 3 §6.8): optional τ_in and damping threshold; class in
// words; validity-indicator panel (FR-61); τ_in pre-filled from a catalogue entry (Doc 12 FR-71).
// UX-5 (Doc 12 X2, X3): KPI strip, eigenvalue plot, participation grid; tables on DataTable.
import { useKept } from "../../components/useKept";
import Link from "next/link";
import type { M4aPayload } from "../../api-types";
import { ExampleGuide, ExampleNext, nextReady } from "../../components/ExampleForm";
import { tauInSource } from "../../components/Catalog";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { fixedOr } from "../../components/format";
import { InfeasibleNote, OutOfDate, RunButton, tauMissing, useDependentRun } from "../../components/Further";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { useLanguage } from "../../components/Language";
import { m4aKpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { eigenRows, M4aCharts, type EigRow } from "../../components/M4aCharts";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { ResultSheet } from "../../components/ResultSheet";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import styles from "../../components/Further.module.css";

const CLASS_WORDS: Record<string, string> = {
  STABLE: "Stable: every eigenvalue lies in the left half-plane.",
  MARGINAL: "Marginal: the largest real part is zero within the tolerance.",
  UNSTABLE: "Unstable: at least one eigenvalue has a positive real part.",
};

const yesNo = (b: boolean | null | undefined, none: string) => (b === null || b === undefined ? none : b ? "yes" : "no");

type Dom = M4aPayload["dominant_modes"][number];
const dominantCols = (t: (k: string) => string): DataColumn<Dom>[] => [
  { key: "k", header: t("Eigenvalue"), term: "eigen", cell: (d) => <strong>#{d.eigenvalue_index}</strong> },
  { key: "z", header: t("Damping ratio"), term: "zeta", unit: "ratio", numeric: true, cell: (d) => fixedOr(d.damping_ratio, "ratio") },
  { key: "f", header: t("Frequency"), unit: "Hz", numeric: true, cell: (d) => fixedOr(d.frequency_hz, "Hz") },
  {
    key: "e",
    header: t("Associated elements"),
    cell: (d) =>
      d.associated_element_ids.map((id) => (
        <Link key={id} href={`/network/?focus=${encodeURIComponent(id)}`}>
          {id}
        </Link>
      )),
  },
];

const eigenCols = (t: (k: string) => string): DataColumn<EigRow>[] => [
  { key: "k", header: "#", cell: (e) => `${e.k}${e.dominant ? ` ${t("(dominant)")}` : ""}` },
  { key: "re", header: t("Real part"), unit: "1/s", numeric: true, cell: (e) => fixedOr(e.re, "1/s") },
  { key: "im", header: t("Imaginary part"), unit: "1/s", numeric: true, cell: (e) => fixedOr(e.im, "1/s") },
  { key: "z", header: t("Damping ratio"), term: "zeta", unit: "ratio", numeric: true, cell: (e) => fixedOr(e.zeta, "ratio") },
  { key: "f", header: t("Frequency"), unit: "Hz", numeric: true, cell: (e) => fixedOr(e.f, "Hz") },
];

function SmallSignal() {
  const { t } = useLanguage();
  const { design, fresh, busy, resp, stale, error, clearError, run, m2Infeasible } = useDependentRun("M4a");
  const { from, conflict } = tauInSource(design.inverters ?? []);
  const [tauIn, setTauIn] = useKept<number | null>("tauIn", from?.tau_in_s ?? null);
  const [threshold, setThreshold] = useKept<number | null>("threshold", null);
  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M4aPayload) : null;
  const eig: EigRow[] = p ? eigenRows(p) : [];
  const thresholdGiven = (resp?.run_record.parameters as { damping_threshold_ratio?: number } | undefined)?.damping_threshold_ratio !== undefined;
  return (
    <>
      <div className={styles.head}>
        <h1>
          {t("Small-signal")} <span className="code-label">(M4a)</span>
        </h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <ExampleGuide screen="small-signal" />
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <div className={styles.study}>
      <form
        aria-label={t("Small-signal settings")}
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          const parameters: Record<string, number> = {};
          if (tauIn !== null) parameters.tau_in_s = tauIn;
          if (threshold !== null) parameters.damping_threshold_ratio = threshold;
          void run({ parameters });
        }}
      >
        <p>
          <NumberField id="tau-in" label={t("Inner-loop time constant τ_in, optional")} unit="s" value={tauIn} onChange={setTauIn} />
        </p>
        {from && (
          <p data-testid="tau-in-source" className={styles.source}>
            {t("Pre-filled from catalogue entry {id}: {source}. One τ_in applies to every inverter in this run.", {
              id: from.entry_id,
              source: [from.provenance.manufacturer, from.provenance.model, from.provenance.document, from.provenance.revision, from.sources?.tau_in_s].filter(Boolean).join(", "),
            })}
          </p>
        )}
        {conflict && <p className={styles.source}>{t("Catalogue entries give different τ_in values, so none is pre-filled.")}</p>}
        <p>
          <NumberField id="damping-threshold" label={t("Damping pass threshold, optional")} unit="ratio" value={threshold} onChange={setThreshold} />
        </p>
        <RunButton label="Run small-signal analysis" busy={busy} fresh={fresh} missing={tauMissing(design)} />
      </form>
      <div className={styles.result}>
      {error && <Toast message={error} onDismiss={clearError} />}
      <OutOfDate show={stale} />
      {resp && r && (
        <ResultSheet record={resp.run_record}>
          <StatusBanner type="M4a" result={r} />
      {p && resp && <KpiStrip label={t("Small-signal key figures")} kpis={m4aKpis(p, thresholdGiven)} record={resp.run_record} />}
      {p && resp && (
        <>
          <h2>{t("Class: {value}", { value: p.stability_class })}</h2>
          <p data-testid="stability-class">{t(CLASS_WORDS[p.stability_class])}</p>
          <ul className={styles.facts}>
            <li>{t("Lowest damping of the oscillatory modes ζ_min: {value}", { value: fixedOr(p.zeta_min, "ratio") })}</li>
            <li>{t("Damping passes the threshold: {value}", { value: t(yesNo(p.damping_pass, "not judged (no threshold or no oscillatory mode)")) })}</li>
            {p.outside_definition && <li>{t("The operating point violates constraints: outside definition [19].")}</li>}
          </ul>
          <IndicatorPanel />
          <M4aCharts p={p} record={resp.run_record} reason={r?.diagnostics?.participation_reason} />
          {p.dominant_modes.length > 0 && (
            <DataTable label={t("Dominant modes")} caption={t("Dominant modes")} columns={dominantCols(t)} rows={p.dominant_modes} rowKey={(d) => d.eigenvalue_index} rowName={(d) => `#${d.eigenvalue_index}`} />
          )}
          {eig.length > 0 && <DataTable label={t("Eigenvalues")} caption={t("Eigenvalues and modes (Eq. 4.20)")} columns={eigenCols(t)} rows={eig} rowKey={(e) => e.k} rowName={(e) => `#${e.k}`} />}
        </>
      )}
        </ResultSheet>
      )}
      {!resp && <EmptyState title={t("Not run yet.")}>{t("Run the small-signal analysis to see the eigenvalues, damping and the stability class.")}</EmptyState>}
      </div>
      </div>
      <ExampleNext screen="small-signal" ready={nextReady(r?.status)} />
    </>
  );
}

export default function SmallSignalPage() {
  return (
    <RequireProject>
      <SmallSignal />
    </RequireProject>
  );
}
