"use client";
// Catalogue entry and battery bank of a design element, shared by S-05 (an element chosen in the
// form) and the workspace inspector (the element fixed). Logic moved unchanged from the network page:
// "Choose from catalogue" (Doc 12 §5 S-05, FR-66, FR-69, FR-70; the server's check decides, a refusal
// names why) and the battery bank per Inverter (FR-75, D-106, D-108: module only from a usable entry,
// values copied with its catalog_ref, DoD prefilled from the entry, initial SoC 1.0 (E6), no other
// default; banks sit outside the snapshot). New here: a Now / Entry preview of what an entry overwrites.
import Link from "next/link";
import { useState } from "react";
import type { BatteryBank, CatalogEntry } from "../api-types";
import { useProject, useProjectDispatch } from "../store";
import { block, entryWarnings, fromEntry, refText, useCatalog } from "./Catalog";
import { CANNOT_UNDO, useConfirmDelete } from "./ConfirmDelete";
import styles from "./ElementSource.module.css";
import { INVERTER_COLUMNS, LINE_COLUMNS } from "./elementFields";
import type { Column } from "./EntityTable";
import { Icon } from "./Icon";
import { NumberField } from "./NumberField";

type Row = Record<string, unknown>;
const LABELS = (cols: Column[]) =>
  Object.fromEntries(cols.flatMap((c) => (c.kind === "number" ? [[c.field, [c.label, c.unit]]] : [])) as [string, [string, string]][]);
const shown = (v: unknown, unit = "") => (v == null || v === "" ? "not set" : `${v}${unit ? ` ${unit}` : ""}`);

/** The rows an entry would write into `row`, as [label, now, entry, changes]. */
export function entryPreview(collection: "lines" | "inverters", patch: Row, row: Row): [string, string, string, boolean][] {
  const labels = LABELS(collection === "lines" ? LINE_COLUMNS : INVERTER_COLUMNS);
  const rows: [string, string, string, boolean][] = Object.keys(patch)
    .filter((k) => k !== "catalog_ref")
    .map((k) => {
      const [label, unit] = labels[k] ?? [k, ""];
      return [label, shown(row[k], unit), shown(patch[k], unit), row[k] !== patch[k]];
    });
  const ref = (patch.catalog_ref as { entry_id: string }).entry_id;
  const now = row.catalog_ref ? refText(row.catalog_ref as never) : "typed by hand";
  return [...rows, ["Source", now, ref, now !== ref]];
}

const entryName = (e: CatalogEntry) => [e.id, e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ");

export function CatalogPick({ collection, element: fixed, heading = "h2" }: { collection: "lines" | "inverters"; element?: string; heading?: "h2" | "h3" }) {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const { catalog, checks } = useCatalog();
  const kind = collection === "lines" ? "CONDUCTOR" : "INVERTER";
  const entries = catalog.entries.filter((e) => e.kind === kind);
  const [chosen, setElement] = useState("");
  const [entryId, setEntryId] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const element = fixed ?? chosen;
  const entry = entries.find((e) => e.id === entryId);
  const check = checks.find((c) => c.entry_id === entryId);
  const ampacity = entry ? block(entry).ampacity_a : null;
  const row: Row = (design[collection] ?? []).find((r) => r.id === element) ?? {};
  const H = heading;
  const empty = (
    <p className={styles.hint}>
      No {kind.toLowerCase()} entries in the Catalogue. <Link href="/catalogue/">Add one in the Catalogue</Link>
    </p>
  );
  if (entries.length === 0)
    return fixed ? (
      <section aria-label="From the Catalogue" className={styles.section}>
        <H>From the Catalogue</H>
        {empty}
      </section>
    ) : (
      empty
    );
  const patch = entry ? fromEntry(entry, catalog.schema_version, confirm) : null;
  const warnings = entry && element ? entryWarnings(entry, design, row) : [];
  return (
    <form
      aria-label="Choose from catalogue"
      className={fixed ? styles.section : styles.pick}
      onSubmit={(e) => {
        e.preventDefault();
        if (!entry || !element) return setNote("Choose an element and an entry.");
        if (!check?.usable) return setNote(`${entryId} cannot be used: ${check?.reasons.join("; ") ?? "not checked yet"}.`);
        dispatch({ type: "rowUpdated", collection, id: element, patch: patch! });
        setNote(`${element} filled from ${entryId}.${warnings.length ? ` Warning: ${warnings.join("; ")}.` : ""}`);
      }}
    >
      <H>{fixed ? "From the Catalogue" : "Choose from catalogue"}</H>
      {fixed && <p className={styles.now}>Now: {row.catalog_ref ? `from the Catalogue, ${refText(row.catalog_ref as never)}` : "typed by hand"}</p>}
      {!fixed && (
        <>
          <label htmlFor="pick-element">Element</label>
          <select id="pick-element" value={chosen} onChange={(e) => setElement(e.target.value)}>
            <option value="">Choose…</option>
            {(design[collection] ?? []).map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="pick-entry">Catalogue entry</label>
      <select id="pick-entry" value={entryId} onChange={(e) => (setEntryId(e.target.value), setNote(null))}>
        <option value="">Choose…</option>
        {entries.map((e) => (
          <option key={e.id} value={e.id}>
            {entryName(e)}
          </option>
        ))}
      </select>
      {typeof ampacity === "number" && (
        <label className={styles.check}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Also use {ampacity} A as the current limit (datasheet
          reference conditions)
        </label>
      )}
      {entry && check && !check.usable && (
        <p className={styles.caution} role="note">
          <Icon name="warn" />
          {entryId} cannot be used: {check.reasons.join("; ")}.
        </p>
      )}
      {patch && element && check?.usable && (
        <table className={styles.preview} aria-label={`What ${entryId} changes in ${element}`}>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Now</th>
              <th scope="col">Entry</th>
            </tr>
          </thead>
          <tbody>
            {entryPreview(collection, patch, row).map(([label, now, next, changes]) => (
              <tr key={label} data-changes={changes || undefined}>
                <th scope="row">{label}</th>
                <td>{now}</td>
                <td>
                  {next}
                  {changes && <span className={styles.changes}> changes</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {warnings.length > 0 && check?.usable && (
        <ul className={styles.warnings} aria-label="Entry warnings">
          {warnings.map((w) => (
            <li key={w}>
              <Icon name="warn" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <p>
        <button type="submit">Use in Project</button>
      </p>
      {note && <p role="status">{note}</p>}
    </form>
  );
}

type BankDraft = { ns: number | null; np: number | null; eta: number | null; dod: number | null; soc: number | null };
const NEW_BANK: BankDraft = { ns: null, np: null, eta: null, dod: null, soc: 1 };
const draftOf = (b: BatteryBank | null): BankDraft =>
  b
    ? {
        ns: b.series_count,
        np: b.parallel_count,
        eta: b.dc_efficiency_ratio ?? null,
        dod: b.depth_of_discharge_ratio ?? null,
        soc: b.initial_soc_ratio ?? null,
      }
    : NEW_BANK;

export function BankPick({ inverter: fixed }: { inverter?: string }) {
  const { dialog, confirm } = useConfirmDelete();
  const { design, batteryBanks } = useProject();
  const dispatch = useProjectDispatch();
  const { catalog, checks } = useCatalog();
  const modules = catalog.entries.filter((e) => e.kind === "BATTERY_MODULE" && checks.some((c) => c.entry_id === e.id && c.usable));
  const [chosen, setInv] = useState("");
  const inv = fixed ?? chosen;
  const current = batteryBanks.find((b) => b.inverter_id === inv) ?? null;
  const [entryId, setEntryId] = useState("");
  const [d, setD] = useState<BankDraft>(draftOf(current));
  const [open, setOpen] = useState(!fixed || current !== null);
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<BankDraft>) => setD({ ...d, ...patch });
  function chooseInverter(id: string) {
    setInv(id);
    setNote(null);
    setEntryId("");
    setD(draftOf(batteryBanks.find((x) => x.inverter_id === id) ?? null));
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
  // the module's nominal energy times the module count: arithmetic on entered values only
  const energy = (entryId ? modules.find((e) => e.id === entryId)?.battery_module?.energy_kwh : current?.module.energy_kwh) ?? null;
  const count = Number.isInteger(d.ns) && Number.isInteger(d.np) ? d.ns! * d.np! : null;
  const head = fixed ? <h3>Battery bank</h3> : <h2>Battery bank (advice only; not part of the network model, A2)</h2>;
  if (fixed && !open)
    return (
      <section aria-label="Battery bank" className={styles.section}>
        {head}
        <p className={styles.now}>No battery bank. A bank is advice only and not part of the network model (A2).</p>
        <p>
          <button type="button" onClick={() => setOpen(true)}>
            Add battery bank
          </button>
        </p>
      </section>
    );
  return (
    <form aria-label="Battery bank" className={fixed ? styles.section : styles.pick} onSubmit={(e) => (e.preventDefault(), save())}>
      {head}
      {fixed && <p className={styles.now}>Advice only; not part of the network model (A2).</p>}
      {!fixed && (
        <>
          <label htmlFor="bank-inverter">Inverter</label>
          <select id="bank-inverter" value={chosen} onChange={(e) => chooseInverter(e.target.value)}>
            <option value="">Choose…</option>
            {(design.inverters ?? []).map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="bank-module">Battery module</label>
      <select id="bank-module" value={entryId} onChange={(e) => chooseModule(e.target.value)}>
        <option value="">{current ? `Keep ${current.module.catalog_ref.entry_id} (copied)` : "Choose…"}</option>
        {modules.map((e) => (
          <option key={e.id} value={e.id}>
            {entryName(e)}
          </option>
        ))}
      </select>
      {modules.length === 0 && (
        <p className={styles.hint}>
          No usable battery module entries in the Catalogue. <Link href="/catalogue/">Add one in the Catalogue</Link>
        </p>
      )}
      <NumberField id="bank-ns" label="Modules in series" unit="count" step="1" value={d.ns} onChange={(v) => set({ ns: v })} />
      <NumberField id="bank-np" label="Strings in parallel" unit="count" step="1" value={d.np} onChange={(v) => set({ np: v })} />
      <NumberField id="bank-eta" label="DC efficiency η_dc, optional" unit="ratio" value={d.eta} onChange={(v) => set({ eta: v })} />
      <NumberField id="bank-dod" label="Depth of discharge, optional" unit="ratio" value={d.dod} onChange={(v) => set({ dod: v })} />
      <NumberField id="bank-soc" label="Initial state of charge, optional" unit="ratio" value={d.soc} onChange={(v) => set({ soc: v })} />
      {fixed && count !== null && typeof energy === "number" && (
        <p className={styles.total} data-testid="bank-total">
          {count} modules × {energy} kWh = {count * energy} kWh nominal
        </p>
      )}
      <p className={styles.actions}>
        <button type="submit">Save bank</button>
        {current && (
          <button
            type="button"
            onClick={() =>
              confirm(`Remove the battery bank of ${inv}?`, `The bank settings of ${inv} are removed; the inverter stays. ${CANNOT_UNDO}`, () => {
                dispatch({ type: "bankRemoved", inverterId: inv });
                setNote(`Battery bank of ${inv} removed.`);
                if (fixed) (setOpen(false), setD(NEW_BANK), setEntryId(""));
              })
            }
          >
            Remove bank
          </button>
        )}
      </p>
      {note && <p role="status">{note}</p>}
      {!fixed && batteryBanks.length > 0 && (
        <p data-testid="bank-list">
          Banks: {batteryBanks.map((b) => `${b.inverter_id}: ${b.series_count} × ${b.parallel_count} of ${b.module.catalog_ref.entry_id}`).join("; ")}
        </p>
      )}
      {dialog}
    </form>
  );
}
