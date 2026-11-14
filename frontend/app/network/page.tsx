"use client";
// S-05 Network editor (Doc 7 §6.3): Buses, Lines, Inverters as tables (FR-10, FR-12, FR-13),
// derived Line totals (display only, D-46 K9), live topology issues (FR-19), read-only diagram
// (FR-14, drawn as the single-line diagram of Doc 12 X8) and the Bus delete guard (FR-11, in
// EntityTable). Diagram and table rows open the Inspector (FR-90). Catalogue entries fill Lines and
// Inverters (Doc 12 FR-66, FR-69, FR-70).
import { useEffect, useState } from "react";
import { ExampleGuide, ExampleNext } from "../../components/ExampleForm";
import { BUS_COLUMNS, INVERTER_COLUMNS, LINE_COLUMNS } from "../../components/elementFields";
import { BankPick, CatalogPick } from "../../components/ElementSource";
import { EmptyState } from "../../components/EmptyState";
import { EntityTable } from "../../components/EntityTable";
import { Icon } from "../../components/Icon";
import { Inspector, type ElementRef } from "../../components/Inspector";
import { RequireProject } from "../../components/RequireProject";
import { SingleLineDiagram } from "../../components/sld/SingleLineDiagram";
import { useSldModel } from "../../components/sld/useSldModel";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";
import styles from "./network.module.css";

type Tab = "Buses" | "Lines" | "Inverters";
const ROW_ENTITIES = new Set(["Bus", "Line", "Inverter"]);

function Network() {
  const { design, batteryBanks } = useProject();
  const dispatch = useProjectDispatch();
  const [tab, setTab] = useState<Tab>("Buses");
  const [busId, setBusId] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [inspect, setInspect] = useState<ElementRef | null>(null);
  const sld = useSldModel();
  const TAB_OF = { bus: "Buses", line: "Lines", inverter: "Inverters" } as const;
  const open = (t: ElementRef) => {
    setInspect(t);
    setFocus(t.id);
    if (t.kind !== "load") setTab(TAB_OF[t.kind]);
  };
  // D-48 K22: ?focus=<id> from a limiting constraint opens the tab holding that element.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("focus");
    if (!id) return;
    setFocus(id);
    if (design.lines?.some((r) => r.id === id)) setTab("Lines");
    else if (design.inverters?.some((r) => r.id === id)) setTab("Inverters");
    // runs once on arrival; later edits keep the chosen tab
  }, []);
  const issues = useValidation(design, null, batteryBanks)?.issues ?? [];
  const busCount = design.buses?.length ?? 0;
  const enabled: Record<Tab, boolean> = { Buses: true, Lines: busCount >= 2, Inverters: busCount >= 1 };
  const firstBus = design.buses?.[0]?.id ?? null;
  // Row issues show in the tables; topology and design-level issues are listed here.
  const listed = issues.filter((i) => i.level === "topology" || !ROW_ENTITIES.has(i.entity ?? ""));

  return (
    <>
      <h1>Network</h1>
      <ExampleGuide screen="network" runnable={false} />
      {!enabled.Lines && <p className={styles.hint}>Lines need two buses; inverters need one.</p>}
      <div role="tablist" aria-label="Network tables" className={styles.tabs}>
        {(["Buses", "Lines", "Inverters"] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} disabled={!enabled[t]} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
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
                columns={BUS_COLUMNS}
                issues={issues}
                focus={focus}
                onInspect={(id) => open({ kind: "bus", id })}
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
            <EntityTable collection="lines" entity="Line" label="Lines" columns={LINE_COLUMNS} issues={issues} focus={focus} onInspect={(id) => open({ kind: "line", id })} />
            <CatalogPick collection="lines" />
          </>
        )}
        {tab === "Inverters" && (
          <>
            <button type="button" onClick={() => dispatch({ type: "rowAdded", collection: "inverters", row: { bus_id: firstBus } })}>
              + Add inverter
            </button>
            <EntityTable collection="inverters" entity="Inverter" label="Inverters" columns={INVERTER_COLUMNS} issues={issues} focus={focus} onInspect={(id) => open({ kind: "inverter", id })} />
            <CatalogPick collection="inverters" />
            <BankPick />
          </>
        )}
      </section>
      <details className={styles.diagram}>
        <summary>Diagram (read-only)</summary>
        <SingleLineDiagram drawing={sld.design} details={sld.full} selected={inspect?.id ?? null} onSelect={open} breakers={sld.breakers} />
      </details>
      {inspect && <Inspector target={inspect} onClose={() => setInspect(null)} />}
      <h2>Issues</h2>
      {listed.length === 0 ? (
        <p className="all-clear">
          <Icon name="feasible" />
          No network-level problems found.
        </p>
      ) : (
        <div className="problems">
          <Icon name="list" size={20} />
          <ul aria-label="Network issues">
            {listed.map((i, k) => (
              <li key={k}>
                {[i.entity, i.id, i.field].filter(Boolean).join(" / ") || "Design"}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ExampleNext screen="network" ready={true} />
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
