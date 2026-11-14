"use client";
// Editable entity table for S-05 (Doc 7 §6.3): one row per item, unit in every numeric header
// and input label (FR-05), inline stage-1 messages per row. Drawn by DataTable (ADR-011).
import { useState } from "react";
import type { ValidationIssue } from "../api-types";
import { busDependents, useProject, useProjectDispatch, type Collection } from "../store";
import { CANNOT_UNDO, useConfirmDelete } from "./ConfirmDelete";
import { DataTable, type DataColumn } from "./DataTable";
import type { GlossaryKey } from "./glossary";
import { Toast } from "./Toast";

export type Column =
  | { field: string; label: string; kind: "text" }
  | { field: string; label: string; kind: "bus" }
  | { field: string; label: string; kind: "number"; unit: string; term?: GlossaryKey }
  | { label: string; kind: "derived"; unit: string; value: (row: Row) => number | string | null };

type Row = { id?: string | null; [field: string]: unknown };

/** Delete with the FR-11 Bus guard and the F2 confirmation; shared by the tables and the workspace inspector. */
export function useRowDelete(collection: Collection, onDone?: () => void) {
  const { design, batteryBanks } = useProject();
  const { dialog, confirm } = useConfirmDelete();
  const [refused, setRefused] = useState<string | null>(null);
  const dispatch = useProjectDispatch();
  function remove(id: string, name: string) {
    const deps = collection === "buses" ? busDependents(design, id) : [];
    // FR-11: refuse and name the dependents; the Bus stays
    if (deps.length) return setRefused(`Bus ${id} cannot be deleted: it is used by ${deps.join(", ")}.`);
    setRefused(null);
    // reducer.ts: removing an Inverter also removes its battery bank
    const bank = collection === "inverters" && batteryBanks.some((b) => b.inverter_id === id) ? ` Its battery bank is removed too.` : "";
    confirm(`Delete ${name}?`, `${name} is removed from the design.${bank} ${CANNOT_UNDO}`, () => {
      dispatch({ type: "rowRemoved", collection, id });
      onDone?.();
    });
  }
  return { dialog, refused, setRefused, remove };
}

export function EntityTable({
  collection,
  entity,
  label,
  columns,
  issues,
  focus = null,
  onInspect,
}: {
  collection: Collection;
  entity: string;
  label: string;
  columns: Column[];
  issues: ValidationIssue[];
  focus?: string | null;
  /** FR-90 table path (UX-4, D-79): an "Inspect <id>" button per row opens the Inspector. */
  onInspect?: (id: string) => void;
}) {
  const { design } = useProject();
  const { dialog, refused, setRefused, remove } = useRowDelete(collection);
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
      return { key: f, header: c.label, unit, term: c.term, numeric: true, edit: { kind: "number", value: (r) => r[f] as number, onChange: (r, v) => set(r, { [f]: v }) } };
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
          <>
          {onInspect && row.id && (
            <button type="button" onClick={() => onInspect(row.id ?? "")}>
              Inspect {row.id}
            </button>
          )}{" "}
          <button
            type="button"
            onClick={() => remove(row.id ?? "", name(row, k))}
          >
            Delete {name(row, k)}
          </button>
          </>
        )}
      />
      {dialog}
    </>
  );
}
