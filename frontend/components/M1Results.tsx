// M1 payload with units (FR-23, NFR-05): the groups of Doc 3 §6.2 including ε_X. Placeholder
// values come from the Fake Engine. Power sharing per Doc 12 P9 (FR-81): advisory, not a constraint.
// With `charts` (S-07, Doc 12 X3 FR-88) each table gets its chart; reference lines only for limits
// the user set on S-06, otherwise the caption says the limit is not evaluated.
import type { DesignConstraints, M1Payload, M2Payload, ProjectSnapshot, RunRecord } from "../api-types";
import { AdvisoryPanel } from "./AdvisoryPanel";
import { BarChart, type RefLine } from "./charts/BarChart";
import { DataTable, type DataColumn } from "./DataTable";
import { fixed, fixedOr } from "./format";
import { Icon } from "./Icon";
import { useLanguage } from "./Language";
import { displayLang, translate } from "./i18n";
import type { ElementRef } from "./Inspector";
import { ElementLink, marginStatus, type MarginStatus, STATUS_WORD, useMarginWarn } from "./M2Results";
import m2Styles from "./M2Results.module.css";

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
const unset = (refs: RefLine[], what: string) => (refs.length ? undefined : translate(displayLang(), "No {what} set: not evaluated.", { what: translate(displayLang(), what) }));

// `voltage: false`: the report keeps its own bus-voltage chart, so the profile is not drawn twice.
export type M1Charts = { limits: DesignConstraints | null | undefined; record: RunRecord; voltage?: false };
type OnInspect = ((t: ElementRef) => void) | undefined;

// The id cell selects the element: in the Inspector when `on` is given (FR-90), else via the workspace (audit D-18).
const inspectable = <R,>(cols: DataColumn<R>[], kind: ElementRef["kind"], get: (r: R) => string, on: OnInspect): DataColumn<R>[] =>
  cols.map((c) => (c.key === "id" ? { ...c, cell: (r) => <ElementLink target={{ kind, id: get(r) }} onInspect={on} /> } : c));

/** Limit and status beside the results (audit D-7): limits from the Project, status from the current M2 only. */
export type M1Check = { design: ProjectSnapshot; m2: M2Payload | null };
const ORDER: MarginStatus[] = ["violated", "near", "pass"];
export function statusCell(id: string, kinds: string[], m2: M2Payload | null, marginWarn: number | null) {
  const t = (s: string) => translate(displayLang(), s);
  if (!m2) return t("Run the constraint check");
  const own = m2.constraint_margins.filter((c) => c.element_id === id && kinds.includes(c.kind));
  if (!own.length) return m2.not_evaluated.some((n) => n.element_id === id && kinds.includes(n.kind)) ? t("Not evaluated") : "—";
  if (marginWarn === null && own.every((c) => c.margin >= 0)) return t("Checking");
  const s = ORDER.find((k) => own.some((c) => marginStatus(c, marginWarn) === k)) ?? "pass";
  return (
    <span className={m2Styles.status} data-s={s}>
      <Icon name={STATUS_WORD[s].icon} size={16} />
      {t(STATUS_WORD[s].word)}
    </span>
  );
}
const lineLimit = (d: ProjectSnapshot | undefined, limits: DesignConstraints, id: string) =>
  d?.lines?.find((l) => l.id === id)?.current_limit_a ?? limits.line_current_limit_a ?? null;

export function M1Results({ p, charts, onInspect, check }: { p: M1Payload; charts?: M1Charts; onInspect?: OnInspect; check?: M1Check }) {
  const c = check?.design.design_constraints ?? charts?.limits ?? {};
  const marginWarn = useMarginWarn();
  const { t } = useLanguage();
  const tc = <R,>(cols: DataColumn<R>[]): DataColumn<R>[] => cols.map((c) => ({ ...c, header: t(c.header) }));
  const withCheck = <R,>(cols: DataColumn<R>[], limit: DataColumn<R>, id: (r: R) => string, kinds: string[]): DataColumn<R>[] =>
    check ? [...tc(cols), { ...limit, header: t(limit.header) }, { key: "status", header: t("Status"), cell: (r) => statusCell(id(r), kinds, check.m2, marginWarn) }] : tc(cols);
  const notSet = t("not set");
  const busCols = withCheck(
    inspectable(BUSES, "bus", (b) => b.bus_id, onInspect),
    { key: "lim", header: "Limits", unit: "p.u.", cell: () => `${fixedOr(c.voltage_min_pu, "p.u.", notSet)} – ${fixedOr(c.voltage_max_pu, "p.u.", notSet)}` },
    (b) => b.bus_id,
    ["BUS_VOLTAGE_MIN", "BUS_VOLTAGE_MAX"],
  );
  const invCols = withCheck(
    inspectable(INVERTERS, "inverter", (i) => i.inverter_id, onInspect),
    { key: "lim", header: "Loading limit", unit: "ratio", numeric: true, cell: () => fixedOr(c.inverter_loading_limit_ratio, "ratio", notSet) },
    (i) => i.inverter_id,
    ["INVERTER_LOADING"],
  );
  const lineCols = withCheck(
    inspectable(LINES, "line", (l) => l.line_id, onInspect),
    { key: "lim", header: "Current limit", unit: "A", numeric: true, cell: (l) => fixedOr(lineLimit(check?.design, c, l.line_id), "A", notSet) },
    (l) => l.line_id,
    ["LINE_CURRENT"],
  );
  const sharingCols = tc(SHARING).map((x) => (x.key === "qv" ? { ...x, cell: (s: Share) => t(s.q_droop_not_rating_proportional ? "yes" : "no") } : x));
  const lineLimits = p.line_results.map((l) => lineLimit(check?.design, c, l.line_id));
  const vRefs = [...ref(c.voltage_min_pu, t("min {v} p.u.", { v: c.voltage_min_pu ?? "" })), ...ref(c.voltage_max_pu, t("max {v} p.u.", { v: c.voltage_max_pu ?? "" }))];
  const iRefs = ref(c.inverter_loading_limit_ratio, t("limit {v}", { v: c.inverter_loading_limit_ratio ?? "" }));
  const totals: Total[] = [
    [t("System frequency"), p.system_frequency_hz, "Hz"],
    [t("Total load, active"), p.total_load_kw, "kW"],
    [t("Total load, reactive"), p.total_load_kvar, "kvar"],
    [t("Total losses"), p.total_losses_kw, "kW"],
    [t("Iterations"), p.iterations, "count"],
    [t("Validity indicator ε_X"), p.epsilon_x_ratio, "ratio"],
  ];
  return (
    <section aria-label={t("Power flow results")}>
      <DataTable label={t("System totals")} caption={t("System")} columns={tc(TOTALS)} rows={totals} rowKey={(t) => t[0]} rowName={(t) => t[0]} />
      {charts && charts.voltage !== false && (
        <BarChart
          title={t("Bus voltage profile")}
          valueTitle={t("Bus voltage (p.u.)")}
          categoryTitle={t("Bus")}
          categories={p.bus_results.map((b) => b.bus_id)}
          series={[{ name: t("Voltage"), values: p.bus_results.map((b) => b.voltage_pu) }]}
          refs={vRefs}
          note={unset(vRefs, "voltage limit")}
          record={charts.record}
          dots
        />
      )}
      <DataTable label={t("Bus voltages")} caption={t("Bus voltages")} columns={busCols} rows={p.bus_results} rowKey={(b) => b.bus_id} rowName={(b) => b.bus_id} />
      <DataTable
        label={t("Inverter outputs")}
        caption={t("Inverter outputs")}
        columns={invCols}
        rows={p.inverter_results}
        rowKey={(i) => i.inverter_id}
        rowName={(i) => i.inverter_id}
      />
      {charts && (
        <BarChart
          title={t("Inverter loading")}
          valueTitle={t("Inverter loading (ratio)")}
          categoryTitle={t("Inverter")}
          categories={p.inverter_results.map((i) => i.inverter_id)}
          series={[{ name: t("Loading"), values: p.inverter_results.map((i) => i.loading_ratio) }]}
          refs={iRefs}
          note={unset(iRefs, "inverter loading limit")}
          record={charts.record}
        />
      )}
      <AdvisoryPanel label={t("Power sharing advice")} title={t("Power sharing against rating-proportional sharing (advisory, not a constraint)")}>
        {charts && (
          <BarChart
            title={t("Inverter output, P and Q")}
            valueTitle={t("P (kW) and Q (kvar)")}
            categoryTitle={t("Inverter")}
            categories={p.inverter_results.map((i) => i.inverter_id)}
            series={[
              { name: "P (kW)", values: p.inverter_results.map((i) => i.p_kw) },
              { name: "Q (kvar)", values: p.inverter_results.map((i) => i.q_kvar) },
            ]}
            note={t("Deviations from rating-proportional sharing are in the table below.")}
            record={charts.record}
          />
        )}
        <DataTable label={t("Power sharing")} columns={sharingCols} rows={p.sharing} rowKey={(s) => s.inverter_id} rowName={(s) => s.inverter_id} />
      </AdvisoryPanel>
      {charts && (
        <BarChart
          title={t("Line loading")}
          valueTitle={t("Line current (A)")}
          categoryTitle={t("Line")}
          categories={p.line_results.map((l) => l.line_id)}
          series={[{ name: t("Current"), values: p.line_results.map((l) => l.current_a) }]}
          limits={lineLimits}
          note={lineLimits.some((v) => v !== null) ? t("Tick: each line's own current limit (the line's limit, else the Project limit).") : t("No line current limit set: not evaluated.")}
          record={charts.record}
        />
      )}
      <DataTable label={t("Line flows")} caption={t("Line flows")} columns={lineCols} rows={p.line_results} rowKey={(l) => l.line_id} rowName={(l) => l.line_id} />
    </section>
  );
}
