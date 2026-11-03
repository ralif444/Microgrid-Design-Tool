"use client";
// Data table (Doc 7 P3, §6.3, §8): unit in the column header, text left and numbers right with
// tabular figures, editable cells (Enter moves down, Escape restores the value the cell had on
// focus), inline row errors under the row. Presentational: callers own the data and dispatch.
// Each row and its error line share one <tbody>, so a row's test id covers its messages too.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./DataTable.module.css";
import { num } from "./format";
import { Icon } from "./Icon";

type Edit<R> =
  | { kind: "number"; value: (r: R) => number | null | undefined; onChange: (r: R, v: number | null) => void }
  | { kind: "text"; value: (r: R) => string | null | undefined; onChange: (r: R, v: string) => void }
  | { kind: "select"; options: string[]; value: (r: R) => string | null | undefined; onChange: (r: R, v: string | null) => void };

export type DataColumn<R> = {
  key: string;
  header: string;
  unit?: string;
  numeric?: boolean; // right-aligned, tabular figures, numbers shown to 6 significant digits
  fields?: string[]; // issue fields shown under this column's header (default: [key])
  labelCell?: boolean; // read-only cell named "<header> of <row>" for assistive tech and tests
  cell?: (r: R) => ReactNode;
  edit?: Edit<R>;
};

export type RowError = { field?: string | null; message: string };

export const headerText = (c: { header: string; unit?: string }) => (c.unit ? `${c.header} (${c.unit})` : c.header);

function show(v: ReactNode): ReactNode {
  return typeof v === "number" ? num(v) : v === null || v === undefined ? "—" : v;
}

// Enter: same column, next row. Escape: restore the value the cell had on focus.
function keys(e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, restore: () => void) {
  if (e.key === "Escape") {
    e.preventDefault();
    restore();
    return;
  }
  if (e.key !== "Enter" || e.currentTarget.tagName === "SELECT") return;
  e.preventDefault();
  const td = e.currentTarget.closest("td");
  const tr = td?.parentElement;
  if (!td || !tr) return;
  const col = Array.prototype.indexOf.call(tr.children, td);
  const next = tr.parentElement?.nextElementSibling?.firstElementChild;
  next?.children[col]?.querySelector<HTMLElement>("input:not([type=radio]), select")?.focus();
}

// Editable input for cells; also usable inside a custom `cell` renderer.
export function CellInput<V extends string | number | null>({
  label,
  kind,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  kind: "number" | "text";
  value: V | undefined;
  onChange: (v: V) => void;
  invalid?: boolean;
}) {
  const start = useRef<V | undefined>(undefined);
  const parse = (s: string, n: number) => (kind === "text" ? s : s === "" ? null : n) as V;
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      type={kind}
      step={kind === "number" ? "any" : undefined}
      value={value ?? ""}
      onFocus={() => (start.current = value)}
      onChange={(e) => onChange(parse(e.target.value, e.target.valueAsNumber))}
      onKeyDown={(e) => keys(e, () => onChange((start.current ?? (kind === "text" ? "" : null)) as V))}
    />
  );
}

export function CellSelect({
  label,
  options,
  value,
  onChange,
  invalid = false,
}: {
  label: string;
  options: [string, string][]; // value, text
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  invalid?: boolean;
}) {
  const start = useRef<string | null>(null);
  return (
    <select
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value ?? ""}
      onFocus={() => (start.current = value ?? null)}
      onChange={(e) => onChange(e.target.value || null)}
      onKeyDown={(e) => keys(e, () => onChange(start.current))}
    >
      <option value="">(choose)</option>
      {options.map(([v, t]) => (
        <option key={v} value={v}>
          {t}
        </option>
      ))}
    </select>
  );
}

function EditCell<R>({ row, edit, name, invalid }: { row: R; edit: Edit<R>; name: string; invalid: boolean }) {
  if (edit.kind === "select")
    return (
      <CellSelect label={name} options={edit.options.map((o) => [o, o])} value={edit.value(row)} onChange={(v) => edit.onChange(row, v)} invalid={invalid} />
    );
  if (edit.kind === "number")
    return <CellInput label={name} kind="number" value={edit.value(row) ?? null} onChange={(v: number | null) => edit.onChange(row, v)} invalid={invalid} />;
  return <CellInput label={name} kind="text" value={edit.value(row) ?? ""} onChange={(v: string) => edit.onChange(row, v)} invalid={invalid} />;
}

export function DataTable<R>({
  label,
  caption,
  columns,
  rows,
  rowKey,
  rowName,
  rowErrors,
  actions,
  rowTestId,
  rowCurrent,
  rowViolated,
  empty,
}: {
  label: string;
  caption?: string;
  columns: DataColumn<R>[];
  rows: R[];
  rowKey: (r: R, k: number) => string | number;
  rowName: (r: R, k: number) => string; // "of <id>" part of each editable cell's accessible name
  rowErrors?: (r: R) => RowError[];
  actions?: (r: R, k: number) => ReactNode;
  rowTestId?: (r: R, k: number) => string;
  rowCurrent?: (r: R) => boolean; // highlighted row (opened from a link), aria-current
  rowViolated?: (r: R) => boolean; // violated constraint row: orange left edge (guideline §7.3)
  empty?: ReactNode;
}) {
  if (!rows.length && empty) return <>{empty}</>;
  const span = columns.length + (actions ? 1 : 0);
  const owner = (field: string | null | undefined) => columns.find((c) => (c.fields ?? [c.key]).includes(field ?? ""));
  return (
    <div className={`table-scroll ${styles.scroll}`} role="region" aria-label={`${label}, scrolls sideways`} tabIndex={0}>
      <table aria-label={label} className={styles.table}>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "num" : undefined}>
                {c.header}
                {c.unit && <span className={styles.unit}> ({c.unit})</span>}
              </th>
            ))}
            {actions && (
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        {rows.map((r, k) => {
          const errors = rowErrors?.(r) ?? [];
          return (
            <tbody key={rowKey(r, k)} data-testid={rowTestId?.(r, k)} className={styles.row} data-invalid={errors.length ? "true" : undefined} data-violated={rowViolated?.(r) ? "true" : undefined}>
              <tr aria-current={rowCurrent?.(r) ? "true" : undefined} className={rowCurrent?.(r) ? styles.current : undefined}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.numeric ? "num" : undefined}
                    aria-label={c.labelCell ? `${headerText(c)} of ${rowName(r, k)}` : undefined}
                  >
                    {c.edit ? (
                      <EditCell row={r} edit={c.edit} name={`${headerText(c)} of ${rowName(r, k)}`} invalid={errors.some((x) => owner(x.field) === c)} />
                    ) : (
                      show(c.cell?.(r))
                    )}
                  </td>
                ))}
                {actions && <td className={styles.actions}>{actions(r, k)}</td>}
              </tr>
              {errors.length > 0 && (
                <tr className={styles.errorRow}>
                  <td colSpan={span} role="alert">
                    <Icon name="alert" size={16} />
                    {errors
                      .map((x) => {
                        const col = owner(x.field);
                        return `${col ? `${col.header}: ` : x.field ? `${x.field}: ` : ""}${x.message}`;
                      })
                      .join(" ")}
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
