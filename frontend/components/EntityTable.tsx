"use client";
// Editable entity table for S-05 (Doc 7 §6.3): one row per item, unit in every numeric header
// and input label (FR-05), inline stage-1 messages per row. Drawn by DataTable (ADR-011).
import { useState } from "react";
import type { ValidationIssue } from "../api-types";
import { busDependents, useProject, useProjectDispatch, type Collection } from "../store";
import { DataTable, type DataColumn } from "./DataTable";
import { Toast } from "./Toast";

export type Column =
  | { field: string; label: string; kind: "text" }
  | { field: string; label: string; kind: "bus" }
  | { field: string; label: string; kind: "number"; unit: string }
  | { label: string; kind: "derived"; unit: string; value: (row: Row) => number | string | null };

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
  const [refused, setRefused] = useState<string | null>(null);
  const dispatch = useProjectDispatch();
  const rows: Row[] = design[collection] ?? [];
  const busIds = (design.buses ?? []).map((b) => b.id ?? "");
  const set = (row: Row, patch: Row) => dispatch({ type: "rowUpdated", collection, id: row.id ?? "", patch });
  const name = (row: Row, k: number) => row.id || `row ${k + 1}`;

  const cols: DataColumn<Row>[] = columns.map((c): DataColumn<Row> => {
    const unit = "unit" in c ? c.unit : undefined;
    if (c.kind === "derived") return { key: c.label, header: c.label, unit, numeric: unit !== "entry", labelCell: true, cell: c.value };
    const f = c.field;
    if (c.kind === "bus")
      return { key: f, header: c.label, edit: { kind: "select", options: busIds, value: (r) => r[f] as string, onChange: (r, v) => set(r, { [f]: v }) } };
    if (c.kind === "number")
      return { key: f, header: c.label, unit, numeric: true, edit: { kind: "number", value: (r) => r[f] as number, onChange: (r, v) => set(r, { [f]: v }) } };
    // text stays a string ("" allowed) so a cleared id still matches its row
    return { key: f, header: c.label, edit: { kind: "text", value: (r) => r[f] as string, onChange: (r, v) => set(r, { [f]: v }) } };
  });
  if (collection !== "buses") cols.unshift({ key: "id", header: "Id", cell: (r) => <strong>{r.id}</strong> });

  return (
    <>
      {refused && (
        <div style={{ maxWidth: "var(--prose-max)" }}>
          <Toast inline message={refused} onDismiss={() => setRefused(null)} />
        </div>
      )}
      <DataTable
        label={label}
        columns={cols}
        rows={rows}
        rowKey={(_, k) => k} // index key keeps focus while a Bus id is being retyped
        rowName={name}
        rowTestId={(_, k) => `${collection}-${k}`}
        rowCurrent={(r) => focus !== null && r.id === focus}
        rowErrors={(r) => issues.filter((i) => i.entity === entity && i.id === r.id).map((i) => ({ field: i.field, message: i.message }))}
        actions={(row, k) => (
          <button
            type="button"
            onClick={() => {
              const deps = collection === "buses" ? busDependents(design, row.id ?? "") : [];
              // FR-11: refuse and name the dependents; the Bus stays
              if (deps.length) return setRefused(`Bus ${row.id} cannot be deleted: it is used by ${deps.join(", ")}.`);
              setRefused(null);
              dispatch({ type: "rowRemoved", collection, id: row.id ?? "" });
            }}
          >
            Delete {name(row, k)}
          </button>
        )}
      />
    </>
  );
}
