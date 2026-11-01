"use client";
// S-05 Network editor (Doc 7 §6.3): Buses, Lines, Inverters as tables (FR-10, FR-12, FR-13),
// derived Line totals (display only, D-46 K9), live topology issues (FR-19). Diagram (FR-14)
// and the Bus delete guard (FR-11) are Should, stage 1.5.
import { useState } from "react";
import { EntityTable, type Column } from "../../components/EntityTable";
import { RequireProject } from "../../components/RequireProject";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";

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
];

type Tab = "Buses" | "Lines" | "Inverters";
const ROW_ENTITIES = new Set(["Bus", "Line", "Inverter"]);

function Network() {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const [tab, setTab] = useState<Tab>("Buses");
  const [busId, setBusId] = useState("");
  const issues = useValidation(design)?.issues ?? [];
  const busCount = design.buses?.length ?? 0;
  const enabled: Record<Tab, boolean> = { Buses: true, Lines: busCount >= 2, Inverters: busCount >= 1 };
  const firstBus = design.buses?.[0]?.id ?? null;
  // Row issues show in the tables; topology and design-level issues are listed here.
  const listed = issues.filter((i) => i.level === "topology" || !ROW_ENTITIES.has(i.entity ?? ""));

  return (
    <>
      <h1>Network</h1>
      <div role="tablist" aria-label="Network tables">
        {(["Buses", "Lines", "Inverters"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={!enabled[t]} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {!enabled.Lines && <p>Lines need two buses; inverters need one.</p>}
      <section role="tabpanel" aria-label={tab}>
        {tab === "Buses" && (
          <>
            <form
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
              <p>No buses yet. Add a bus to start.</p>
            ) : (
              <EntityTable
                collection="buses"
                entity="Bus"
                label="Buses"
                columns={[{ field: "id", label: "Bus id", kind: "text" }]}
                issues={issues}
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
            <EntityTable collection="lines" entity="Line" label="Lines" columns={LINE_COLUMNS} issues={issues} />
          </>
        )}
        {tab === "Inverters" && (
          <>
            <button type="button" onClick={() => dispatch({ type: "rowAdded", collection: "inverters", row: { bus_id: firstBus } })}>
              + Add inverter
            </button>
            <EntityTable collection="inverters" entity="Inverter" label="Inverters" columns={INVERTER_COLUMNS} issues={issues} />
          </>
        )}
      </section>
      <h2>Issues</h2>
      {listed.length === 0 ? (
        <p>No network-level problems found.</p>
      ) : (
        <ul aria-label="Network issues">
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
