// M2 result parts (Doc 7 §5.1, §6.4): limiting constraints / margins, "not evaluated" list,
// loadability, SizingCheck in an advisory panel separate from SizingAdvice (FR-25, FR-16, FR-24, FR-27).
// With `charts` (S-08 and the S-16 report, Doc 12 X3 FR-88): the loadability axis (the margin chart went, audit §8).
import Link from "next/link";
import { useEffect, useState } from "react";
import { getMeta } from "../api-client";
import type { LimitingConstraint, M2Payload, RunRecord } from "../api-types";
import { AdvisoryPanel } from "./AdvisoryPanel";
import { LoadabilityAxis } from "./charts/LoadabilityAxis";
import { DataTable, type DataColumn } from "./DataTable";
import { fixed, fixedOr } from "./format";
import { Icon, type IconName } from "./Icon";
import { useLanguage } from "./Language";
import type { ElementRef } from "./elementFields";
import { displayLang, translate } from "./i18n";
import styles from "./M2Results.module.css";

// FR-26: a satisfied constraint with normalised margin below MARGIN_WARN (Eq. 4.18) is near its limit.
export const nearLimit = (c: LimitingConstraint, marginWarn: number | null) =>
  marginWarn !== null && c.margin >= 0 && c.normalised_margin < marginWarn;

// Row status of the margins table, the status strip and the diagram (ADR-016, W3); icon + word, never colour alone.
export type MarginStatus = "violated" | "near" | "pass";
export const marginStatus = (c: LimitingConstraint, marginWarn: number | null): MarginStatus =>
  c.margin < 0 ? "violated" : nearLimit(c, marginWarn) ? "near" : "pass";
export const STATUS_WORD: Record<MarginStatus, { icon: IconName; word: string }> = {
  violated: { icon: "misuse", word: "Violated" },
  near: { icon: "warn", word: "Near limit" },
  pass: { icon: "check", word: "Pass" },
};

/** MARGIN_WARN from /api/meta (FR-26), or null until it arrives. */
export function useMarginWarn(): number | null {
  const [marginWarn, setMarginWarn] = useState<number | null>(null);
  useEffect(() => {
    void getMeta().then((m) => m.ok && setMarginWarn(m.data.limits.margin_warn));
  }, []);
  return marginWarn;
}

export const KIND_WORDS: Record<string, string> = {
  BUS_VOLTAGE_MIN: "Bus voltage, lower limit",
  BUS_VOLTAGE_MAX: "Bus voltage, upper limit",
  FREQUENCY_MIN: "Frequency, lower limit",
  FREQUENCY_MAX: "Frequency, upper limit",
  INVERTER_LOADING: "Inverter loading",
  LINE_CURRENT: "Line current",
  POWER_BALANCE: "Power balance",
};

// Element of a constraint, for the inspector; null for system-wide checks.
const KIND_ELEMENT: Record<string, ElementRef["kind"]> = { BUS_VOLTAGE_MIN: "bus", BUS_VOLTAGE_MAX: "bus", INVERTER_LOADING: "inverter", LINE_CURRENT: "line" };
// Model area: the inspector there edits the element, the usual next step after a check (audit D-18).
export const workspaceHref = (t: ElementRef) => `/workspace/?el=${t.kind}:${encodeURIComponent(t.id)}`;

/** An element id that selects it: in the inspector when `onInspect` is given, else via the workspace. */
export function ElementLink({ target, onInspect }: { target: ElementRef; onInspect?: (t: ElementRef) => void }) {
  const { t } = useLanguage();
  return onInspect ? (
    <button type="button" className="inspect" aria-label={t("Inspect {id}", { id: target.id })} onClick={() => onInspect(target)}>
      {target.id}
    </button>
  ) : (
    <Link href={workspaceHref(target)}>{target.id}</Link>
  );
}

const fmt = (v: number | null | undefined) => fixedOr(v, "ratio", translate(displayLang(), "not available")); // loadability values are ratios

// A number with its unit in a fixed-width slot, so values and units each share an edge (mockup phase 3).
const withUnit = (text: string, unit: string) => (
  <>
    {text}
    <span className={styles.unit}>{unit}</span>
  </>
);

// `shortcut`: per-row link to M3a pre-filled for that constraint (Doc 12 FR-84), on S-08 only.
// Rows tightest first (normalised margin); sorting only, the margins are the engine's (guideline §1 rule 1).
// `note`: the near-limit threshold under the table (off inside a table cell); `onInspect`: workspace selection.
export function ConstraintTable({
  label,
  rows,
  shortcut = false,
  note = true,
  onInspect,
}: {
  label: string;
  rows: LimitingConstraint[];
  shortcut?: boolean;
  note?: boolean;
  onInspect?: (t: ElementRef) => void;
}) {
  const marginWarn = useMarginWarn();
  const { t } = useLanguage();
  const sorted = [...rows].sort((a, b) => a.normalised_margin - b.normalised_margin);
  const columns: DataColumn<LimitingConstraint>[] = [
    { key: "kind", header: t("Constraint"), cell: (c) => t(KIND_WORDS[c.kind] ?? c.kind) },
    {
      key: "element",
      header: t("Element"),
      cell: (c) => {
        const kind = KIND_ELEMENT[c.kind];
        return kind ? <ElementLink target={{ kind, id: c.element_id }} onInspect={onInspect} /> : c.element_id;
      },
    },
    { key: "value", header: t("Value"), numeric: true, cell: (c) => withUnit(fixed(c.value, c.unit), c.unit) },
    { key: "limit", header: t("Limit"), numeric: true, cell: (c) => withUnit(fixed(c.limit, c.unit), c.unit) },
    {
      key: "margin",
      header: t("Margin"),
      term: "margin",
      numeric: true,
      cell: (c) => (c.margin < 0 ? withUnit(t("Violated by {v}", { v: fixed(-c.margin, c.unit) }), c.unit) : withUnit(fixed(c.margin, c.unit), c.unit)),
    },
    {
      key: "normalised",
      header: t("Normalised margin"),
      term: "nmargin",
      numeric: true,
      // bar: normalised margin clamped to 0–1, longer = more room; a violated row has an empty bar
      cell: (c) => (
        <span className={styles.nm}>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} data-s={marginStatus(c, marginWarn)} style={{ width: `${Math.min(1, Math.max(0, c.normalised_margin)) * 100}%` }} />
          </span>
          {fixed(c.normalised_margin, "ratio")}
        </span>
      ),
    },
    {
      key: "status",
      header: t("Status"),
      cell: (c) => {
        // O-5: without MARGIN_WARN a satisfied row cannot yet be told from a near-limit one
        if (marginWarn === null && c.margin >= 0) return <span className={styles.status}>{t("Checking")}</span>;
        const s = marginStatus(c, marginWarn);
        return (
          <span className={styles.status} data-s={s}>
            <Icon name={STATUS_WORD[s].icon} size={16} />
            {t(STATUS_WORD[s].word)}
          </span>
        );
      },
    },
  ];
  if (shortcut)
    columns.push({
      key: "next",
      header: t("Next step"),
      cell: (c) =>
        c.kind !== "POWER_BALANCE" && (
          <Link href={`/sensitivity/?kind=${encodeURIComponent(c.kind)}&element=${encodeURIComponent(c.element_id)}`}>
            {t("Most influential parameters for {id}", { id: c.element_id })}
          </Link>
        ),
    });
  return (
    <>
      <DataTable label={t(label)} caption={t(label)} columns={columns} rows={sorted} rowKey={(_, k) => k} rowName={(c) => c.element_id} rowViolated={(c) => c.margin < 0} />
      {note && marginWarn !== null && <p className={styles.basis}>{t("Near limit: a satisfied constraint with normalised margin below {v} (Eq. 4.18).", { v: fixed(marginWarn, "ratio") })}</p>}
    </>
  );
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

export function M2Results({ p, charts, onInspect }: { p: M2Payload; charts?: { record: RunRecord }; onInspect?: (t: ElementRef) => void }) {
  const { t } = useLanguage();
  const tc = <R,>(cols: DataColumn<R>[]): DataColumn<R>[] => cols.map((c) => ({ ...c, header: t(c.header) }));
  const invCols = tc(INV_SIZING).map((c) => (c.key === "short" ? { ...c, cell: (i: InvSize) => t(i.rating_margin_short ? "yes" : "no") } : c));
  const l = p.loadability;
  const s = p.sizing_check;
  return (
    <section aria-label={t("Constraint check results")}>
      {p.constraint_margins.length > 0 && <ConstraintTable label="All evaluated margins" rows={p.constraint_margins} onInspect={onInspect} />}
      {/* audit §8: no bar chart of the margins; the table's inline bars carry the same numbers */}
      <h2>{t("Not evaluated")}</h2>
      {p.not_evaluated.length === 0 ? (
        <p className="all-clear">
          <Icon name="feasible" />
          {t("Every check had a limit.")}
        </p>
      ) : (
        <div className={`problems ${styles.notEvaluated}`}>
          <Icon name="info" size={20} />
          <ul aria-label={t("Not evaluated")}>
            {p.not_evaluated.map((n, k) => (
              <li key={k}>
                {t("{kind}, {id}: no limit given; not counted as satisfied.", { kind: t(KIND_WORDS[n.kind] ?? n.kind), id: n.element_id })}
              </li>
            ))}
          </ul>
        </div>
      )}
      <h2>{t("Loadability")}</h2>
      <dl className={styles.loadability}>
        <dt>{t("λ_c (constraint loadability, ratio)")}</dt>
        <dd>{fmt(l.lambda_c)}</dd>
        <dt>
          λ_s (ratio) <span className={styles.qualifier}>{t("solution existence, not a stability limit")}</span>
        </dt>
        <dd>{fmt(l.lambda_s)}</dd>
        <dt>{t("Resolution (ratio)")}</dt>
        <dd>{fmt(l.resolution)}</dd>
        <dt>{t("Grid step (ratio)")}</dt>
        <dd>{fmt(l.grid_step)}</dd>
        <dt>{t("Stop reason")}</dt>
        <dd className={styles.text}>{l.stop_reason ?? t("none")}</dd>
      </dl>
      {charts && <LoadabilityAxis l={l} record={charts.record} />}
      <AdvisoryPanel label={t("Sizing check")} tag={t("Sizing check, from the network")} title={t("Sizing check (advisory, from the network)")}>
        <DataTable label={t("Inverter ratings")} columns={invCols} rows={s.per_inverter} rowKey={(i) => i.inverter_id} rowName={(i) => i.inverter_id} />
        <DataTable label={t("Line currents")} columns={tc(LINE_SIZING)} rows={s.per_line} rowKey={(x) => x.line_id} rowName={(x) => x.line_id} />
        <p className={styles.basis}>
          {s.storage ? `${t("Storage energy: AC {e} kWh (stage {stage}).", { e: fixed(s.storage.e_ac_kwh, "kWh"), stage: s.storage.stage })} ` : `${t("No storage check.")} `}
          {s.basis} {s.assumptions.join(" ")}
        </p>
      </AdvisoryPanel>
    </section>
  );
}
