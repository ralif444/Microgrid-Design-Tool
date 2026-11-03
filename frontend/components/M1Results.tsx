// M1 payload with units (FR-23, NFR-05): the groups of Doc 3 §6.2 including ε_X. Placeholder
// values come from the Fake Engine. Power sharing per Doc 12 P9 (FR-81): advisory, not a constraint.
import type { M1Payload } from "../api-types";
import { AdvisoryPanel } from "./AdvisoryPanel";
import { DataTable, type DataColumn } from "./DataTable";

type Bus = M1Payload["bus_results"][number];
type Inv = M1Payload["inverter_results"][number];
type Share = M1Payload["sharing"][number];
type Line = M1Payload["line_results"][number];
type Total = [string, number, string];

const n = <R,>(key: string, header: string, unit: string, get: (r: R) => number): DataColumn<R> => ({ key, header, unit, numeric: true, cell: get });
const id = <R,>(header: string, get: (r: R) => string): DataColumn<R> => ({ key: "id", header, cell: (r) => <strong>{get(r)}</strong> });

const TOTALS: DataColumn<Total>[] = [
  { key: "q", header: "Quantity", cell: (t) => t[0] },
  { key: "v", header: "Value", numeric: true, cell: (t) => t[1] },
  { key: "u", header: "Unit", cell: (t) => t[2] },
];
const BUSES: DataColumn<Bus>[] = [
  id("Bus", (b) => b.bus_id),
  n("kv", "Voltage", "kV", (b) => b.voltage_kv),
  n("pu", "Voltage", "p.u.", (b) => b.voltage_pu),
  n("deg", "Angle", "deg", (b) => b.angle_deg),
];
const INVERTERS: DataColumn<Inv>[] = [
  id("Inverter", (i) => i.inverter_id),
  n("p", "P", "kW", (i) => i.p_kw),
  n("q", "Q", "kvar", (i) => i.q_kvar),
  n("s", "S", "kVA", (i) => i.s_kva),
  n("l", "Loading", "ratio", (i) => i.loading_ratio),
];
const SHARING: DataColumn<Share>[] = [
  id("Inverter", (s) => s.inverter_id),
  n("dp", "ΔP", "kW", (s) => s.p_deviation_kw),
  n("dq", "ΔQ", "kvar", (s) => s.q_deviation_kvar),
  n("pe", "P error", "pu of rating", (s) => s.p_error_pu),
  n("qe", "Q error", "pu of rating", (s) => s.q_error_pu),
  { key: "qv", header: "Q–V droop not rating-proportional", cell: (s) => (s.q_droop_not_rating_proportional ? "yes" : "no") },
];
const LINES: DataColumn<Line>[] = [
  id("Line", (l) => l.line_id),
  n("pf", "P from", "kW", (l) => l.p_from_kw),
  n("qf", "Q from", "kvar", (l) => l.q_from_kvar),
  n("pt", "P to", "kW", (l) => l.p_to_kw),
  n("qt", "Q to", "kvar", (l) => l.q_to_kvar),
  n("i", "Current", "A", (l) => l.current_a),
  n("loss", "Losses", "kW", (l) => l.losses_kw),
];

export function M1Results({ p }: { p: M1Payload }) {
  const totals: Total[] = [
    ["System frequency", p.system_frequency_hz, "Hz"],
    ["Total load, active", p.total_load_kw, "kW"],
    ["Total load, reactive", p.total_load_kvar, "kvar"],
    ["Total losses", p.total_losses_kw, "kW"],
    ["Iterations", p.iterations, "count"],
    ["Validity indicator ε_X", p.epsilon_x_ratio, "ratio"],
  ];
  return (
    <section aria-label="Power flow results">
      <DataTable label="System totals" caption="System" columns={TOTALS} rows={totals} rowKey={(t) => t[0]} rowName={(t) => t[0]} />
      <DataTable label="Bus voltages" caption="Bus voltages" columns={BUSES} rows={p.bus_results} rowKey={(b) => b.bus_id} rowName={(b) => b.bus_id} />
      <DataTable
        label="Inverter outputs"
        caption="Inverter outputs"
        columns={INVERTERS}
        rows={p.inverter_results}
        rowKey={(i) => i.inverter_id}
        rowName={(i) => i.inverter_id}
      />
      <AdvisoryPanel label="Power sharing advice" title="Power sharing against rating-proportional sharing (advisory, not a constraint)">
        <DataTable label="Power sharing" columns={SHARING} rows={p.sharing} rowKey={(s) => s.inverter_id} rowName={(s) => s.inverter_id} />
      </AdvisoryPanel>
      <DataTable label="Line flows" caption="Line flows" columns={LINES} rows={p.line_results} rowKey={(l) => l.line_id} rowName={(l) => l.line_id} />
    </section>
  );
}
