"use client";
// S-13 Small-signal (M4a) (Doc 7 §6.6, Doc 3 §6.8): optional τ_in and damping threshold; class in
// words; validity-indicator panel (FR-61); τ_in pre-filled from a catalogue entry (Doc 12 FR-71).
// UX-5 (Doc 12 X2, X3): KPI strip, eigenvalue plot, participation grid; tables on DataTable.
import Link from "next/link";
import { useState } from "react";
import type { M4aPayload } from "../../api-types";
import { ExampleGuide, ExampleNext, nextReady } from "../../components/ExampleForm";
import { tauInSource } from "../../components/Catalog";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { m4aKpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { eigenRows, M4aCharts, type EigRow } from "../../components/M4aCharts";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
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
const DOMINANT: DataColumn<Dom>[] = [
  { key: "k", header: "Eigenvalue", term: "eigen", cell: (d) => <strong>#{d.eigenvalue_index}</strong> },
  { key: "z", header: "Damping ratio", term: "zeta", unit: "ratio", numeric: true, cell: (d) => fmt(d.damping_ratio) },
  { key: "f", header: "Frequency", unit: "Hz", numeric: true, cell: (d) => fmt(d.frequency_hz) },
  {
    key: "e",
    header: "Associated elements",
    cell: (d) =>
      d.associated_element_ids.map((id) => (
        <Link key={id} href={`/network/?focus=${encodeURIComponent(id)}`}>
          {id}
        </Link>
      )),
  },
];

const EIGEN: DataColumn<EigRow>[] = [
  { key: "k", header: "#", cell: (e) => `${e.k}${e.dominant ? " (dominant)" : ""}` },
  { key: "re", header: "Real part", unit: "1/s", numeric: true, cell: (e) => fmt(e.re) },
  { key: "im", header: "Imaginary part", unit: "1/s", numeric: true, cell: (e) => fmt(e.im) },
  { key: "z", header: "Damping ratio", term: "zeta", unit: "ratio", numeric: true, cell: (e) => fmt(e.zeta) },
  { key: "f", header: "Frequency", unit: "Hz", numeric: true, cell: (e) => fmt(e.f) },
];

function SmallSignal() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M4a");
  const { from, conflict } = tauInSource(design.inverters ?? []);
  const [tauIn, setTauIn] = useState<number | null>(from?.tau_in_s ?? null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M4aPayload) : null;
  const eig: EigRow[] = p ? eigenRows(p) : [];
  const thresholdGiven = (resp?.run_record.parameters as { damping_threshold_ratio?: number } | undefined)?.damping_threshold_ratio !== undefined;
  return (
    <>
      <div className={styles.head}>
        <h1>Small-signal (M4a)</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <ExampleGuide screen="small-signal" />
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Small-signal settings"
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
          <NumberField id="tau-in" label="Inner-loop time constant τ_in, optional" unit="s" value={tauIn} onChange={setTauIn} />
        </p>
        {from && (
          <p data-testid="tau-in-source" className={styles.source}>
            Pre-filled from catalogue entry {from.entry_id}:{" "}
            {[from.provenance.manufacturer, from.provenance.model, from.provenance.document, from.provenance.revision, from.sources?.tau_in_s]
              .filter(Boolean)
              .join(", ")}
            . One τ_in applies to every inverter in this run.
          </p>
        )}
        {conflict && <p className={styles.source}>Catalogue entries give different τ_in values, so none is pre-filled.</p>}
        <p>
          <NumberField id="damping-threshold" label="Damping pass threshold, optional" unit="ratio" value={threshold} onChange={setThreshold} />
        </p>
        <button type="submit" className="primary" disabled={busy || fresh !== "current"} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run M4a"}
        </button>
      </form>
      {error && error !== dismissed && <Toast message={error} onDismiss={() => setDismissed(error)} />}
      {r && <StatusBanner type="M4a" result={r} />}
      {p && resp && <KpiStrip label="Small-signal key figures" kpis={m4aKpis(p, thresholdGiven)} record={resp.run_record} />}
      {p && resp && (
        <>
          <h2>Class: {p.stability_class}</h2>
          <p data-testid="stability-class">{CLASS_WORDS[p.stability_class]}</p>
          <ul className={styles.facts}>
            <li>Lowest damping of the oscillatory modes ζ_min: {fmt(p.zeta_min)}</li>
            <li>Damping passes the threshold: {yesNo(p.damping_pass, "not judged (no threshold or no oscillatory mode)")}</li>
            {p.outside_definition && <li>The operating point violates constraints: outside definition [19].</li>}
          </ul>
          <IndicatorPanel />
          <M4aCharts p={p} record={resp.run_record} reason={r?.diagnostics?.participation_reason} />
          {p.dominant_modes.length > 0 && (
            <DataTable label="Dominant modes" caption="Dominant modes" columns={DOMINANT} rows={p.dominant_modes} rowKey={(d) => d.eigenvalue_index} rowName={(d) => `#${d.eigenvalue_index}`} />
          )}
          {eig.length > 0 && <DataTable label="Eigenvalues" caption="Eigenvalues and modes (Eq. 4.20)" columns={EIGEN} rows={eig} rowKey={(e) => e.k} rowName={(e) => `#${e.k}`} />}
          <p className={styles.record}>
            RunRecord <code>{resp.run_record.record_id}</code>, engine {resp.run_record.engine_kind ?? "not called"}.
          </p>
        </>
      )}
      {!resp && <EmptyState title="Not run yet.">Run M4a to see the eigenvalues, damping and the stability class.</EmptyState>}
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
