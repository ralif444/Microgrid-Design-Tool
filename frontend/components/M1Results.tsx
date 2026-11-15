// M1 payload with units (FR-23, NFR-05): the groups of Doc 3 §6.2 including ε_X. Placeholder
// values come from the Fake Engine. Power sharing per Doc 12 P9 (FR-81): advisory, not a constraint.
// With `charts` (S-07, Doc 12 X3 FR-88) each table gets its chart; reference lines only for limits
// the user set on S-06, otherwise the caption says the limit is not evaluated.
import type { DesignConstraints, M1Payload, RunRecord } from "../api-types";
import { AdvisoryPanel } from "./AdvisoryPanel";
import { BarChart, type RefLine } from "./charts/BarChart";
import { DataTable, type DataColumn } from "./DataTable";
import { fixed } from "./format";
import type { ElementRef } from "./Inspector";

type Bus = M1Payload["bus_results"][number];
type Inv = M1Payload["inverter_results"][number];
type Share = M1Payload["sharing"][number];
type Line = M1Payload["line_results"][number];
type Total = [string, number, string];

const n = <R,>(key: string, header: string, unit: string, get: (r: R) => number): DataColumn<R> => ({ key, header, unit, numeric: true, cell: (r) => fixed(get(r), unit) });
const id = <R,>(header: string, get: (r: R) => string): DataColumn<R> => ({ key: "id", header, cell: (r) => <strong>{get(r)}</strong> });

const TOTALS: DataColumn<Total>[] = [
  { key: "q", header: "Quantity", cell: (t) => t[0] },
  { key: "v", header: "Value", numeric: true, cell: (t) => fixed(t[1], t[2]) },
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
  { ...n("l", "Loading", "ratio", (i: Inv) => i.loading_ratio), term: "loading" },
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

const ref = (value: number | null | undefined, label: string): RefLine[] => (value === null || value === undefined ? [] : [{ value, label }]);
const unset = (refs: RefLine[], what: string) => (refs.length ? undefined : `No ${what} set: not evaluated.`);

// `voltage: false`: the report keeps its own bus-voltage chart, so the profile is not drawn twice.
export type M1Charts = { limits: DesignConstraints | null | undefined; record: RunRecord; voltage?: false };
type OnInspect = ((t: ElementRef) => void) | undefined;

// S-07 only: the id cell becomes a button that opens the Inspector (FR-90); the text stays the id
const inspectable = <R,>(cols: DataColumn<R>[], kind: ElementRef["kind"], get: (r: R) => string, on: OnInspect): DataColumn<R>[] =>
  on
    ? cols.map((c) =>
        c.key === "id"
          ? { ...c, cell: (r) => <button type="button" className="inspect" aria-label={`Inspect ${get(r)}`} onClick={() => on({ kind, id: get(r) })}>{get(r)}</button> }
          : c,
      )
    : cols;

export function M1Results({ p, charts, onInspect }: { p: M1Payload; charts?: M1Charts; onInspect?: OnInspect }) {
  const c = charts?.limits ?? {};
  const vRefs = [...ref(c.voltage_min_pu, `min ${c.voltage_min_pu} p.u.`), ...ref(c.voltage_max_pu, `max ${c.voltage_max_pu} p.u.`)];
  const iRefs = ref(c.inverter_loading_limit_ratio, `limit ${c.inverter_loading_limit_ratio}`);
  const lRefs = ref(c.line_current_limit_a, `limit ${c.line_current_limit_a} A`);
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
      {charts && charts.voltage !== false && (
        <BarChart
          title="Bus voltage profile"
          valueTitle="Bus voltage (p.u.)"
          categoryTitle="Bus"
          categories={p.bus_results.map((b) => b.bus_id)}
          series={[{ name: "Voltage", values: p.bus_results.map((b) => b.voltage_pu) }]}
          refs={vRefs}
          note={unset(vRefs, "voltage limit")}
          record={charts.record}
          dots
        />
      )}
      <DataTable label="Bus voltages" caption="Bus voltages" columns={inspectable(BUSES, "bus", (b) => b.bus_id, onInspect)} rows={p.bus_results} rowKey={(b) => b.bus_id} rowName={(b) => b.bus_id} />
      <DataTable
        label="Inverter outputs"
        caption="Inverter outputs"
        columns={inspectable(INVERTERS, "inverter", (i) => i.inverter_id, onInspect)}
        rows={p.inverter_results}
        rowKey={(i) => i.inverter_id}
        rowName={(i) => i.inverter_id}
      />
      {charts && (
        <BarChart
          title="Inverter loading"
          valueTitle="Inverter loading (ratio)"
          categoryTitle="Inverter"
          categories={p.inverter_results.map((i) => i.inverter_id)}
          series={[{ name: "Loading", values: p.inverter_results.map((i) => i.loading_ratio) }]}
          refs={iRefs}
          note={unset(iRefs, "inverter loading limit")}
          record={charts.record}
        />
      )}
      <AdvisoryPanel label="Power sharing advice" title="Power sharing against rating-proportional sharing (advisory, not a constraint)">
        {charts && (
          <BarChart
            title="Inverter output, P and Q"
            valueTitle="P (kW) and Q (kvar)"
            categoryTitle="Inverter"
            categories={p.inverter_results.map((i) => i.inverter_id)}
            series={[
              { name: "P (kW)", values: p.inverter_results.map((i) => i.p_kw) },
              { name: "Q (kvar)", values: p.inverter_results.map((i) => i.q_kvar) },
            ]}
            note="Deviations from rating-proportional sharing are in the table below."
            record={charts.record}
          />
        )}
        <DataTable label="Power sharing" columns={SHARING} rows={p.sharing} rowKey={(s) => s.inverter_id} rowName={(s) => s.inverter_id} />
      </AdvisoryPanel>
      {charts && (
        <BarChart
          title="Line loading"
          valueTitle="Line current (A)"
          categoryTitle="Line"
          categories={p.line_results.map((l) => l.line_id)}
          series={[{ name: "Current", values: p.line_results.map((l) => l.current_a) }]}
          refs={lRefs}
          note={unset(lRefs, "line current limit")}
          record={charts.record}
        />
      )}
      <DataTable label="Line flows" caption="Line flows" columns={inspectable(LINES, "line", (l) => l.line_id, onInspect)} rows={p.line_results} rowKey={(l) => l.line_id} rowName={(l) => l.line_id} />
    </section>
  );
}
