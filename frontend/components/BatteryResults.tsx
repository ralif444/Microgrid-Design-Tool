"use client";
// Battery adequacy results shared by S-20 and S-16 (Doc 12 FR-117, FR-120; guideline §5; D-110):
// the depletion chart on the shared chart foundation and the report advisory section.
import type { RunRecord } from "../api-types";
import { useProject, latestRun } from "../store";
import { AUTONOMY_OUTCOME, POWER_OUTCOME, socSeries, type BaBank, type BaPayload } from "./battery";
import { LineChart } from "./charts/LineChart";
import { DataTable, type DataColumn } from "./DataTable";
import { fmt } from "./Further";

type SentBank = { inverter_id: string; depth_of_discharge_ratio?: number | null; initial_soc_ratio?: number | null };
const sentBanks = (r: RunRecord) => ((r.parameters as { banks?: SentBank[] }).banks ?? []);

// Words for the autonomy cell: hours and clock hour, the end SoC, or the reason; never 0 or blank.
export function autonomyText(b: BaBank): string {
  const a = b.autonomy;
  if (a.outcome === "DEPLETED") return `${fmt(a.autonomy_h)} h, runs out during clock hour ${a.depletion_clock_hour}`;
  if (a.outcome === "NOT_DEPLETED") return `lasts 24 h; end state of charge ${fmt(a.end_soc_ratio)}`;
  return `Not evaluated: ${a.reason}.`;
}

export function SocChart({ p, record }: { p: BaPayload; record: RunRecord }) {
  const { x, series } = socSeries(p, sentBanks(record));
  if (series.length === 0) return null;
  return (
    <LineChart
      title="State of charge per inverter over the profile day"
      xTitle="hours from start (h)"
      yTitle="state of charge (ratio)"
      x={x}
      series={series}
      record={record}
      crosshair={{ xName: "hours from start", xUnit: "h", unit: "ratio" }}
      note="Discharge only; each line stops when the bank reaches its discharge limit."
    />
  );
}

const COLUMNS: DataColumn<BaBank>[] = [
  { key: "inv", header: "Inverter", cell: (b) => b.inverter_id },
  { key: "bank", header: "Bank", cell: (b) => `${b.bank.series_count} × ${b.bank.parallel_count}` },
  { key: "pow", header: "Power outcome", cell: (b) => POWER_OUTCOME[b.power.outcome].word },
  { key: "margin", header: "Power margin", unit: "kW", numeric: true, cell: (b) => (b.power.reason ? `Not evaluated: ${b.power.reason}.` : fmt(b.power.margin_kw)) },
  { key: "aut", header: "Autonomy outcome", cell: (b) => AUTONOMY_OUTCOME[b.autonomy.outcome].word },
  { key: "use", header: "Usable energy", unit: "kWh", numeric: true, cell: (b) => fmt(b.autonomy.usable_energy_kwh) },
  { key: "text", header: "Autonomy", cell: autonomyText },
];

// The latest FEASIBLE BA on the current design, only while the Project has a bank (FR-121).
export function useCurrentBa(current: string | null): RunRecord | null {
  const { runRecords, batteryBanks } = useProject();
  const r = batteryBanks.length ? latestRun(runRecords, "BA", current) : null;
  return r?.result.status === "FEASIBLE" ? r : null;
}

export function BatteryReportSection({ record, n }: { record: RunRecord; n: number }) {
  const p = record.result.payload as unknown as BaPayload;
  return (
    <section aria-label="Battery adequacy (advice, discharge only)">
      <h2>{n} Battery adequacy (advice, discharge only)</h2>
      <p>
        <strong>Caveat.</strong> {p.caveat_text}
      </p>
      <p>
        Start hour {String(p.banks[0]?.autonomy.start_hour ?? "—")}; {p.hours.length} hourly power flow runs. RunRecord <code>{record.record_id}</code>, computed
        by the app{record.engine_kind ? ` from ${record.engine_kind} engine results` : ""}.
      </p>
      <DataTable label="Battery adequacy results" caption="Battery adequacy per bank (Eq. 12.6 – 12.8, 12.14 – 12.18)" columns={COLUMNS} rows={p.banks} rowKey={(b) => b.inverter_id} rowName={(b) => b.inverter_id} />
      <SocChart p={p} record={record} />
    </section>
  );
}
