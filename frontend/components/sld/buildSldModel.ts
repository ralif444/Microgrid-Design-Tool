// Single-line diagram model (Doc 12 X8, FR-94 – FR-98; SLD guideline §4.3, §5.1, §6, §A6, §A7).
// Pure: Project (+ the current M1 and M2, chosen by the caller with `latestRun`, FR-93) → elements with
// the rows that tooltip, inspector and "View as table" all read. No layout, no store, and no physics:
// values are copied from the Project or a payload and only rounded for display (`num`, R1, R2).
import type { BatteryBank, LimitingConstraint, M1Payload, M2Payload, ProjectSnapshot, ValidationIssue } from "../../api-types";
import { num } from "../format";
import { KIND_WORDS, nearLimit } from "../M2Results";

export type SldKind = "system" | "bus" | "inverter" | "load" | "line";
/** One tooltip line, "label · value unit"; `note` gives the reason for "—" or the check detail. */
export type SldRow = { label: string; value: string; unit?: string; note?: string };
/** `empty` replaces the rows when there is no current run for the section. */
/** "Sizing check" is advisory (Doc 3 §3.9, VISUAL §8), kept apart from the constraint checks. */
export type SldSection = { title: "Design data" | "Results" | "Checks" | "Sizing check" | "Issues"; rows: SldRow[]; empty?: string };
/** S-08 rules (Doc 12 §9 #17): violated `margin < 0`, limiting in `result.limiting_constraints`, near via `nearLimit`;
 * pass: every evaluated constraint of the element satisfied (W3). */
export type SldMark = "violated" | "limiting" | "near" | "pass";

export type SldElement = {
  kind: SldKind;
  id: string;
  name?: string;
  /** Inverter and Load: their Bus. Line: `from` and `to`. */
  busId?: string;
  from?: string;
  to?: string;
  /** Full accessible name (guideline §8). */
  label: string;
  /** Always-visible labels of guideline §5.1, design view first, then M1 values when present. */
  tags: string[];
  sections: SldSection[];
  mark: SldMark | null;
  issues: string[];
  /** Inverter: M1 loading ratio, for the loading bar (W3). */
  loading?: number;
  /** S-08: the element with the smallest normalised margin among element-level constraints (W3). */
  tightest?: boolean;
};

export type SldModel = {
  system: SldElement;
  buses: SldElement[];
  inverters: SldElement[];
  loads: SldElement[];
  lines: SldElement[];
  /** Buses with no Line to another existing Bus (FR-14, guideline R5). */
  isolated: string[];
  /** Sorted ids and endpoints only: a value edit leaves it unchanged, so layout is not re-run (§4.3). */
  topologyKey: string;
};

export type SldInput = {
  design: ProjectSnapshot;
  m1?: M1Payload | null;
  m2?: { payload: M2Payload; limiting: LimitingConstraint[] } | null;
  issues?: ValidationIssue[];
  marginWarn?: number | null;
  banks?: BatteryBank[]; // battery round (D-108): one design-data row, no symbol
};

const NO_M1 = "No current power-flow result";
const NO_M2 = "No current constraint check";

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? null : String(num(v)));
const row = (label: string, v: number | null | undefined, unit: string, missing = "not entered"): SldRow =>
  fmt(v) === null ? { label, value: "—", unit, note: missing } : { label, value: fmt(v)!, unit };
const byId = <T extends { id?: string | null }>(xs: T[] | undefined) =>
  (xs ?? []).filter((x): x is T & { id: string } => !!x.id).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function checks(id: string, m2: SldInput["m2"], marginWarn: number | null, extra: SldRow[] = []): { section: SldSection; mark: SldMark | null } {
  if (!m2) return { section: { title: "Checks", rows: [], empty: NO_M2 }, mark: null };
  const own = m2.payload.constraint_margins.filter((c) => c.element_id === id);
  const rows: SldRow[] = own.map((c) => ({
    label: KIND_WORDS[c.kind] ?? c.kind,
    value: fmt(c.value)!,
    unit: c.unit,
    note: `${c.margin < 0 ? "violated" : nearLimit(c, marginWarn) ? "near limit" : "satisfied"}; limit ${fmt(c.limit)} ${c.unit}, margin ${fmt(c.margin)} ${c.unit}`,
  }));
  for (const n of m2.payload.not_evaluated.filter((x) => x.element_id === id))
    rows.push({ label: KIND_WORDS[n.kind] ?? n.kind, value: "—", note: "not evaluated: no limit set" });
  const mark: SldMark | null = own.some((c) => c.margin < 0)
    ? "violated"
    : m2.limiting.some((c) => c.element_id === id)
      ? "limiting"
      : own.some((c) => nearLimit(c, marginWarn))
        ? "near"
        : own.length
          ? "pass"
          : null;
  return { section: { title: "Checks", rows: [...rows, ...extra] }, mark };
}

// `hasM1` but no row: the element was added after the run, or the payload omits it
const results = (rows: SldRow[] | null | undefined, hasM1: boolean): SldSection =>
  rows ? { title: "Results", rows } : { title: "Results", rows: [], empty: hasM1 ? "Not in this power-flow result" : NO_M1 };

export function buildSldModel({ design, m1 = null, m2 = null, issues = [], marginWarn = null, banks = [] }: SldInput): SldModel {
  const buses = byId(design.buses);
  const busIds = new Set(buses.map((b) => b.id));
  const lines = byId(design.lines);
  const loads = byId(design.loads);
  const inverters = byId(design.inverters);
  const issuesOf = (entity: string, id: string) => {
    const own = issues.filter((i) => i.entity === entity && i.id === id).map((i) => i.message);
    return { list: own, section: own.length ? [{ title: "Issues" as const, rows: own.map((m) => ({ label: "Issue", value: m })) }] : [] };
  };
  const finish = (e: Omit<SldElement, "issues" | "sections">, entity: string, sections: SldSection[]): SldElement => {
    const iss = issuesOf(entity, e.id);
    return { ...e, sections: [...sections, ...iss.section], issues: iss.list };
  };
  const connected = new Set(
    lines.filter((l) => busIds.has(l.from_bus_id ?? "") && busIds.has(l.to_bus_id ?? "") && l.from_bus_id !== l.to_bus_id).flatMap((l) => [l.from_bus_id!, l.to_bus_id!]),
  );

  const m1Bus = new Map(m1?.bus_results.map((b) => [b.bus_id, b]));
  const m1Inv = new Map(m1?.inverter_results.map((i) => [i.inverter_id, i]));
  const m1Line = new Map(m1?.line_results.map((l) => [l.line_id, l]));
  const sizeInv = new Map(m2?.payload.sizing_check.per_inverter.map((s) => [s.inverter_id, s]));
  const sizeLine = new Map(m2?.payload.sizing_check.per_line.map((s) => [s.line_id, s]));

  const sysChecks = checks("SYSTEM", m2, marginWarn, m2 ? [{ label: "Verdict", value: m2.payload.verdict }] : []);
  const system: SldElement = {
    kind: "system",
    id: "SYSTEM",
    label: "System: nominal voltage and frequency",
    tags: [
      `${fmt(design.nominal_voltage_kv) ?? "—"} kV LL`,
      `${fmt(design.nominal_frequency_hz) ?? "—"} Hz nominal`,
      ...(m1 ? [`${fmt(m1.system_frequency_hz)} Hz system`] : []),
    ],
    sections: [
      {
        title: "Design data",
        rows: [row("Nominal voltage (line-to-line)", design.nominal_voltage_kv, "kV"), row("Nominal frequency", design.nominal_frequency_hz, "Hz"), { label: "Network", value: "Balanced 3-phase, islanded" }],
      },
      results(
        m1 && [
          row("System frequency", m1.system_frequency_hz, "Hz"),
          row("Total load, active", m1.total_load_kw, "kW"),
          row("Total load, reactive", m1.total_load_kvar, "kvar"),
          row("Total losses", m1.total_losses_kw, "kW"),
          { ...row("Validity indicator ε_X", m1.epsilon_x_ratio, "ratio"), note: "threshold not yet calibrated" },
        ],
        !!m1,
      ),
      sysChecks.section,
    ],
    mark: sysChecks.mark,
    issues: [],
  };

  const busEls = buses.map((b) => {
    const nInv = inverters.filter((i) => i.bus_id === b.id).length;
    const nLoad = loads.filter((l) => l.bus_id === b.id).length;
    const nLine = lines.filter((l) => l.from_bus_id === b.id || l.to_bus_id === b.id).length;
    const r = m1Bus.get(b.id);
    const c = checks(b.id, m2, marginWarn);
    const alone = !connected.has(b.id);
    return finish(
      {
        kind: "bus",
        id: b.id,
        name: b.name ?? undefined,
        label: `Bus ${b.id}${b.name ? ` (${b.name})` : ""}, ${count(nInv, "inverter")}, ${count(nLoad, "load")}, ${count(nLine, "line")}${alone ? ", not connected" : ""}`,
        tags: [b.id, ...(r ? [`${fmt(r.voltage_pu)} p.u.`, `${fmt(r.angle_deg)} °`] : [])],
        mark: c.mark,
      },
      "Bus",
      [
        {
          title: "Design data",
          rows: [
            ...(b.name ? [{ label: "Name", value: b.name }] : []),
            { label: "Inverters", value: String(nInv), unit: "count" },
            { label: "Loads", value: String(nLoad), unit: "count" },
            { label: "Lines", value: String(nLine), unit: "count" },
          ],
        },
        results(r ? [row("Voltage", r.voltage_kv, "kV"), row("Voltage", r.voltage_pu, "p.u."), row("Angle", r.angle_deg, "deg")] : null, !!m1),
        c.section,
      ],
    );
  });

  const invEls = inverters.map((i) => {
    const r = m1Inv.get(i.id);
    const s = sizeInv.get(i.id);
    const c = checks(i.id, m2, marginWarn);
    const sizing: SldSection[] = s ? [{ title: "Sizing check", rows: [row("Required rating", s.required_rating_kva, "kVA"), row("Headroom", s.headroom_kva, "kVA"), { label: "Rating margin short", value: s.rating_margin_short ? "yes" : "no" }] }] : [];
    const unsetSet = (v: number | null | undefined, label: string, unit: string): SldRow => (fmt(v) === null ? { label, value: "0", unit, note: "not set" } : row(label, v, unit));
    const unsetTau = (v: number | null | undefined, label: string): SldRow => row(label, v, "s", "not set, needed for stability analyses");
    return finish(
      {
        kind: "inverter",
        id: i.id,
        busId: i.bus_id ?? undefined,
        label: `Inverter ${i.id} at bus ${i.bus_id ?? "—"}, rated ${fmt(i.rated_kva) ?? "—"} kVA`,
        tags: [i.id, `${fmt(i.rated_kva) ?? "—"} kVA`, ...(r ? [`${fmt(r.p_kw)} kW`, `loading ${fmt(r.loading_ratio)}`] : [])],
        mark: c.mark,
        ...(r ? { loading: r.loading_ratio } : {}),
      },
      "Inverter",
      [
        {
          title: "Design data",
          rows: [
            { label: "Bus", value: i.bus_id ?? "—", ...(i.bus_id ? {} : { note: "not entered" }) },
            row("Rating", i.rated_kva, "kVA"),
            row("Frequency droop", i.frequency_droop_hz_per_kw, "Hz/kW"),
            row("Voltage droop", i.voltage_droop_kv_per_kvar, "kV/kvar"),
            row("Frequency setpoint", i.frequency_setpoint_hz, "Hz"),
            row("Voltage setpoint", i.voltage_setpoint_kv, "kV"),
            unsetSet(i.p_setpoint_kw, "P setpoint", "kW"),
            unsetSet(i.q_setpoint_kvar, "Q setpoint", "kvar"),
            unsetTau(i.tau_p_s, "τ_P filter"),
            unsetTau(i.tau_q_s, "τ_Q filter"),
            ...(i.catalog_ref ? [{ label: "Catalogue entry", value: i.catalog_ref.entry_id }] : []),
            ...banks
              .filter((b) => b.inverter_id === i.id)
              .map((b) => ({ label: "Battery bank", value: `${b.series_count} × ${b.parallel_count} of ${b.module.catalog_ref.entry_id}` })),
          ],
        },
        results(r ? [row("P", r.p_kw, "kW"), row("Q", r.q_kvar, "kvar"), row("S", r.s_kva, "kVA"), row("Loading", r.loading_ratio, "ratio")] : null, !!m1),
        c.section,
        ...sizing,
      ],
    );
  });

  const loadEls = loads.map((l) => {
    const q: SldRow[] =
      l.q_kvar !== null && l.q_kvar !== undefined
        ? [row("Q", l.q_kvar, "kvar")]
        : l.power_factor !== null && l.power_factor !== undefined
          ? [row("Power factor", l.power_factor, "ratio"), { label: "Direction", value: l.pf_direction ?? "—", ...(l.pf_direction ? {} : { note: "not entered" }) }]
          : [{ label: "Reactive power", value: "—", note: "not entered" }];
    const qTag = l.q_kvar !== null && l.q_kvar !== undefined ? `${fmt(l.q_kvar)} kvar` : l.power_factor !== null && l.power_factor !== undefined ? `pf ${fmt(l.power_factor)} ${l.pf_direction ?? ""}`.trim() : null;
    return finish(
      {
        kind: "load",
        id: l.id,
        busId: l.bus_id ?? undefined,
        label: `Load ${l.id} at bus ${l.bus_id ?? "—"}, ${fmt(l.p_kw) ?? "—"} kW`,
        tags: [l.id, `${fmt(l.p_kw) ?? "—"} kW`, ...(qTag ? [qTag] : [])],
        mark: null,
      },
      "Load",
      [{ title: "Design data", rows: [{ label: "Bus", value: l.bus_id ?? "—", ...(l.bus_id ? {} : { note: "not entered" }) }, row("P", l.p_kw, "kW"), ...q] }],
    );
  });

  const projLimit = design.design_constraints?.line_current_limit_a;
  const lineEls = lines.map((l) => {
    const r = m1Line.get(l.id);
    const s = sizeLine.get(l.id);
    const c = checks(l.id, m2, marginWarn);
    const sizing: SldSection[] = s ? [{ title: "Sizing check", rows: [row("Required current", s.required_current_a, "A")] }] : [];
    const limit: SldRow =
      fmt(l.current_limit_a) !== null
        ? row("Current limit", l.current_limit_a, "A")
        : fmt(projLimit) !== null
          ? { label: "Current limit", value: fmt(projLimit)!, unit: "A", note: "project limit" }
          : { label: "Current limit", value: "—", unit: "A", note: "no limit set" };
    return finish(
      {
        kind: "line",
        id: l.id,
        from: l.from_bus_id ?? undefined,
        to: l.to_bus_id ?? undefined,
        label: `Line ${l.id} from ${l.from_bus_id ?? "—"} to ${l.to_bus_id ?? "—"}`,
        tags: [l.id, ...(r ? [`${fmt(r.current_a)} A`] : [])],
        mark: c.mark,
      },
      "Line",
      [
        {
          title: "Design data",
          rows: [
            { label: "From → to", value: `${l.from_bus_id ?? "—"} → ${l.to_bus_id ?? "—"}` },
            row("r", l.r_ohm_per_km, "Ω/km"),
            row("x", l.x_ohm_per_km, "Ω/km"),
            row("Length", l.length_km, "km"),
            // server-derived (Doc 3 §3.3): only when the server has written them
            ...(fmt(l.r_ohm) !== null ? [row("R (server)", l.r_ohm, "Ω")] : []),
            ...(fmt(l.x_ohm) !== null ? [row("X (server)", l.x_ohm, "Ω")] : []),
            limit,
          ],
        },
        results(
          r
            ? [row("P from", r.p_from_kw, "kW"), row("Q from", r.q_from_kvar, "kvar"), row("P to", r.p_to_kw, "kW"), row("Q to", r.q_to_kvar, "kvar"), row("Current", r.current_a, "A"), row("Losses", r.losses_kw, "kW")]
            : null,
          !!m1,
        ),
        c.section,
        ...sizing,
      ],
    );
  });

  // W3: smallest element-level normalised margin (the system frequency has no element to mark)
  const tight = m2?.payload.constraint_margins.filter((c) => c.element_id !== "SYSTEM").reduce<LimitingConstraint | null>((a, c) => (a === null || c.normalised_margin < a.normalised_margin ? c : a), null);
  for (const e of [...busEls, ...invEls, ...lineEls]) if (e.id === tight?.element_id) e.tightest = true;

  const topologyKey = JSON.stringify([
    buses.map((b) => b.id),
    lines.map((l) => [l.id, l.from_bus_id, l.to_bus_id]),
    inverters.map((i) => [i.id, i.bus_id]),
    loads.map((l) => [l.id, l.bus_id]),
  ]);
  return { system, buses: busEls, inverters: invEls, loads: loadEls, lines: lineEls, isolated: buses.filter((b) => !connected.has(b.id)).map((b) => b.id), topologyKey };
}
