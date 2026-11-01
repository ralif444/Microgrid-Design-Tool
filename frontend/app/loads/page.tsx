"use client";
// S-03 Loads (Doc 7 §6.1): Load table with Q or power factor per row (FR-03), inline stage-1
// messages from /api/projects/validate (FR-17, FR-18). Buses are edited on S-05 (D-46 K8).
// LoadProfile (FR-04) is Should, stage 1.5.
import Link from "next/link";
import { useState } from "react";
import type { Load, ValidationIssue } from "../../api-types";
import { RequireProject } from "../../components/RequireProject";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";

const where = (i: ValidationIssue) => [i.entity, i.id, i.field].filter(Boolean).join(" / ");

function LoadRow({ load, issues }: { load: Load; issues: ValidationIssue[] }) {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const [mode, setMode] = useState<"Q" | "PF">(load.power_factor != null || load.pf_direction != null ? "PF" : "Q");
  const id = load.id ?? "";
  const set = (patch: Partial<Load>) => dispatch({ type: "rowUpdated", collection: "loads", id, patch });
  const num = (v: string) => (v === "" ? null : Number(v));
  const choose = (m: "Q" | "PF") => {
    setMode(m);
    set(m === "Q" ? { power_factor: null, pf_direction: null } : { q_kvar: null });
  };
  return (
    <tr data-testid={`load-${id}`}>
      <th scope="row">{id}</th>
      <td>
        <select aria-label={`Bus of ${id}`} value={load.bus_id ?? ""} onChange={(e) => set({ bus_id: e.target.value || null })}>
          <option value="">(choose)</option>
          {(design.buses ?? []).map((b, k) => (
            <option key={k} value={b.id ?? ""}>
              {b.id}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input aria-label={`P of ${id} (kW)`} type="number" step="any" value={load.p_kw ?? ""} onChange={(e) => set({ p_kw: num(e.target.value) })} />
      </td>
      <td>
        <fieldset>
          <legend className="sr-only">Reactive power of {id} given as</legend>
          <label>
            <input type="radio" name={`mode-${id}`} checked={mode === "Q"} onChange={() => choose("Q")} /> Q
          </label>{" "}
          <label>
            <input type="radio" name={`mode-${id}`} checked={mode === "PF"} onChange={() => choose("PF")} /> PF
          </label>
        </fieldset>
        {mode === "Q" ? (
          <input aria-label={`Q of ${id} (kvar)`} type="number" step="any" value={load.q_kvar ?? ""} onChange={(e) => set({ q_kvar: num(e.target.value) })} />
        ) : (
          <>
            <input
              aria-label={`Power factor of ${id} (ratio)`}
              type="number"
              step="any"
              value={load.power_factor ?? ""}
              onChange={(e) => set({ power_factor: num(e.target.value) })}
            />{" "}
            <select
              aria-label={`PF direction of ${id}`}
              value={load.pf_direction ?? ""}
              onChange={(e) => set({ pf_direction: (e.target.value || null) as Load["pf_direction"] })}
            >
              <option value="">(choose)</option>
              <option value="LAGGING">lagging</option>
              <option value="LEADING">leading</option>
            </select>
          </>
        )}
      </td>
      <td>
        <button type="button" onClick={() => dispatch({ type: "rowRemoved", collection: "loads", id })}>
          Delete {id}
        </button>
      </td>
      <td>
        {issues.map((i, k) => (
          <div key={k} role="alert">
            {i.field ? `${i.field}: ` : ""}
            {i.message}
          </div>
        ))}
      </td>
    </tr>
  );
}

function Loads() {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const issues = useValidation(design, "PS")?.issues ?? [];
  const loads = design.loads ?? [];

  const other = issues.filter((i) => i.entity !== "Load");
  return (
    <>
      <h1>Loads</h1>
      {(design.buses?.length ?? 0) === 0 && (
        <p>
          No buses yet. <Link href="/network/">Add buses in the network editor</Link> so loads can be placed on them.
        </p>
      )}
      <h2>Load table</h2>
      <button type="button" onClick={() => dispatch({ type: "rowAdded", collection: "loads", row: { bus_id: design.buses?.[0]?.id ?? null, p_kw: null, q_kvar: null } })}>
        + Add load
      </button>
      {loads.length === 0 ? (
        <p>No loads yet. Add the first load.</p>
      ) : (
        <table aria-label="Loads">
          <thead>
            <tr>
              <th>Id</th>
              <th>Bus</th>
              <th>P (kW)</th>
              <th>Q (kvar) or power factor</th>
              <th>Actions</th>
              <th>Problems</th>
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <LoadRow key={l.id} load={l} issues={issues.filter((i) => i.entity === "Load" && i.id === l.id)} />
            ))}
          </tbody>
        </table>
      )}
      {other.length > 0 && (
        <ul aria-label="Other problems">
          {other.map((i, k) => (
            <li key={k}>
              {where(i) || "Design"}: {i.message}
            </li>
          ))}
        </ul>
      )}
      <p>
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
