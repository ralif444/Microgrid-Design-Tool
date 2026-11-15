"use client";
// S-20 Battery adequacy (Doc 12 B2, B3, FR-116, FR-117, FR-119, FR-120; Doc 7 §2.5; ADR-015; Doc 9
// D-109, D-110): start hour (prefilled 0) → Run gated on a current M1 → Status banner → fixed caveat →
// one row per bank (power and autonomy) → depletion chart. Advice only.
import { useState } from "react";
import type { BatteryBank, RunRecord } from "../../api-types";
import { AUTONOMY_OUTCOME, POWER_OUTCOME, valueSource, type BaBank, type BaPayload } from "../../components/battery";
import { useCatalog } from "../../components/Catalog";
import { autonomyText, BA_SUMMARY_COLUMNS, SocChart } from "../../components/BatteryResults";
import { DataTable } from "../../components/DataTable";
import { Toggletip } from "../../components/Term";
import { EmptyState } from "../../components/EmptyState";
import { fixedOr } from "../../components/format";
import { OutOfDate, RunButton, useDependentRun } from "../../components/Further";
import { Icon } from "../../components/Icon";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { basisRows, ResultSheet } from "../../components/ResultSheet";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import { useProject } from "../../store";
import further from "../../components/Further.module.css";
import table from "../../components/DataTable.module.css";
import styles from "./battery.module.css";

const SOURCE = { discharge_power: "continuous discharge power", c_rate: "C-rate × energy" } as const;

// Glossary toggletips (FR-91 language rule: Indonesian), sourced to the battery guideline (D-110 K327).
const TERMS = {
  c: { term: "Laju-C", short: "Laju pengosongan relatif terhadap energi modul (1/h); daya kontinu bank = laju-C × energi terpasang bila daya pengosongan tidak tersedia.", source: "Pedoman BESS §3.2 (Pers. 12.6)" },
  dod: { term: "Kedalaman pengosongan (DoD)", short: "Bagian energi bank yang boleh dipakai; keadaan muatan tidak boleh turun di bawah 1 − DoD.", source: "Pedoman BESS §3.3 (Pers. 12.15)" },
  soc: { term: "Keadaan muatan (SoC)", short: "Energi tersisa bank sebagai rasio energi terpasang, dihitung dari jumlah daya inverter per jam.", source: "Pedoman BESS §3.3 (Pers. 12.17)" },
  aut: { term: "Otonomi", short: "Lama bank dapat memasok inverter dari jam mulai sampai batas pengosongan tercapai (h), hanya pengosongan.", source: "Pedoman BESS §3.3 (Pers. 12.18)" },
} as const;

function Tip({ k }: { k: keyof typeof TERMS }) {
  const e = TERMS[k];
  return (
    <Toggletip label={`Glossary: ${e.term}`} lang="id">
      <strong>{e.term}</strong> {e.short} <span>Sumber: {e.source}</span>
    </Toggletip>
  );
}

function Tag({ o }: { o: { word: string; role: string; icon: "feasible" | "warn" | "dot" } }) {
  return (
    <span className={styles.tag} data-role={o.role}>
      <Icon name={o.icon} />
      {o.word}
    </span>
  );
}

function Row({ b }: { b: BaBank }) {
  const p = b.power;
  return (
    <tr data-testid={`ba-row-${b.inverter_id}`}>
      <td>{b.inverter_id}</td>
      <td>
        {b.bank.series_count} × {b.bank.parallel_count} ({b.bank.module_count} modules)
      </td>
      <td>
        <Tag o={POWER_OUTCOME[p.outcome]} />
      </td>
      <td className="num">{fixedOr(p.capability_kw, "kW")}</td>
      <td>{p.capability_source ? SOURCE[p.capability_source] : "—"}</td>
      <td className="num">{fixedOr(p.inverter_p_kw, "kW")}</td>
      <td className="num">{fixedOr(p.dc_side_power_kw, "kW")}</td>
      <td className="num">{fixedOr(p.margin_kw, "kW")}</td>
      <td>{p.reason ? `Not evaluated: ${p.reason}.` : "—"}</td>
      <td>
        <Tag o={AUTONOMY_OUTCOME[b.autonomy.outcome]} />
      </td>
      <td className="num">{fixedOr(b.autonomy.usable_energy_kwh, "kWh")}</td>
      <td>{autonomyText(b)}</td>
    </tr>
  );
}

function Battery() {
  const { batteryBanks, sizingAdvice } = useProject();
  const { catalog } = useCatalog();
  const sizing = sizingAdvice.at(-1)?.ps_parameters;
  // η_dc and DoD of each bank this run used, with where they came from (audit 2026-11-15 B2)
  const bankBasis = (rec: RunRecord): [string, string][] =>
    (((rec.parameters as { banks?: BatteryBank[] } | null)?.banks) ?? []).flatMap((b) => {
      const modDod = catalog.entries.find((e) => e.id === b.module.catalog_ref.entry_id)?.battery_module?.recommended_dod_ratio;
      const row = (name: string, v: number | null | undefined, s: string | null): [string, string] =>
        [`${name} of ${b.inverter_id}`, v == null ? "not set" : `${fixedOr(v, "ratio")} (${s})`];
      return [
        row("DC efficiency η_dc", b.dc_efficiency_ratio, valueSource(b.dc_efficiency_ratio, sizing?.dc_efficiency_ratio)),
        row("Depth of discharge", b.depth_of_discharge_ratio, valueSource(b.depth_of_discharge_ratio, sizing?.depth_of_discharge_ratio, modDod)),
      ];
    });
  const { fresh, busy, resp, stale, error, clearError, run } = useDependentRun("BA");
  const [startHour, setStartHour] = useState<number | null>(0);
  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as BaPayload) : null;
  if (batteryBanks.length === 0)
    return (
      <EmptyState title="No battery bank.">
        Attach a battery bank to an inverter on Network first.
      </EmptyState>
    );
  return (
    <>
      <div className={further.head}>
        <h1>Battery adequacy</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <M1BlockedNote f={fresh} />
      <div className={further.study}>
      <form
        aria-label="Battery adequacy settings"
        className={further.form}
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { banks: batteryBanks, start_hour: startHour } });
        }}
      >
        <p>
          <NumberField id="ba-start-hour" label="Start hour" unit="h" step="1" value={startHour} onChange={setStartHour} />
        </p>
        <RunButton label="Run battery adequacy" busy={busy} fresh={fresh} missing={startHour === null ? ["Start hour"] : []} />
      </form>
      <div className={further.result}>
      {error && <Toast message={error} onDismiss={clearError} />}
      <OutOfDate show={stale} />
      {resp && r && (
        <ResultSheet record={resp.run_record} basis={[...basisRows(resp.run_record), ...bankBasis(resp.run_record)]}>
          <StatusBanner type="BA" result={r} />
      {p && resp && (
        <>
          <p data-testid="ba-caveat" className={styles.caveat}>
            <Icon name="warn" />
            {p.caveat_text}
          </p>
          <DataTable
            label="Battery adequacy summary"
            caption="Battery adequacy per bank (Eq. 12.6 – 12.8, 12.14 – 12.18)"
            columns={BA_SUMMARY_COLUMNS}
            rows={p.banks}
            rowKey={(b) => b.inverter_id}
            rowName={(b) => b.inverter_id}
          />
          <details className={styles.details}>
            <summary>Show details: capability, inverter power and DC-side power per bank</summary>
          <div className={`table-scroll ${table.scroll}`} role="region" aria-label="Battery power check, scrolls sideways" tabIndex={0}>
            <table aria-label="Battery power check" className={table.table}>
              <caption>Power check (Eq. 12.6 – 12.8) and autonomy (Eq. 12.14 – 12.18) per bank, discharge only</caption>
              <thead>
                <tr>
                  <th scope="col">Inverter</th>
                  <th scope="col">Bank</th>
                  <th scope="col">Power outcome</th>
                  <th scope="col" className="num">
                    Capability (kW)
                  </th>
                  <th scope="col">
                    Capability from <Tip k="c" />
                  </th>
                  <th scope="col" className="num">
                    Inverter P (kW)
                  </th>
                  <th scope="col" className="num">
                    DC-side power (kW)
                  </th>
                  <th scope="col" className="num">
                    Margin (kW)
                  </th>
                  <th scope="col">Power reason</th>
                  <th scope="col">
                    Autonomy outcome <Tip k="aut" />
                  </th>
                  <th scope="col" className="num">
                    Usable energy (kWh) <Tip k="dod" />
                  </th>
                  <th scope="col">Autonomy</th>
                </tr>
              </thead>
              <tbody>
                {p.banks.map((b) => (
                  <Row key={b.inverter_id} b={b} />
                ))}
              </tbody>
            </table>
          </div>
          </details>
          <p className={further.source}>
            State of charge <Tip k="soc" /> per bank over the profile day; the flat line of each bank is its discharge limit 1 − DoD.
          </p>
          <SocChart p={p} record={resp.run_record} />
          <p className={further.record} data-testid="ba-record">
            Computed by the app from {String(r?.diagnostics?.engine_calls ?? 0)} hourly power flow runs
            {resp.run_record.engine_kind ? ` (${resp.run_record.engine_kind} engine)` : ""}.
          </p>
        </>
      )}
        </ResultSheet>
      )}
      {!resp && <EmptyState title="Not run yet.">Run the battery adequacy check after a current M1.</EmptyState>}
      </div>
      </div>
    </>
  );
}

export default function BatteryPage() {
  return (
    <RequireProject>
      <Battery />
    </RequireProject>
  );
}
