"use client";
// Battery adequacy results shared by S-20 and S-16 (Doc 12 FR-117, FR-120; guideline §5; D-110):
// the depletion chart on the shared chart foundation and the report advisory section.
import type { RunRecord } from "../api-types";
import { useProject, latestRun } from "../store";
import { AUTONOMY_OUTCOME, POWER_OUTCOME, socSeries, type BaBank, type BaPayload } from "./battery";
import { LineChart } from "./charts/LineChart";
import { DataTable, type DataColumn } from "./DataTable";
import { fixedOr } from "./format";
import { displayLang, translate } from "./i18n";
import { useLanguage } from "./Language";

const tr = (k: string, v?: Record<string, string | number>) => translate(displayLang(), k, v);

type SentBank = { inverter_id: string; depth_of_discharge_ratio?: number | null; initial_soc_ratio?: number | null };
const sentBanks = (r: RunRecord) => ((r.parameters as { banks?: SentBank[] }).banks ?? []);

// Words for the autonomy cell: hours and clock hour, the end SoC, or the reason; never 0 or blank.
export function autonomyText(b: BaBank): string {
  const a = b.autonomy;
  if (a.outcome === "DEPLETED") return tr("{h} h, runs out during clock hour {hour}", { h: fixedOr(a.autonomy_h, "h"), hour: a.depletion_clock_hour ?? "" });
  if (a.outcome === "NOT_DEPLETED") return tr("lasts 24 h; end state of charge {soc}", { soc: fixedOr(a.end_soc_ratio, "ratio") });
  return tr("Not evaluated: {reason}.", { reason: a.reason ?? "" });
}

export function SocChart({ p, record }: { p: BaPayload; record: RunRecord }) {
  const { t } = useLanguage();
  const { x, series } = socSeries(p, sentBanks(record));
  if (series.length === 0) return null;
  return (
    <LineChart
      title={t("State of charge per inverter over the profile day")}
      xTitle={t("hours from start (h)")}
      yTitle={t("state of charge (ratio)")}
      x={x}
      series={series}
      record={record}
      crosshair={{ xName: t("hours from start"), xUnit: "h", unit: "ratio" }}
      note={t("Discharge only; each line stops when the bank reaches its discharge limit.")}
    />
  );
}

// The 7-column summary of the Report, also shown first on S-20 (audit 2026-11-15).
export const BA_SUMMARY_COLUMNS: DataColumn<BaBank>[] = [
  // headers are getters so they follow the display language at render time (the array is built once)
  { key: "inv", get header() { return tr("Inverter"); }, cell: (b) => b.inverter_id },
  { key: "bank", get header() { return tr("Bank"); }, cell: (b) => `${b.bank.series_count} × ${b.bank.parallel_count}` },
  { key: "pow", get header() { return tr("Power outcome"); }, cell: (b) => tr(POWER_OUTCOME[b.power.outcome].word) },
  { key: "margin", get header() { return tr("Power margin"); }, unit: "kW", numeric: true, cell: (b) => (b.power.reason ? tr("Not evaluated: {reason}.", { reason: b.power.reason }) : fixedOr(b.power.margin_kw, "kW")) },
  { key: "aut", get header() { return tr("Autonomy outcome"); }, cell: (b) => tr(AUTONOMY_OUTCOME[b.autonomy.outcome].word) },
  { key: "use", get header() { return tr("Usable energy"); }, unit: "kWh", numeric: true, cell: (b) => fixedOr(b.autonomy.usable_energy_kwh, "kWh") },
  { key: "text", get header() { return tr("Autonomy"); }, cell: autonomyText },
];

// The latest FEASIBLE BA on the current design, only while the Project has a bank (FR-121).
export function useCurrentBa(current: string | null): RunRecord | null {
  const { runRecords, batteryBanks } = useProject();
  const r = batteryBanks.length ? latestRun(runRecords, "BA", current) : null;
  return r?.result.status === "FEASIBLE" ? r : null;
}

export function BatteryReportSection({ record, n }: { record: RunRecord; n: number }) {
  const { t } = useLanguage();
  const p = record.result.payload as unknown as BaPayload;
  const [run1, run2] = t("Start hour {hour}; {count} hourly power flow runs. RunRecord {id}, computed by the app{engine}.", {
    hour: String(p.banks[0]?.autonomy.start_hour ?? "—"),
    count: p.hours.length,
    engine: record.engine_kind ? t(" from {kind} engine results", { kind: record.engine_kind }) : "",
  }).split("{id}");
  return (
    <section aria-label={t("Battery adequacy (advice, discharge only)")}>
      <h2>{n} {t("Battery adequacy (advice, discharge only)")}</h2>
      <p>
        <strong>{t("Caveat.")}</strong> {p.caveat_text}
      </p>
      <p>
        {run1}<code>{record.record_id}</code>{run2}
      </p>
      <DataTable label={t("Battery adequacy results")} caption={t("Battery adequacy per bank (Eq. 12.6 – 12.8, 12.14 – 12.18)")} columns={BA_SUMMARY_COLUMNS} rows={p.banks} rowKey={(b) => b.inverter_id} rowName={(b) => b.inverter_id} />
      <SocChart p={p} record={record} />
    </section>
  );
}
