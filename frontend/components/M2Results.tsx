// M2 result parts (Doc 7 §5.1, §6.4): limiting constraints / margins, "not evaluated" list,
// loadability, SizingCheck in an advisory panel separate from SizingAdvice (FR-25, FR-16, FR-24, FR-27).
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta } from "../api-client";
import type { LimitingConstraint, M2Payload } from "../api-types";
import { AdvisoryPanel } from "./AdvisoryPanel";
import { DataTable, type DataColumn } from "./DataTable";
import { num } from "./format";
import { Icon } from "./Icon";
import styles from "./M2Results.module.css";

// FR-26: a satisfied constraint with normalised margin below MARGIN_WARN (Eq. 4.18) is near its limit.
export const nearLimit = (c: LimitingConstraint, marginWarn: number | null) =>
  marginWarn !== null && c.margin >= 0 && c.normalised_margin < marginWarn;

export const KIND_WORDS: Record<string, string> = {
  BUS_VOLTAGE_MIN: "Bus voltage, lower limit",
  BUS_VOLTAGE_MAX: "Bus voltage, upper limit",
  FREQUENCY_MIN: "Frequency, lower limit",
  FREQUENCY_MAX: "Frequency, upper limit",
  INVERTER_LOADING: "Inverter loading",
  LINE_CURRENT: "Line current",
  POWER_BALANCE: "Power balance",
};

const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "not available" : String(num(v)));

// `shortcut`: per-row link to M3a pre-filled for that constraint (Doc 12 FR-84), on S-08 only.
export function ConstraintTable({ label, rows, shortcut = false }: { label: string; rows: LimitingConstraint[]; shortcut?: boolean }) {
  const [marginWarn, setMarginWarn] = useState<number | null>(null);
  useEffect(() => {
    void getMeta().then((m) => m.ok && setMarginWarn(m.data.limits.margin_warn));
  }, []);
  // rows mix units (p.u., Hz, A, ratio), so the unit is its own column
  const columns: DataColumn<LimitingConstraint>[] = [
    { key: "kind", header: "Constraint", cell: (c) => KIND_WORDS[c.kind] ?? c.kind },
    {
      key: "element",
      header: "Element",
      // D-48 K22: open the element's row in S-05
      cell: (c) => (c.element_id === "SYSTEM" ? c.element_id : <Link href={`/network/?focus=${encodeURIComponent(c.element_id)}`}>{c.element_id}</Link>),
    },
    { key: "value", header: "Value", numeric: true, cell: (c) => c.value },
    { key: "limit", header: "Limit", numeric: true, cell: (c) => c.limit },
    { key: "unit", header: "Unit", cell: (c) => c.unit },
    {
      key: "margin",
      header: "Margin",
      numeric: true,
      cell: (c) =>
        c.margin < 0 ? (
          <span className={styles.violated}>
            <Icon name="cross" size={14} />
            Violated by {num(-c.margin)} {c.unit}
          </span>
        ) : (
          <>
            {num(c.margin)} {c.unit}
            {nearLimit(c, marginWarn) && (
              <strong className="near-limit">
                {" "}
                <Icon name="warn" size={12} /> Near limit
              </strong>
            )}
          </>
        ),
    },
  ];
  if (shortcut)
    columns.push({
      key: "next",
      header: "Next step",
      cell: (c) =>
        c.kind !== "POWER_BALANCE" && (
          <Link href={`/sensitivity/?kind=${encodeURIComponent(c.kind)}&element=${encodeURIComponent(c.element_id)}`}>
            Most influential parameters for {c.element_id}
          </Link>
        ),
    });
  return <DataTable label={label} caption={label} columns={columns} rows={rows} rowKey={(_, k) => k} rowName={(c) => c.element_id} />;
}

type InvSize = M2Payload["sizing_check"]["per_inverter"][number];
type LineSize = M2Payload["sizing_check"]["per_line"][number];

const INV_SIZING: DataColumn<InvSize>[] = [
  { key: "id", header: "Inverter", cell: (i) => <strong>{i.inverter_id}</strong> },
  { key: "s", header: "S", unit: "kVA", numeric: true, cell: (i) => i.s_kva },
  { key: "req", header: "Required rating", unit: "kVA", numeric: true, cell: (i) => i.required_rating_kva },
  { key: "head", header: "Headroom", unit: "kVA", numeric: true, cell: (i) => i.headroom_kva },
  { key: "short", header: "Rating margin short", cell: (i) => (i.rating_margin_short ? "yes" : "no") },
];
const LINE_SIZING: DataColumn<LineSize>[] = [
  { key: "id", header: "Line", cell: (l) => <strong>{l.line_id}</strong> },
  { key: "i", header: "Current", unit: "A", numeric: true, cell: (l) => l.current_a },
  { key: "req", header: "Required current", unit: "A", numeric: true, cell: (l) => l.required_current_a },
];

export function M2Results({ p }: { p: M2Payload }) {
  const l = p.loadability;
  const s = p.sizing_check;
  return (
    <section aria-label="Constraint check results">
      {p.constraint_margins.length > 0 && <ConstraintTable label="All evaluated margins" rows={p.constraint_margins} />}
      <h2>Not evaluated</h2>
      {p.not_evaluated.length === 0 ? (
        <p className={styles.ok}>
          <Icon name="check" />
          Every check had a limit.
        </p>
      ) : (
        <ul aria-label="Not evaluated" className={styles.notEvaluated}>
          {p.not_evaluated.map((n, k) => (
            <li key={k}>
              {KIND_WORDS[n.kind] ?? n.kind}, {n.element_id}: no limit given; not counted as satisfied.
            </li>
          ))}
        </ul>
      )}
      <h2>Loadability</h2>
      <dl className={styles.loadability}>
        <dt>λ_c (constraint loadability, ratio)</dt>
        <dd>{fmt(l.lambda_c)}</dd>
        <dt>
          λ_s (ratio) <span className={styles.qualifier}>solution existence, not a stability limit</span>
        </dt>
        <dd>{fmt(l.lambda_s)}</dd>
        <dt>Resolution (ratio)</dt>
        <dd>{fmt(l.resolution)}</dd>
        <dt>Grid step (ratio)</dt>
        <dd>{fmt(l.grid_step)}</dd>
        <dt>Stop reason</dt>
        <dd className={styles.text}>{l.stop_reason ?? "none"}</dd>
      </dl>
      <AdvisoryPanel label="Sizing check" title="Sizing check (advisory, from the network)">
        <DataTable label="Inverter ratings" columns={INV_SIZING} rows={s.per_inverter} rowKey={(i) => i.inverter_id} rowName={(i) => i.inverter_id} />
        <DataTable label="Line currents" columns={LINE_SIZING} rows={s.per_line} rowKey={(x) => x.line_id} rowName={(x) => x.line_id} />
        <p className={styles.basis}>
          {s.storage ? `Storage energy: AC ${num(s.storage.e_ac_kwh)} kWh (stage ${s.storage.stage}). ` : "No storage check. "}
          {s.basis} {s.assumptions.join(" ")}
        </p>
      </AdvisoryPanel>
    </section>
  );
}
