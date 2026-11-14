"use client";
// S-05 Network editor (Doc 7 §6.3): Buses, Lines, Inverters as tables (FR-10, FR-12, FR-13),
// derived Line totals (display only, D-46 K9), live topology issues (FR-19), read-only diagram
// (FR-14, drawn as the single-line diagram of Doc 12 X8) and the Bus delete guard (FR-11, in
// EntityTable). Diagram and table rows open the Inspector (FR-90). Catalogue entries fill Lines and
// Inverters (Doc 12 FR-66, FR-69, FR-70).
import { useEffect, useState } from "react";
import type { BatteryBank } from "../../api-types";
import { ExampleGuide, ExampleNext } from "../../components/ExampleForm";
import { block, entryWarnings, fromEntry, useCatalog } from "../../components/Catalog";
import { BUS_COLUMNS, INVERTER_COLUMNS, LINE_COLUMNS } from "../../components/elementFields";
import { EmptyState } from "../../components/EmptyState";
import { NumberField } from "../../components/NumberField";
import { EntityTable } from "../../components/EntityTable";
import { Icon } from "../../components/Icon";
import { Inspector, type ElementRef } from "../../components/Inspector";
import { RequireProject } from "../../components/RequireProject";
import { SingleLineDiagram } from "../../components/sld/SingleLineDiagram";
import { useSldModel } from "../../components/sld/useSldModel";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";
import styles from "./network.module.css";
import { CANNOT_UNDO, useConfirmDelete } from "../../components/ConfirmDelete";

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

// Battery bank per Inverter (Doc 12 FR-75, D-106, D-108): module only from a usable catalogue
// entry, values copied with its catalog_ref; DoD prefilled from the entry, initial SoC 1.0 (E6);
// no other default. Banks sit outside the snapshot, so saving one makes no result stale.
type BankDraft = { ns: number | null; np: number | null; eta: number | null; dod: number | null; soc: number | null };
const NEW_BANK: BankDraft = { ns: null, np: null, eta: null, dod: null, soc: 1 };

function BankPick() {
  const { dialog, confirm } = useConfirmDelete();
  const { design, batteryBanks } = useProject();
  const dispatch = useProjectDispatch();
  const { catalog, checks } = useCatalog();
  const modules = catalog.entries.filter((e) => e.kind === "BATTERY_MODULE" && checks.some((c) => c.entry_id === e.id && c.usable));
  const [inv, setInv] = useState("");
  const [entryId, setEntryId] = useState("");
  const [d, setD] = useState<BankDraft>(NEW_BANK);
  const [note, setNote] = useState<string | null>(null);
  const current = batteryBanks.find((b) => b.inverter_id === inv) ?? null;
  const set = (patch: Partial<BankDraft>) => setD({ ...d, ...patch });
  function chooseInverter(id: string) {
    setInv(id);
    setNote(null);
    const b = batteryBanks.find((x) => x.inverter_id === id);
    setEntryId("");
    setD(
      b
        ? { ns: b.series_count, np: b.parallel_count, eta: b.dc_efficiency_ratio ?? null, dod: b.depth_of_discharge_ratio ?? null, soc: b.initial_soc_ratio ?? null }
        : NEW_BANK,
    );
  }
  function chooseModule(id: string) {
    setEntryId(id);
    const dod = modules.find((e) => e.id === id)?.battery_module?.recommended_dod_ratio;
    if (dod != null) set({ dod });
  }
  function save() {
    const entry = modules.find((e) => e.id === entryId);
    if (!inv) return setNote("Choose an inverter.");
    if (!entry && !current) return setNote("Choose a battery module from the Catalogue.");
    if (!Number.isInteger(d.ns) || !Number.isInteger(d.np)) return setNote("Enter whole numbers for the series and parallel counts.");
    const m = entry?.battery_module;
    const fields = ["energy_kwh", "voltage_min_v", "voltage_max_v", "discharge_power_kw", "c_rate_per_h"] as const;
    const module: BatteryBank["module"] = entry
      ? {
          catalog_ref: {
            entry_id: entry.id,
            provenance: entry.provenance ?? {},
            sources: Object.fromEntries(fields.filter((f) => entry.sources?.[f]).map((f) => [f, entry.sources![f]])),
            catalog_schema_version: catalog.schema_version,
          },
          ...Object.fromEntries(fields.map((f) => [f, m?.[f] ?? null])),
        }
      : current!.module;
    dispatch({
      type: "bankSet",
      bank: {
        inverter_id: inv,
        module,
        series_count: d.ns!,
        parallel_count: d.np!,
        dc_efficiency_ratio: d.eta,
        depth_of_discharge_ratio: d.dod,
        initial_soc_ratio: d.soc,
      },
    });
    setNote(`Battery bank of ${inv} saved.`);
  }
  return (
    <form aria-label="Battery bank" className={styles.pick} onSubmit={(e) => (e.preventDefault(), save())}>
      <h2>Battery bank (advice only; not part of the network model, A2)</h2>
      <label htmlFor="bank-inverter">Inverter</label>{" "}
      <select id="bank-inverter" value={inv} onChange={(e) => chooseInverter(e.target.value)}>
        <option value="">Choose…</option>
        {(design.inverters ?? []).map((r) => (
          <option key={r.id}>{r.id}</option>
        ))}
      </select>{" "}
      <label htmlFor="bank-module">Battery module</label>{" "}
      <select id="bank-module" value={entryId} onChange={(e) => chooseModule(e.target.value)}>
        <option value="">{current ? `Keep ${current.module.catalog_ref.entry_id} (copied)` : "Choose…"}</option>
        {modules.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id} {[e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ")}
          </option>
        ))}
      </select>
      {modules.length === 0 && <p className={styles.hint}>No usable battery module entries in the Catalogue.</p>}
      <NumberField id="bank-ns" label="Modules in series" unit="count" step="1" value={d.ns} onChange={(v) => set({ ns: v })} />
      <NumberField id="bank-np" label="Strings in parallel" unit="count" step="1" value={d.np} onChange={(v) => set({ np: v })} />
      <NumberField id="bank-eta" label="DC efficiency η_dc, optional" unit="ratio" value={d.eta} onChange={(v) => set({ eta: v })} />
      <NumberField id="bank-dod" label="Depth of discharge, optional" unit="ratio" value={d.dod} onChange={(v) => set({ dod: v })} />
      <NumberField id="bank-soc" label="Initial state of charge, optional" unit="ratio" value={d.soc} onChange={(v) => set({ soc: v })} />
      <button type="submit">Save bank</button>{" "}
      {current && (
        <button
          type="button"
          onClick={() =>
            confirm(`Remove the battery bank of ${inv}?`, `The bank settings of ${inv} are removed; the inverter stays. ${CANNOT_UNDO}`, () => {
              dispatch({ type: "bankRemoved", inverterId: inv });
              setNote(`Battery bank of ${inv} removed.`);
            })
          }
        >
          Remove bank
        </button>
      )}
      {note && <p role="status">{note}</p>}
      {batteryBanks.length > 0 && (
        <p data-testid="bank-list">
          Banks:{" "}
          {batteryBanks
            .map((b) => `${b.inverter_id}: ${b.series_count} × ${b.parallel_count} of ${b.module.catalog_ref.entry_id}`)
            .join("; ")}
        </p>
      )}
      {dialog}
    </form>
  );
}

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
