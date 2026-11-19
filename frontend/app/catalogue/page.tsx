"use client";
// S-18 Catalogue (Doc 12 §5; FR-64 - FR-68; D-61): open, save, add, edit and delete entries with
// provenance per value; the server's guard shows which entries may be used in a Project.
// Independent of any Project, so no RequireProject. The app ships a read-only base catalogue (user
// decision 2026-11-16, replacing D-59 K107's "no entries"); the user's own entries sit beside it.
import { useState } from "react";
import { getMeta, importCatalog } from "../../api-client";
import type { CatalogEntry, FileCheckResult } from "../../api-types";
import { NO_POWER_WARNING, noPowerCapability } from "../../components/battery";
import { useCableSizingFlag } from "../../components/cable";
import { block, BLOCK_KEY, ENTRY_FIELDS, ENTRY_OPTIONS, keyValues, PROVENANCE, reasonText, useCatalog } from "../../components/Catalog";
import { downloadJson, NOT_JSON, readJson } from "../../components/files";
import { CANNOT_UNDO, useConfirmDelete } from "../../components/ConfirmDelete";
import { displayLang, translate } from "../../components/i18n";
import { useLanguage } from "../../components/Language";
import { NumberField } from "../../components/NumberField";
import { FileCheckText } from "../../components/ProjectFileMenu";
import { nextId } from "../../store/reducer";
import styles from "./catalogue.module.css";

// One caveat per screen (audit 2026-11-15, user decision 2); the source column says "recorded only".
const CAVEAT = {
  recorded: (codes: string[]) => translate(displayLang(), "Recorded only: kept with the entry, not used by the model ({codes}).", { codes: codes.join(", ") }),
  x10: "Cable sizing only: used only for the cable sizing match (experimental).",
  bess: "used only by the battery advice, not by the network model (A2)",
} as const;

function EntryEditor({ e, onChange, x10 }: { e: CatalogEntry; onChange: (e: CatalogEntry) => void; x10: boolean }) {
  const { t } = useLanguage();
  const b = block(e);
  const setValue = (k: string, v: unknown) =>
    onChange({ ...e, [BLOCK_KEY[e.kind]]: { ...b, [k]: v } });
  const setSource = (k: string, v: string) => onChange({ ...e, sources: { ...e.sources, [k]: v } });
  const text = (id: string, label: string, value: string | null | undefined, set: (v: string | null) => void) => (
    <span className={styles.text}>
      <label htmlFor={id}>{t(label)}</label>
      <input id={id} value={value ?? ""} onChange={(x) => set(x.target.value || null)} />
    </span>
  );
  const fields = ENTRY_FIELDS[e.kind].filter(([, , , use]) => x10 || use !== "x10");
  const recorded = [...new Set(fields.flatMap(([, , , use]) => (use === "A2" || use === "A4" ? [use] : [])))];
  return (
    <form aria-label={t("Entry {id}", { id: e.id })} className={styles.editor} onSubmit={(x) => x.preventDefault()}>
      <fieldset>
        <legend>{t("Provenance")}</legend>
        {PROVENANCE.map(([k, label]) => (
          <p key={k}>{text(`prov-${k}`, label, e.provenance?.[k], (v) => onChange({ ...e, provenance: { ...e.provenance, [k]: v } }))}</p>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t("Values")}</legend>
        {e.kind === "BATTERY_MODULE" && <p className={styles.caveat}>{t("All values {note}.", { note: t(CAVEAT.bess) })}</p>}
        {recorded.length > 0 && <p className={styles.caveat}>{CAVEAT.recorded(recorded)}</p>}
        {fields.some(([, , , use]) => use === "x10") && <p className={styles.caveat}>{t(CAVEAT.x10)}</p>}
        <table className={styles.values} aria-label={t("Values of {id}", { id: e.id })}>
          <thead>
            <tr>
              <th scope="col">{t("Value")}</th>
              <th scope="col">{t("Source (page or section)")}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([k, label, unit, use]) => (
              <tr key={k}>
                <td>
                  {ENTRY_OPTIONS[k] ? (
                    <span className={styles.text}>
                      <label htmlFor={`val-${k}`}>{t(label)}</label>
                      <select id={`val-${k}`} value={(b[k] as string | null) ?? ""} onChange={(x) => setValue(k, x.target.value || null)}>
                        <option value="">{t("Choose…")}</option>
                        {ENTRY_OPTIONS[k].map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </span>
                  ) : unit === null ? (
                    text(`val-${k}`, label, b[k] as string | null, (v) => setValue(k, v))
                  ) : (
                    <NumberField id={`val-${k}`} label={label} unit={unit} value={b[k] as number | null} onChange={(v) => setValue(k, v)} />
                  )}
                </td>
                <td>
                  {(use === "model" || use === "bess") && unit !== null ? (
                    <input aria-label={`${t(label)}: ${t("page or section")}`} value={e.sources?.[k] ?? ""} onChange={(x) => setSource(k, x.target.value)} />
                  ) : (
                    <span className={styles.muted}>{use === "x10" ? t("cable sizing only") : use === "text" ? "—" : t("recorded only")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {noPowerCapability(e) && <p role="note">{t(NO_POWER_WARNING)}</p>}
        {e.kind === "INVERTER" && (
          <p>
            <label>
              <input type="checkbox" checked={!!b.grid_forming} onChange={(x) => setValue("grid_forming", x.target.checked)} /> {t("Declared grid-forming in the datasheet")}
            </label>{" "}
            {text("val-gfm-ref", "Grid-forming declaration: page or section", b.grid_forming_reference as string | null, (v) =>
              setValue("grid_forming_reference", v),
            )}
          </p>
        )}
      </fieldset>
    </form>
  );
}

export default function CataloguePage() {
  const { t } = useLanguage();
  const { dialog, confirm } = useConfirmDelete();
  const { catalog, checks, checkError, setCatalog, isBase } = useCatalog();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<FileCheckResult | string | null>(null);
  const entries = catalog.entries;
  const own = entries.filter((e) => !isBase(e.id)); // the user's entries: the ones saved, opened and edited
  const sel = own.find((e) => e.id === selected) ?? null;

  // a base entry is read-only; a copy under a new id is the user's to change
  function copy(e: CatalogEntry) {
    const id = nextId("E", entries);
    setCatalog({ ...catalog, entries: [...entries, { ...structuredClone(e), id }] });
    setSelected(id);
  }
  const x10 = useCableSizingFlag() === true; // FR-105: nothing of X10 while the flag is off

  function add(kind: CatalogEntry["kind"]) {
    const id = nextId("E", entries);
    setCatalog({ ...catalog, entries: [...entries, { id, kind, provenance: {}, sources: {}, [BLOCK_KEY[kind]]: {} }] });
    setSelected(id);
  }

  async function open(file: File | undefined) {
    if (!file) return;
    const read = await readJson(file);
    if (!read) return setNote(t(NOT_JSON));
    const r = await importCatalog(read.doc);
    if (!r.ok) return setNote(r.message);
    setNote(r.data.file_check);
    const next = r.data.catalog as unknown as typeof catalog | null;
    if (!r.data.file_check.accepted || !next) return;
    const skipped = next.entries.filter((e) => isBase(e.id)).length;
    if (skipped) setNote(`${r.data.file_check.message} ${t("{skipped} of its entries are already in the base catalogue and were not added again.", { skipped })}`);
    // O7: opening a file replaces the user's entries, which the browser now keeps, so ask first when there are some
    if (own.length === 0) return void (setCatalog(next), setSelected(null));
    confirm(
      t("Replace your entries?"),
      `${t("Opening {file} replaces your entries ({own}) with its own ({next}). The base catalogue stays. Save the Catalogue first to keep your current ones.", { file: file.name, own: own.length, next: next.entries.length - skipped })} ${t(CANNOT_UNDO)}`,
      () => (setCatalog(next), setSelected(null)),
      t("Replace"),
    );
  }

  async function save() {
    const meta = await getMeta();
    if (!meta.ok) return setNote(meta.message);
    downloadJson("catalogue.mgcat.json", { ...catalog, entries: own, app_version: meta.data.app_version });
  }

  return (
    <>
      <h1>{t("Catalogue")}</h1>
      <p>
        {t("A Catalogue is its own file, separate from any Project. Values copied into a Project stay there when the Catalogue changes. Your entries are also kept in this browser until you delete them; save the Catalogue to a file to keep or share them.")}
      </p>
      {entries.length > own.length && (
        <p className={styles.caveat}>
          {t("Base entries ship with the app and cannot be edited or deleted; copy one to change it. Their values were read from the named manufacturer documents; check them against the datasheet before relying on them.")}
        </p>
      )}
      <p>
        <button type="button" onClick={() => void save()}>
          {t("Save catalogue")}
        </button>{" "}
        <label>
          {t("Open catalogue file")}{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(x) => {
              void open(x.target.files?.[0]);
              x.target.value = ""; // the same file can be opened again (O7)
            }}
          />
        </label>
      </p>
      {note && (typeof note === "string" ? <p role="alert">{note}</p> : <FileCheckText fc={note} />)}
      <p>
        <button type="button" onClick={() => add("INVERTER")}>
          {t("+ Add inverter entry")}
        </button>{" "}
        <button type="button" onClick={() => add("CONDUCTOR")}>
          {t("+ Add conductor entry")}
        </button>{" "}
        <button type="button" onClick={() => add("BATTERY_MODULE")}>
          {t("+ Add battery module entry")}
        </button>{" "}
        <button type="button" onClick={() => add("REACTOR")}>
          {t("+ Add reactor entry")}
        </button>
        {x10 && (
          <>
            {" "}
            <button type="button" onClick={() => add("BREAKER")}>
              {t("+ Add breaker entry")}
            </button>
          </>
        )}
      </p>
      {entries.length === 0 ? (
        <p>{t("The Catalogue is empty.")}</p>
      ) : (
        <table aria-label={t("Catalogue entries")} className={styles.list}>
          <thead>
            <tr>
              <th>{t("Id")}</th>
              <th>{t("Kind")}</th>
              <th>{t("Source")}</th>
              <th>{t("Manufacturer and model")}</th>
              <th>{t("Key values")}</th>
              <th>{t("Use in a Project")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const c = checks.find((x) => x.entry_id === e.id);
              return (
                <tr key={e.id} aria-current={e.id === selected ? "true" : undefined}>
                  <th scope="row">{e.id}</th>
                  <td className={styles.kind}>{t(e.kind.toLowerCase().replace("_", " "))}</td>
                  <td>{t(isBase(e.id) ? "Base" : "Yours")}</td>
                  <td>{[e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ") || "—"}</td>
                  <td className={styles.kind}>{keyValues(e)}</td>
                  <td>
                    {!c ? (
                      checkError ? t("Not checked: {error}", { error: checkError }) : t("Checking…")
                    ) : c.usable ? (
                      t("Usable")
                    ) : c.reasons.length <= 2 ? (
                      t("Information only: {reasons}", { reasons: c.reasons.map((r) => reasonText(e.kind, r)).join("; ") })
                    ) : (
                      // a long list folds away; the count says how much is left to enter
                      <details>
                        <summary>{t("Information only: {count} things to fix", { count: c.reasons.length })}</summary>
                        {c.reasons.map((r) => reasonText(e.kind, r)).join("; ")}
                      </details>
                    )}
                    {noPowerCapability(e) && ` (${t(NO_POWER_WARNING)})`}
                  </td>
                  <td>
                    {isBase(e.id) ? (
                      <button type="button" onClick={() => copy(e)}>
                        {t("Copy {id}", { id: e.id })}
                      </button>
                    ) : (
                      <>
                    <button type="button" onClick={() => setSelected(e.id)}>
                      {t("Edit {id}", { id: e.id })}
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() =>
                        confirm(t("Delete {id}?", { id: e.id }), `${t("Catalogue entry {id} is removed; designs that used it keep their values.", { id: e.id })} ${t(CANNOT_UNDO)}`, () =>
                          setCatalog({ ...catalog, entries: entries.filter((x) => x.id !== e.id) }),
                        )
                      }
                    >
                      {t("Delete {id}", { id: e.id })}
                    </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {sel && (
        <>
          <h2>
            {t("Entry {id} ({kind})", { id: sel.id, kind: t(sel.kind.toLowerCase().replace("_", " ")) })}
          </h2>
          <EntryEditor e={sel} x10={x10} onChange={(n) => setCatalog({ ...catalog, entries: entries.map((x) => (x.id === sel.id ? n : x)) })} />
        </>
      )}
      {dialog}
    </>
  );
}
