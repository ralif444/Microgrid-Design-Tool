"use client";
// S-16 Report (Doc 7 §6.7; FR-48, FR-58, FR-59, FR-60): built from the latest RunRecord per
// analysis in the store. Section toggles (Should) are not built yet; printing uses the browser.
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta } from "../../api-client";
import type { AnalysisType, M1Payload, M2Payload, MetaInfo, PsPayload, RunRecord } from "../../api-types";
import { M1Results } from "../../components/M1Results";
import { ConstraintTable, KIND_WORDS, M2Results } from "../../components/M2Results";
import { RequireProject } from "../../components/RequireProject";
import { bannerText } from "../../components/status-text";
import { useValidation } from "../../components/useValidation";
import { VoltageChart } from "../../components/VoltageChart";
import { useProject } from "../../store";

// Manuscript Tabel 1.1 (Bab 1 §1.5), quoted as extracted (Doc 9 D-47 K19).
const MODEL_ASSUMPTIONS: [string, string][] = [
  ["A1", "Jaringan kuasi-statis (saluran dimodelkan aljabar)"],
  ["A2", "Inverter sebagai sumber tegangan ideal inner loop dalam, filter LC, PLL, dan pembatas arus"],
  ["A3", "Konstanta waktu filter daya ditetapkan pengguna"],
  ["A4", "Reaktansi saluran tidak diperbarui terhadap frekuensi; tanpa shunt"],
  ["A5", "Kendali droop primer saja"],
  ["A6", "Tiga fasa seimbang"],
];

const HAS_PAYLOAD = new Set(["FEASIBLE", "INFEASIBLE"]);

function Report() {
  const { project, design, runRecords } = useProject();
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  useEffect(() => {
    void getMeta().then((r) => r.ok && setMeta(r.data));
  }, []);
  const current = useValidation(design)?.snapshot_hash ?? null;

  const latest = (t: AnalysisType) =>
    runRecords.findLast((r) => r.analysis_type === t && r.result.status !== "INPUT_INVALID") ?? null;
  const m1 = latest("M1");
  const m2 = latest("M2");
  const ps = latest("PS");
  const used = [ps, m1, m2].filter((r): r is RunRecord => r !== null);

  if (used.length === 0)
    return (
      <>
        <h1>Report</h1>
        <p>
          No results yet. Run M1 and M2 first: <Link href="/power-flow/">Power flow</Link>,{" "}
          <Link href="/constraint-check/">Constraint check</Link>.
        </p>
      </>
    );

  const outdated = (r: RunRecord) =>
    current !== null && r.snapshot_hash !== current ? (
      <p className="outdated" data-testid="outdated">outdated: design changed after this run</p>
    ) : null;
  const m1p = m1 && HAS_PAYLOAD.has(m1.result.status) ? (m1.result.payload as unknown as M1Payload) : null;
  const m2p = m2 && HAS_PAYLOAD.has(m2.result.status) ? (m2.result.payload as unknown as M2Payload) : null;
  const psp = ps?.result.status === "FEASIBLE" ? (ps.result.payload as unknown as PsPayload) : null;
  const limiting = m2?.result.limiting_constraints ?? [];

  return (
    <article className="report">
      <p className="no-print">
        <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
      </p>
      <h1>Report: {project?.name}</h1>
      <p>
        {new Date().toISOString().slice(0, 10)}. Engine: {meta ? `${meta.engine.engine_kind} ${meta.engine.engine_version}` : "…"}.
        App {meta?.app_version ?? "…"}.
      </p>
      {used.some((r) => r.engine_kind === "FAKE") && (
        <p role="note" data-testid="fake-note">These results come from the Fake Engine. They are placeholders, not engineering results.</p>
      )}

      <h2>1 Verdict</h2>
      {m2 ? (
        <section data-testid="verdict">
          <p>
            <strong>{m2.result.status}</strong>: {bannerText("M2", m2.result).headline}
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
          <ul>
            {limiting.map((c, k) => (
              <li key={k}>
                {KIND_WORDS[c.kind] ?? c.kind} at {c.element_id}: {c.value} {c.unit} against the limit {c.limit} {c.unit}.
              </li>
            ))}
          </ul>
          <ConstraintTable label="Limiting constraints" rows={limiting} />
        </>
      )}

      <h2>3 Margins and checks not evaluated</h2>
      {m2p ? <M2Results p={m2p} /> : <p>No M2 result with margins.</p>}

      <h2>4 Design summary</h2>
      <table aria-label="Design summary">
        <tbody>
          <tr><th scope="row">Nominal voltage, line-to-line</th><td>{design.nominal_voltage_kv ?? "not set"} kV</td></tr>
          <tr><th scope="row">Nominal frequency</th><td>{design.nominal_frequency_hz ?? "not set"} Hz</td></tr>
          <tr><th scope="row">Buses</th><td>{design.buses?.length ?? 0}</td></tr>
          <tr><th scope="row">Lines</th><td>{design.lines?.length ?? 0}</td></tr>
          <tr><th scope="row">Loads</th><td>{design.loads?.length ?? 0}</td></tr>
          <tr><th scope="row">Inverters</th><td>{design.inverters?.length ?? 0}</td></tr>
        </tbody>
      </table>

      <h2>5 Results and charts</h2>
      {m1p ? (
        <>
          {m1 && outdated(m1)}
          <VoltageChart p={m1p} />
          <M1Results p={m1p} />
        </>
      ) : (
        <p>No power flow (M1) result{m1 ? `: the latest run ended with ${m1.result.status}` : ""}.</p>
      )}

      <h2>6 Assumptions</h2>
      {psp && (
        <section className="advice" aria-label="Sizing advice basis">
          <p className="advice-tag">Sizing advice (advice, not design data)</p>
          <p>
            {psp.required_inverter_kva.basis} {psp.required_inverter_kva.assumptions.join(" ")}
          </p>
        </section>
      )}
      {m2p && (
        <p>
          Sizing check: {m2p.sizing_check.basis} {m2p.sizing_check.assumptions.join(" ")}
        </p>
      )}
      <table aria-label="Model assumptions">
        <caption>Model assumptions (manuscript Tabel 1.1)</caption>
        <tbody>
          {MODEL_ASSUMPTIONS.map(([n, text]) => (
            <tr key={n}><th scope="row">{n}</th><td lang="id">{text}</td></tr>
          ))}
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
