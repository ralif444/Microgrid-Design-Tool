"use client";
// Editable entity table for S-05 (Doc 7 §6.3): one row per item, unit in every numeric header
// and input label (FR-05), inline stage-1 messages per row.
import type { ValidationIssue } from "../api-types";
import { useProject, useProjectDispatch, type Collection } from "../store";

export type Column =
  | { field: string; label: string; kind: "text" }
  | { field: string; label: string; kind: "bus" }
  | { field: string; label: string; kind: "number"; unit: string }
  | { label: string; kind: "derived"; unit: string; value: (row: Row) => number | null };

type Row = { id?: string | null; [field: string]: unknown };

export function EntityTable({
  collection,
  entity,
  label,
  columns,
  issues,
  focus = null,
}: {
  collection: Collection;
  entity: string;
  label: string;
  columns: Column[];
  issues: ValidationIssue[];
  focus?: string | null;
}) {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const rows: Row[] = design[collection] ?? [];
  const busIds = (design.buses ?? []).map((b) => b.id ?? "");
  const head = (c: Column) => ("unit" in c ? `${c.label} (${c.unit})` : c.label);

  return (
    <table aria-label={label}>
      <thead>
        <tr>
          {collection !== "buses" && <th>Id</th>}
          {columns.map((c) => (
            <th key={c.label}>{head(c)}</th>
          ))}
          <th>Actions</th>
          <th>Problems</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, k) => {
          const id = row.id ?? "";
          const set = (patch: Row) => dispatch({ type: "rowUpdated", collection, id, patch });
          return (
            // index key keeps focus while a Bus id is being retyped
            <tr
              key={k}
              data-testid={`${collection}-${k}`}
              aria-current={focus !== null && id === focus ? "true" : undefined}
              className={focus !== null && id === focus ? "focus" : undefined}
            >
              {collection !== "buses" && <th scope="row">{id}</th>}
              {columns.map((c) => {
                const name = `${head(c)} of ${id || `row ${k + 1}`}`;
                if (c.kind === "derived") {
                  const v = c.value(row);
                  return <td key={c.label} aria-label={name}>{v === null ? "—" : v}</td>;
                }
                const v = row[c.field] as string | number | null | undefined;
                return (
                  <td key={c.label}>
                    {c.kind === "bus" ? (
                      <select aria-label={name} value={v ?? ""} onChange={(e) => set({ [c.field]: e.target.value || null })}>
                        <option value="">(choose)</option>
                        {busIds.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        aria-label={name}
                        type={c.kind}
                        step={c.kind === "number" ? "any" : undefined}
                        value={v ?? ""}
                        onChange={(e) =>
                          // text stays a string ("" allowed) so a cleared id still matches its row
                          set({ [c.field]: c.kind === "text" ? e.target.value : e.target.value === "" ? null : e.target.valueAsNumber })
                        }
                      />
                    )}
                  </td>
                );
              })}
              <td>
                <button type="button" onClick={() => dispatch({ type: "rowRemoved", collection, id })}>
                  Delete {id || `row ${k + 1}`}
                </button>
              </td>
              <td>
                {issues
                  .filter((i) => i.entity === entity && i.id === row.id)
                  .map((i, n) => (
                    <div key={n} role="alert">
                      {i.field ? `${i.field}: ` : ""}
                      {i.message}
                    </div>
                  ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
