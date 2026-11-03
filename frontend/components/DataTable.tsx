"use client";
// Data table (Doc 7 P3, §6.3, §8): unit in the column header, text left and numbers right with
// tabular figures, editable cells (Enter moves down, Escape restores the value the cell had on
// focus), inline row errors under the row. Presentational: callers own the data and dispatch.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import styles from "./DataTable.module.css";
import { num } from "./format";
import { Icon } from "./Icon";

type Value = string | number | null | undefined;
type Edit<R> =
  | { kind: "number"; value: (r: R) => number | null | undefined; onChange: (r: R, v: number | null) => void }
  | { kind: "text"; value: (r: R) => string | null | undefined; onChange: (r: R, v: string) => void }
  | { kind: "select"; options: string[]; value: (r: R) => string | null | undefined; onChange: (r: R, v: string | null) => void };

export type DataColumn<R> = {
  key: string;
  header: string;
  unit?: string;
  numeric?: boolean; // right-aligned, tabular figures, numbers shown to 6 significant digits
  cell?: (r: R) => ReactNode;
  edit?: Edit<R>;
};

export type RowError = { field?: string | null; message: string };

export const headerText = (c: { header: string; unit?: string }) => (c.unit ? `${c.header} (${c.unit})` : c.header);

function show(v: ReactNode): ReactNode {
  return typeof v === "number" ? num(v) : v === null || v === undefined ? "—" : v;
}

// Enter: same column, next data row (skips error rows). Escape: restore the value on focus.
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
  let next = tr.nextElementSibling as HTMLElement | null;
  while (next?.dataset.errorRow) next = next.nextElementSibling as HTMLElement | null;
  next?.children[col]?.querySelector<HTMLElement>("input, select")?.focus();
}

function EditCell<R>({ row, edit, name, invalid }: { row: R; edit: Edit<R>; name: string; invalid: boolean }) {
  const start = useRef<Value>(null);
  const value = edit.value(row);
  const remember = () => (start.current = value);
  const common = {
    "aria-label": name,
    "aria-invalid": invalid || undefined,
    onFocus: remember,
  };
  if (edit.kind === "select")
    return (
      <select
        {...common}
        value={value ?? ""}
        onChange={(e) => edit.onChange(row, e.target.value || null)}
        onKeyDown={(e) => keys(e, () => edit.onChange(row, (start.current as string | null) ?? null))}
      >
        <option value="">(choose)</option>
        {edit.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  if (edit.kind === "number")
    return (
      <input
        {...common}
        type="number"
        step="any"
        value={value ?? ""}
        onChange={(e) => edit.onChange(row, e.target.value === "" ? null : e.target.valueAsNumber)}
        onKeyDown={(e) => keys(e, () => edit.onChange(row, (start.current as number | null) ?? null))}
      />
    );
  return (
    <input
      {...common}
      type="text"
      value={value ?? ""}
      onChange={(e) => edit.onChange(row, e.target.value)}
      onKeyDown={(e) => keys(e, () => edit.onChange(row, (start.current as string | null) ?? ""))}
    />
  );
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
  empty?: ReactNode;
}) {
  if (!rows.length && empty) return <>{empty}</>;
  const span = columns.length + (actions ? 1 : 0);
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
        <tbody>
          {rows.map((r, k) => {
            const errors = rowErrors?.(r) ?? [];
            return [
              <tr key={rowKey(r, k)} data-testid={rowTestId?.(r, k)} data-invalid={errors.length ? "true" : undefined}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? "num" : undefined}>
                    {c.edit ? (
                      <EditCell row={r} edit={c.edit} name={`${headerText(c)} of ${rowName(r, k)}`} invalid={errors.some((x) => x.field === c.key)} />
                    ) : (
                      show(c.cell?.(r))
                    )}
                  </td>
                ))}
                {actions && <td className={styles.actions}>{actions(r, k)}</td>}
              </tr>,
              errors.length > 0 && (
                <tr key={`${rowKey(r, k)}-errors`} data-error-row="true" className={styles.errorRow}>
                  <td colSpan={span} role="alert">
                    <Icon name="warn" size={14} />
                    {errors
                      .map((x) => {
                        const col = columns.find((c) => c.key === x.field);
                        return `${col ? `${col.header}: ` : x.field ? `${x.field}: ` : ""}${x.message}`;
                      })
                      .join(" ")}
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
