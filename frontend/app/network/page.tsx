"use client";
// S-05 Network editor (Doc 7 §6.3): Buses, Lines, Inverters as tables (FR-10, FR-12, FR-13),
// derived Line totals (display only, D-46 K9), live topology issues (FR-19), read-only diagram
// (FR-14, drawn as the single-line diagram of Doc 12 X8) and the Bus delete guard (FR-11, in
// EntityTable). Diagram and table rows open the Inspector (FR-90). Catalogue entries fill Lines and
// Inverters (Doc 12 FR-66, FR-69, FR-70).
import { useEffect, useState } from "react";
import { ExampleGuide, ExampleNext } from "../../components/ExampleForm";
import { BUS_COLUMNS, INVERTER_COLUMNS, issueWhere, LINE_COLUMNS } from "../../components/elementFields";
import { BankPick, CatalogPick } from "../../components/ElementSource";
import { EmptyState } from "../../components/EmptyState";
import { EntityTable } from "../../components/EntityTable";
import { Icon } from "../../components/Icon";
import { useLanguage } from "../../components/Language";
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
  const { t } = useLanguage();
  const { design, batteryBanks } = useProject();
  const dispatch = useProjectDispatch();
  const [tab, setTab] = useState<Tab>("Buses");
  const [busId, setBusId] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [inspect, setInspect] = useState<ElementRef | null>(null);
  const sld = useSldModel();
  const TAB_OF = { bus: "Buses", line: "Lines", inverter: "Inverters" } as const;
  const open = (el: ElementRef) => {
    setInspect(el);
    setFocus(el.id);
    if (el.kind !== "load") setTab(TAB_OF[el.kind]);
  };
  // D-48 K22: ?focus=<id> from a limiting constraint opens the tab holding that element;
  // ?tab=<Tab> from the workspace "Table view" links opens that tab.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("tab");
    if (wanted === "Lines" || wanted === "Inverters") setTab(wanted);
    const id = params.get("focus");
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
      <h1>{t("Network")}</h1>
      <ExampleGuide screen="network" runnable={false} />
      {!enabled.Lines && <p className={styles.hint}>{t("Lines need two buses; inverters need one.")}</p>}
      <div role="tablist" aria-label={t("Network tables")} className={styles.tabs}>
        {(["Buses", "Lines", "Inverters"] as Tab[]).map((name) => (
          <button key={name} type="button" role="tab" aria-selected={tab === name} disabled={!enabled[name]} onClick={() => setTab(name)}>
            {t(name)}
          </button>
        ))}
      </div>
      <section role="tabpanel" aria-label={t(tab)} className={styles.panel}>
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
              <label htmlFor="bus-id">{t("Bus id")}</label>{" "}
              <input id="bus-id" required value={busId} onChange={(e) => setBusId(e.target.value)} />{" "}
              <button type="submit">{t("Add bus")}</button>
            </form>
            {busCount === 0 ? (
              <EmptyState title={t("No buses yet.")} icon="link">
                {t("Add a bus to start; lines and inverters connect to buses.")}
              </EmptyState>
            ) : (
              <EntityTable
                collection="buses"
                entity="Bus"
                label={t("Buses")}
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
              {t("+ Add line")}
            </button>
            <EntityTable collection="lines" entity="Line" label={t("Lines")} columns={LINE_COLUMNS} issues={issues} focus={focus} onInspect={(id) => open({ kind: "line", id })} />
            <CatalogPick collection="lines" />
          </>
        )}
        {tab === "Inverters" && (
          <>
            <button type="button" onClick={() => dispatch({ type: "rowAdded", collection: "inverters", row: { bus_id: firstBus } })}>
              {t("+ Add inverter")}
            </button>
            <EntityTable collection="inverters" entity="Inverter" label={t("Inverters")} columns={INVERTER_COLUMNS} issues={issues} focus={focus} onInspect={(id) => open({ kind: "inverter", id })} />
            <CatalogPick collection="inverters" />
            <BankPick />
          </>
        )}
      </section>
      <details className={styles.diagram}>
        <summary>{t("Diagram (read-only)")}</summary>
        <SingleLineDiagram drawing={sld.design} details={sld.full} selected={inspect?.id ?? null} onSelect={open} breakers={sld.breakers} />
      </details>
      {inspect && <Inspector target={inspect} onClose={() => setInspect(null)} />}
      <h2>{t("Issues")}</h2>
      {listed.length === 0 ? (
        <p className="all-clear">
          <Icon name="feasible" />
          {t("No network-level problems found.")}
        </p>
      ) : (
        <div className="problems">
          <Icon name="list" size={20} />
          <ul aria-label={t("Network issues")}>
            {listed.map((i, k) => (
              <li key={k}>
                {issueWhere(i)}: {i.message}
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
