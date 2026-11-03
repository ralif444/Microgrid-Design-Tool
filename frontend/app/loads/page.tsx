"use client";
// S-03 Loads (Doc 7 §6.1): Load table with Q or power factor per row (FR-03), inline stage-1
// messages from /api/projects/validate (FR-17, FR-18). Buses are edited on S-05 (D-46 K8).
// LoadProfile (FR-04) is Should, stage 1.5.
import Link from "next/link";
import { useState } from "react";
import type { Load, ValidationIssue } from "../../api-types";
import { CellInput, CellSelect, DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { RequireProject } from "../../components/RequireProject";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";
import styles from "./loads.module.css";

const where = (i: ValidationIssue) => [i.entity, i.id, i.field].filter(Boolean).join(" / ");
type Mode = "Q" | "PF";

function Loads() {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const issues = useValidation(design, "PS")?.issues ?? [];
  const loads = design.loads ?? [];
  const buses: [string, string][] = (design.buses ?? []).map((b) => [b.id ?? "", b.id ?? ""]);
  // Q or PF per row is a screen choice, not data: both empty would otherwise read as Q.
  const [modes, setModes] = useState<Record<string, Mode>>({});
  const modeOf = (l: Load): Mode => modes[l.id ?? ""] ?? (l.power_factor != null || l.pf_direction != null ? "PF" : "Q");
  const set = (l: Load, patch: Partial<Load>) => dispatch({ type: "rowUpdated", collection: "loads", id: l.id ?? "", patch });
  const choose = (l: Load, m: Mode) => {
    setModes({ ...modes, [l.id ?? ""]: m });
    set(l, m === "Q" ? { power_factor: null, pf_direction: null } : { q_kvar: null });
  };
  const rowIssues = (l: Load) => issues.filter((i) => i.entity === "Load" && i.id === l.id);
  const bad = (l: Load, f: string) => rowIssues(l).some((i) => i.field === f);

  const columns: DataColumn<Load>[] = [
    { key: "id", header: "Id", cell: (l) => <span className={styles.id}>{l.id}</span> },
    {
      key: "bus_id",
      header: "Bus",
      cell: (l) => <CellSelect label={`Bus of ${l.id}`} options={buses} value={l.bus_id} onChange={(v) => set(l, { bus_id: v })} invalid={bad(l, "bus_id")} />,
    },
    {
      key: "p_kw",
      header: "P",
      unit: "kW",
      numeric: true,
      cell: (l) => <CellInput label={`P of ${l.id} (kW)`} kind="number" value={l.p_kw} onChange={(v: number | null) => set(l, { p_kw: v })} invalid={bad(l, "p_kw")} />,
    },
    {
      key: "mode",
      header: "Reactive power as",
      fields: [],
      cell: (l) => (
        // a radiogroup instead of fieldset + legend: the legend box shifts the radios in a table cell
        <div role="radiogroup" aria-label={`Reactive power of ${l.id} given as`} className={styles.mode}>
          <label>
            <input type="radio" name={`mode-${l.id}`} checked={modeOf(l) === "Q"} onChange={() => choose(l, "Q")} /> Q
          </label>
          <label>
            <input type="radio" name={`mode-${l.id}`} checked={modeOf(l) === "PF"} onChange={() => choose(l, "PF")} /> PF
          </label>
        </div>
      ),
    },
    {
      key: "q",
      header: "Q (kvar) or power factor (ratio)",
      numeric: true,
      fields: ["q_kvar", "power_factor"],
      cell: (l) =>
        modeOf(l) === "Q" ? (
          <CellInput label={`Q of ${l.id} (kvar)`} kind="number" value={l.q_kvar} onChange={(v: number | null) => set(l, { q_kvar: v })} invalid={bad(l, "q_kvar")} />
        ) : (
          <CellInput
            label={`Power factor of ${l.id} (ratio)`}
            kind="number"
            value={l.power_factor}
            onChange={(v: number | null) => set(l, { power_factor: v })}
            invalid={bad(l, "power_factor")}
          />
        ),
    },
    {
      key: "pf_direction",
      header: "PF direction",
      cell: (l) =>
        modeOf(l) === "PF" ? (
          <CellSelect
            label={`PF direction of ${l.id}`}
            options={[
              ["LAGGING", "lagging"],
              ["LEADING", "leading"],
            ]}
            value={l.pf_direction}
            onChange={(v) => set(l, { pf_direction: v as Load["pf_direction"] })}
            invalid={bad(l, "pf_direction")}
          />
        ) : null,
    },
  ];

  const other = issues.filter((i) => i.entity !== "Load");
  return (
    <>
      <h1>Loads</h1>
      {(design.buses?.length ?? 0) === 0 && (
        <EmptyState title="No buses yet." icon="link" action={<Link href="/network/">Add buses in the network editor</Link>}>
          Loads are placed on buses.
        </EmptyState>
      )}
      <div className={styles.toolbar}>
        <h2>Load table</h2>
        <button
          type="button"
          onClick={() => dispatch({ type: "rowAdded", collection: "loads", row: { bus_id: design.buses?.[0]?.id ?? null, p_kw: null, q_kvar: null } })}
        >
          + Add load
        </button>
      </div>
      {(loads.length > 0 || (design.buses?.length ?? 0) > 0) && (
        <DataTable
          label="Loads"
          columns={columns}
          rows={loads}
          rowKey={(l) => l.id ?? ""}
          rowName={(l) => l.id ?? ""}
          rowTestId={(l) => `load-${l.id}`}
          rowErrors={(l) => rowIssues(l).map((i) => ({ field: i.field, message: i.message }))}
          actions={(l) => (
            <button type="button" onClick={() => dispatch({ type: "rowRemoved", collection: "loads", id: l.id ?? "" })}>
              Delete {l.id}
            </button>
          )}
          empty={<EmptyState title="No loads yet.">Add the first load.</EmptyState>}
        />
      )}
      {other.length > 0 && (
        <div className={styles.other}>
          <Icon name="list" size={20} />
          <ul aria-label="Other problems">
            {other.map((i, k) => (
              <li key={k}>
                {where(i) || "Design"}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.next}>
        <Link href="/sizing/">Go to sizing advice</Link>
        {loads.length === 0 && " Needs at least one load."}
      </p>
    </>
  );
}

export default function LoadsPage() {
  return (
    <RequireProject>
      <Loads />
    </RequireProject>
  );
}
