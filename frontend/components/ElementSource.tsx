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
import { useProject, useProjectDispatch, type PsParameters } from "../store";
import { valueSource } from "./battery";
import { numText } from "./format";
import { block, entryWarnings, fromEntry, refText, useCatalog } from "./Catalog";
import { CANNOT_UNDO, useConfirmDelete } from "./ConfirmDelete";
import styles from "./ElementSource.module.css";
import { INVERTER_COLUMNS, LINE_COLUMNS } from "./elementFields";
import type { Column } from "./EntityTable";
import { Icon } from "./Icon";
import { displayLang, translate } from "./i18n";
import { useLanguage } from "./Language";
import { NumberField } from "./NumberField";

type Row = Record<string, unknown>;
const LABELS = (cols: Column[]) =>
  Object.fromEntries(cols.flatMap((c) => (c.kind === "number" ? [[c.field, [c.label, c.unit]]] : [])) as [string, [string, string]][]);
const shown = (v: unknown, unit = "") => (v == null || v === "" ? "not set" : `${v}${unit ? ` ${unit}` : ""}`);
// table cells can hold these words; numbers and ids pass through translate unchanged
const tt = (s: string) => translate(displayLang(), s);

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
  const nowId = (row.catalog_ref as { entry_id?: string } | null | undefined)?.entry_id;
  return [...rows, ["Source", now, ref, nowId !== ref]];
}

const entryName = (e: CatalogEntry) => [e.id, e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ");

export function CatalogPick({ collection, element: fixed, heading = "h2" }: { collection: "lines" | "inverters"; element?: string; heading?: "h2" | "h3" }) {
  const { t } = useLanguage();
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
      {t("No {kind} entries in the Catalogue.", { kind: t(kind.toLowerCase()) })} <Link href="/catalogue/">{t("Add one in the Catalogue")}</Link>
    </p>
  );
  if (entries.length === 0)
    return fixed ? (
      <section aria-label={t("From the Catalogue")} className={styles.section}>
        <H>{t("From the Catalogue")}</H>
        {empty}
      </section>
    ) : (
      empty
    );
  const patch = entry ? fromEntry(entry, catalog.schema_version, confirm) : null;
  const warnings = entry && element ? entryWarnings(entry, design, row) : [];
  return (
    <form
      aria-label={t("Choose from catalogue")}
      className={fixed ? styles.section : styles.pick}
      onSubmit={(e) => {
        e.preventDefault();
        if (!entry || !element) return setNote(t("Choose an element and an entry."));
        if (!check?.usable) return setNote(t("{entry} cannot be used: {reasons}.", { entry: entryId, reasons: check?.reasons.map(tt).join("; ") ?? t("not checked yet") }));
        dispatch({ type: "rowUpdated", collection, id: element, patch: patch! });
        setNote(`${t("{element} filled from {entry}.", { element, entry: entryId })}${warnings.length ? ` ${t("Warning: {warnings}.", { warnings: warnings.map(tt).join("; ") })}` : ""}`);
      }}
    >
      <H>{t(fixed ? "From the Catalogue" : "Choose from catalogue")}</H>
      {fixed && (
        <p className={styles.now}>
          {t("Now: {source}", { source: row.catalog_ref ? t("from the Catalogue, {ref}", { ref: refText(row.catalog_ref as never) }) : t("typed by hand") })}
        </p>
      )}
      {!fixed && (
        <>
          <label htmlFor="pick-element">{t("Element")}</label>
          <select id="pick-element" value={chosen} onChange={(e) => setElement(e.target.value)}>
            <option value="">{t("Choose…")}</option>
            {(design[collection] ?? []).map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="pick-entry">{t("Catalogue entry")}</label>
      <select id="pick-entry" value={entryId} onChange={(e) => (setEntryId(e.target.value), setNote(null))}>
        <option value="">{t("Choose…")}</option>
        {entries.map((e) => (
          <option key={e.id} value={e.id}>
            {entryName(e)}
          </option>
        ))}
      </select>
      {typeof ampacity === "number" && (
        <label className={styles.check}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> {t("Also use {ampacity} A as the current limit (datasheet reference conditions)", { ampacity })}
        </label>
      )}
      {entry && check && !check.usable && (
        <p className={styles.caution} role="note">
          <Icon name="warn" />
          {t("{entry} cannot be used: {reasons}.", { entry: entryId, reasons: check.reasons.map(tt).join("; ") })}
        </p>
      )}
      {patch && element && check?.usable && (
        <table className={styles.preview} aria-label={t("What {entry} changes in {element}", { entry: entryId, element })}>
          <thead>
            <tr>
              <th scope="col">{t("Field")}</th>
              <th scope="col">{t("Now")}</th>
              <th scope="col">{t("Entry")}</th>
            </tr>
          </thead>
          <tbody>
            {entryPreview(collection, patch, row).map(([label, now, next, changes]) => (
              <tr key={label} data-changes={changes || undefined}>
                <th scope="row">{t(label)}</th>
                <td>{tt(now)}</td>
                <td>
                  {tt(next)}
                  {changes && <span className={styles.changes}> {t("changes")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {warnings.length > 0 && check?.usable && (
        <ul className={styles.warnings} aria-label={t("Entry warnings")}>
          {warnings.map((w) => (
            <li key={w}>
              <Icon name="warn" />
              {tt(w)}
            </li>
          ))}
        </ul>
      )}
      <p>
        <button type="submit">{t("Use in Project")}</button>
      </p>
      {note && <p role="status">{note}</p>}
    </form>
  );
}

type BankDraft = { ns: number | null; np: number | null; eta: number | null; dod: number | null; soc: number | null };
const NEW_BANK: BankDraft = { ns: null, np: null, eta: null, dod: null, soc: 1 };
// A new bank pre-fills η_dc and DoD from the latest Sizing settings (audit 2026-11-15, user decision 1).
const draftOf = (b: BatteryBank | null, sizing?: PsParameters): BankDraft =>
  b
    ? {
        ns: b.series_count,
        np: b.parallel_count,
        eta: b.dc_efficiency_ratio ?? null,
        dod: b.depth_of_discharge_ratio ?? null,
        soc: b.initial_soc_ratio ?? null,
      }
    : { ...NEW_BANK, eta: sizing?.dc_efficiency_ratio ?? null, dod: sizing?.depth_of_discharge_ratio ?? null };

export function BankPick({ inverter: fixed }: { inverter?: string }) {
  const { t } = useLanguage();
  const { dialog, confirm } = useConfirmDelete();
  const { design, batteryBanks, sizingAdvice } = useProject();
  const dispatch = useProjectDispatch();
  const { catalog, checks } = useCatalog();
  const sizing = sizingAdvice.at(-1)?.ps_parameters;
  const modules = catalog.entries.filter((e) => e.kind === "BATTERY_MODULE" && checks.some((c) => c.entry_id === e.id && c.usable));
  const [chosen, setInv] = useState(fixed ? "" : (batteryBanks[0]?.inverter_id ?? ""));
  const inv = fixed ?? chosen;
  const current = batteryBanks.find((b) => b.inverter_id === inv) ?? null;
  const [entryId, setEntryId] = useState("");
  const [d, setD] = useState<BankDraft>(draftOf(current, sizing));
  const [open, setOpen] = useState(!fixed || current !== null);
  const [note, setNote] = useState<string | null>(null);
  const set = (patch: Partial<BankDraft>) => setD((d) => ({ ...d, ...patch }));
  function chooseInverter(id: string) {
    setInv(id);
    setNote(null);
    setEntryId("");
    setD(draftOf(batteryBanks.find((x) => x.inverter_id === id) ?? null, sizing));
  }
  function chooseModule(id: string) {
    setEntryId(id);
    const dod = modules.find((e) => e.id === id)?.battery_module?.recommended_dod_ratio;
    if (dod != null) set({ dod });
  }
  function save() {
    const entry = modules.find((e) => e.id === entryId);
    if (!inv) return setNote(t("Choose an inverter."));
    if (!entry && !current) return setNote(t("Choose a battery module from the Catalogue."));
    if (!Number.isInteger(d.ns) || !Number.isInteger(d.np)) return setNote(t("Enter whole numbers for the series and parallel counts."));
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
    setNote(t("Battery bank of {inv} saved.", { inv }));
  }
  // the module's nominal energy times the module count: arithmetic on entered values only
  const energy = (entryId ? modules.find((e) => e.id === entryId)?.battery_module?.energy_kwh : current?.module.energy_kwh) ?? null;
  const count = Number.isInteger(d.ns) && Number.isInteger(d.np) ? d.ns! * d.np! : null;
  const modDod = catalog.entries.find((e) => e.id === (entryId || current?.module.catalog_ref.entry_id))?.battery_module?.recommended_dod_ratio;
  const src = [
    ["η_dc", valueSource(d.eta, sizing?.dc_efficiency_ratio)],
    ["DoD", valueSource(d.dod, sizing?.depth_of_discharge_ratio, modDod)],
  ].flatMap(([k, v]) => (v && v !== "entered on the bank" ? [t("{k} from {v}", { k: String(k), v: t(String(v)) })] : []));
  const sourceHint = src.length ? `${src.join("; ")}. ${t("Change a value here to override it for this bank.")}` : null;
  // O2: say so while the form holds changes that Save bank has not stored yet
  const unsaved = current
    ? entryId !== "" || JSON.stringify(d) !== JSON.stringify(draftOf(current))
    : entryId !== "" || d.ns !== null || d.np !== null;
  const head = fixed ? <h3>{t("Battery bank")}</h3> : <h2>{t("Battery bank (advice only; not part of the network model, A2)")}</h2>;
  if (fixed && !open)
    return (
      <section aria-label={t("Battery bank")} className={styles.section}>
        {head}
        <p className={styles.now}>{t("No battery bank. A bank is advice only and not part of the network model (A2).")}</p>
        <p>
          <button type="button" onClick={() => setOpen(true)}>
            {t("Add battery bank")}
          </button>
        </p>
      </section>
    );
  return (
    <form aria-label={t("Battery bank")} className={fixed ? styles.section : styles.pick} onSubmit={(e) => (e.preventDefault(), save())}>
      {head}
      {fixed && <p className={styles.now}>{t("Advice only; not part of the network model (A2).")}</p>}
      {!fixed && (
        <>
          <label htmlFor="bank-inverter">{t("Inverter")}</label>
          <select id="bank-inverter" value={chosen} onChange={(e) => chooseInverter(e.target.value)}>
            <option value="">{t("Choose…")}</option>
            {(design.inverters ?? []).map((r) => (
              <option key={r.id}>{r.id}</option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="bank-module">{t("Battery module")}</label>
      <select id="bank-module" value={entryId} onChange={(e) => chooseModule(e.target.value)}>
        <option value="">{current ? t("Keep {entry} (copied)", { entry: current.module.catalog_ref.entry_id }) : t("Choose…")}</option>
        {modules.map((e) => (
          <option key={e.id} value={e.id}>
            {entryName(e)}
          </option>
        ))}
      </select>
      {modules.length === 0 && (
        <p className={styles.hint}>
          {t("No usable battery module entries in the Catalogue.")} <Link href="/catalogue/">{t("Add one in the Catalogue")}</Link>
        </p>
      )}
      <NumberField id="bank-ns" label="Modules in series" unit="count" step="1" value={d.ns} onChange={(v) => set({ ns: v })} />
      <NumberField id="bank-np" label="Strings in parallel" unit="count" step="1" value={d.np} onChange={(v) => set({ np: v })} />
      <NumberField id="bank-eta" label="DC efficiency η_dc" unit="ratio" value={d.eta} onChange={(v) => set({ eta: v })} />
      <NumberField id="bank-dod" label="Depth of discharge" unit="ratio" value={d.dod} onChange={(v) => set({ dod: v })} />
      {sourceHint && <p className={styles.hint} data-testid="bank-source">{sourceHint}</p>}
      <NumberField id="bank-soc" label="Initial state of charge, optional" unit="ratio" value={d.soc} onChange={(v) => set({ soc: v })} />
      {fixed && count !== null && typeof energy === "number" && (
        <p className={styles.total} data-testid="bank-total">
          {t("{count} modules × {energy} kWh = {total} kWh nominal", { count, energy, total: numText(count * energy) })}
        </p>
      )}
      <p className={styles.actions}>
        <button type="submit">{t("Save bank")}</button>
        {unsaved && <span className={styles.hint} data-testid="bank-unsaved">{t("Not saved yet.")}</span>}
        {current && (
          <button
            type="button"
            onClick={() =>
              confirm(t("Remove the battery bank of {inv}?", { inv }), `${t("The bank settings of {inv} are removed; the inverter stays.", { inv })} ${t(CANNOT_UNDO)}`, () => {
                dispatch({ type: "bankRemoved", inverterId: inv });
                setNote(t("Battery bank of {inv} removed.", { inv }));
                if (fixed) (setOpen(false), setD(draftOf(null, sizing)), setEntryId(""));
              })
            }
          >
            {t("Remove bank")}
          </button>
        )}
      </p>
      {note && <p role="status">{note}</p>}
      {!fixed && batteryBanks.length > 0 && (
        <p data-testid="bank-list">
          {t("Banks: {banks}", { banks: batteryBanks.map((b) => t("{inv}: {ns} × {np} of {entry}", { inv: b.inverter_id, ns: b.series_count, np: b.parallel_count, entry: b.module.catalog_ref.entry_id })).join("; ") })}
        </p>
      )}
      {dialog}
    </form>
  );
}
