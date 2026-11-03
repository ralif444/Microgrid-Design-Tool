"use client";
// S-05 Network editor (Doc 7 §6.3): Buses, Lines, Inverters as tables (FR-10, FR-12, FR-13),
// derived Line totals (display only, D-46 K9), live topology issues (FR-19), read-only diagram
// (FR-14) and the Bus delete guard (FR-11, in EntityTable). Catalogue entries fill Lines and
// Inverters (Doc 12 FR-66, FR-69, FR-70).
import { useEffect, useState } from "react";
import type { CatalogRef } from "../../api-types";
import { block, entryWarnings, fromEntry, refText, useCatalog } from "../../components/Catalog";
import { EmptyState } from "../../components/EmptyState";
import { EntityTable, type Column } from "../../components/EntityTable";
import { Icon } from "../../components/Icon";
import { NetworkDiagram } from "../../components/NetworkDiagram";
import { RequireProject } from "../../components/RequireProject";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";
import styles from "./network.module.css";

const times = (a: unknown, b: unknown) => (typeof a === "number" && typeof b === "number" ? a * b : null);

const LINE_COLUMNS: Column[] = [
  { field: "from_bus_id", label: "From bus", kind: "bus" },
  { field: "to_bus_id", label: "To bus", kind: "bus" },
  { field: "r_ohm_per_km", label: "R", kind: "number", unit: "Ω/km" },
  { field: "x_ohm_per_km", label: "X", kind: "number", unit: "Ω/km" },
  { field: "length_km", label: "Length", kind: "number", unit: "km" },
  { field: "current_limit_a", label: "Current limit, optional", kind: "number", unit: "A" },
  { label: "Total R, derived, read-only", kind: "derived", unit: "Ω", value: (r) => times(r.r_ohm_per_km, r.length_km) },
  { label: "Total X, derived, read-only", kind: "derived", unit: "Ω", value: (r) => times(r.x_ohm_per_km, r.length_km) },
  { label: "From catalogue", kind: "derived", unit: "entry", value: (r) => refText(r.catalog_ref as CatalogRef | null) },
];

const INVERTER_COLUMNS: Column[] = [
  { field: "bus_id", label: "Bus", kind: "bus" },
  { field: "rated_kva", label: "Rating", kind: "number", unit: "kVA" },
  { field: "frequency_droop_hz_per_kw", label: "P–f droop", kind: "number", unit: "Hz/kW" },
  { field: "voltage_droop_kv_per_kvar", label: "Q–V droop", kind: "number", unit: "kV/kvar" },
  { field: "frequency_setpoint_hz", label: "Frequency setpoint", kind: "number", unit: "Hz" },
  { field: "voltage_setpoint_kv", label: "Voltage setpoint, line-to-line", kind: "number", unit: "kV" },
  { field: "p_setpoint_kw", label: "P setpoint, optional", kind: "number", unit: "kW" },
  { field: "q_setpoint_kvar", label: "Q setpoint, optional", kind: "number", unit: "kvar" },
  { field: "tau_p_s", label: "τ_P, needed for M4", kind: "number", unit: "s" },
  { field: "tau_q_s", label: "τ_Q, needed for M4", kind: "number", unit: "s" },
  { label: "From catalogue", kind: "derived", unit: "entry", value: (r) => refText(r.catalog_ref as CatalogRef | null) },
];

// "Choose from catalogue" (Doc 12 §5 S-05): the server's guard decides; a refusal names why.
function CatalogPick({ collection }: { collection: "lines" | "inverters" }) {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const { catalog, checks } = useCatalog();
  const kind = collection === "lines" ? "CONDUCTOR" : "INVERTER";
  const entries = catalog.entries.filter((e) => e.kind === kind);
  const [element, setElement] = useState("");
  const [entryId, setEntryId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const entry = entries.find((e) => e.id === entryId);
  const ampacity = entry ? block(entry).ampacity_a : null;
  if (entries.length === 0) return <p className={styles.hint}>No {kind.toLowerCase()} entries in the Catalogue.</p>;
  return (
    <form
      aria-label="Choose from catalogue"
      className={styles.pick}
      onSubmit={(e) => {
        e.preventDefault();
        const check = checks.find((c) => c.entry_id === entryId);
        if (!entry || !element) return setNote("Choose an element and an entry.");
        if (!check?.usable) return setNote(`${entryId} cannot be used: ${check?.reasons.join("; ") ?? "not checked yet"}.`);
        dispatch({ type: "rowUpdated", collection, id: element, patch: fromEntry(entry, catalog.schema_version, confirm) });
        const row = (design[collection] ?? []).find((r) => r.id === element) ?? {};
        const warnings = entryWarnings(entry, design, row);
        setNote(`${element} filled from ${entryId}.${warnings.length ? ` Warning: ${warnings.join("; ")}.` : ""}`);
      }}
    >
      <h2>Choose from catalogue</h2>
      <label htmlFor="pick-element">Element</label>{" "}
      <select id="pick-element" value={element} onChange={(e) => setElement(e.target.value)}>
        <option value="">Choose…</option>
        {(design[collection] ?? []).map((r) => (
          <option key={r.id}>{r.id}</option>
        ))}
      </select>{" "}
      <label htmlFor="pick-entry">Catalogue entry</label>{" "}
      <select id="pick-entry" value={entryId} onChange={(e) => setEntryId(e.target.value)}>
        <option value="">Choose…</option>
        {entries.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id} {[e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ")}
          </option>
        ))}
      </select>{" "}
      {typeof ampacity === "number" && (
        <label>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Also use {ampacity} A as the
          current limit (datasheet reference conditions)
        </label>
      )}{" "}
      <button type="submit">Use in Project</button>
      {note && <p role="status">{note}</p>}
    </form>
  );
}

type Tab = "Buses" | "Lines" | "Inverters";
const ROW_ENTITIES = new Set(["Bus", "Line", "Inverter"]);

function Network() {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const [tab, setTab] = useState<Tab>("Buses");
  const [busId, setBusId] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  // D-48 K22: ?focus=<id> from a limiting constraint opens the tab holding that element.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("focus");
    if (!id) return;
    setFocus(id);
    if (design.lines?.some((r) => r.id === id)) setTab("Lines");
    else if (design.inverters?.some((r) => r.id === id)) setTab("Inverters");
    // runs once on arrival; later edits keep the chosen tab
  }, []);
  const issues = useValidation(design)?.issues ?? [];
  const busCount = design.buses?.length ?? 0;
  const enabled: Record<Tab, boolean> = { Buses: true, Lines: busCount >= 2, Inverters: busCount >= 1 };
  const firstBus = design.buses?.[0]?.id ?? null;
  // Row issues show in the tables; topology and design-level issues are listed here.
  const listed = issues.filter((i) => i.level === "topology" || !ROW_ENTITIES.has(i.entity ?? ""));

  return (
    <>
      <h1>Network</h1>
      <div role="tablist" aria-label="Network tables" className={styles.tabs}>
        {(["Buses", "Lines", "Inverters"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={!enabled[t]} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {!enabled.Lines && <p className={styles.hint}>Lines need two buses; inverters need one.</p>}
      <section role="tabpanel" aria-label={tab} className={styles.panel}>
        {tab === "Buses" && (
          <>
            <form
              className={styles.toolbar}
              onSubmit={(e) => {
                e.preventDefault();
                dispatch({ type: "rowAdded", collection: "buses", row: { id: busId.trim() } });
                setBusId("");
              }}
            >
              <label htmlFor="bus-id">Bus id</label>{" "}
              <input id="bus-id" required value={busId} onChange={(e) => setBusId(e.target.value)} />{" "}
              <button type="submit">Add bus</button>
            </form>
            {busCount === 0 ? (
              <EmptyState title="No buses yet." icon="link">
                Add a bus to start; lines and inverters connect to buses.
              </EmptyState>
            ) : (
              <EntityTable
                collection="buses"
                entity="Bus"
                label="Buses"
                columns={[{ field: "id", label: "Bus id", kind: "text" }]}
                issues={issues}
                focus={focus}
              />
            )}
          </>
        )}
        {tab === "Lines" && (
          <>
            <button
              type="button"
              onClick={() => dispatch({ type: "rowAdded", collection: "lines", row: { from_bus_id: null, to_bus_id: null } })}
            >
              + Add line
            </button>
            <EntityTable collection="lines" entity="Line" label="Lines" columns={LINE_COLUMNS} issues={issues} focus={focus} />
            <CatalogPick collection="lines" />
          </>
        )}
        {tab === "Inverters" && (
          <>
            <button type="button" onClick={() => dispatch({ type: "rowAdded", collection: "inverters", row: { bus_id: firstBus } })}>
              + Add inverter
            </button>
            <EntityTable collection="inverters" entity="Inverter" label="Inverters" columns={INVERTER_COLUMNS} issues={issues} focus={focus} />
            <CatalogPick collection="inverters" />
          </>
        )}
      </section>
      <details className={styles.diagram}>
        <summary>Diagram (read-only)</summary>
        <NetworkDiagram design={design} />
      </details>
      <h2>Issues</h2>
      {listed.length === 0 ? (
        <p className={styles.ok}>
          <Icon name="check" />
          No network-level problems found.
        </p>
      ) : (
        <ul aria-label="Network issues" className={styles.issues}>
          {listed.map((i, k) => (
            <li key={k}>
              {[i.entity, i.id, i.field].filter(Boolean).join(" / ") || "Design"}: {i.message}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function NetworkPage() {
  return (
    <RequireProject>
      <Network />
    </RequireProject>
  );
}
