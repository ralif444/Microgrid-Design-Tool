"use client";
// S-18 Catalogue (Doc 12 §5; FR-64 - FR-68; D-61): open, save, add, edit and delete entries with
// provenance per value; the server's guard shows which entries may be used in a Project.
// Independent of any Project, so no RequireProject. The app ships no entries (D-59 K107).
import { useState } from "react";
import { getMeta, importCatalog } from "../../api-client";
import type { CatalogEntry, FileCheckResult } from "../../api-types";
import { NO_POWER_WARNING, noPowerCapability } from "../../components/battery";
import { useCableSizingFlag } from "../../components/cable";
import { block, BLOCK_KEY, ENTRY_FIELDS, ENTRY_OPTIONS, keyValues, PROVENANCE, reasonText, useCatalog } from "../../components/Catalog";
import { downloadJson, NOT_JSON, readJson } from "../../components/files";
import { CANNOT_UNDO, useConfirmDelete } from "../../components/ConfirmDelete";
import { NumberField } from "../../components/NumberField";
import { FileCheckText } from "../../components/ProjectFileMenu";
import { nextId } from "../../store/reducer";
import styles from "./catalogue.module.css";

// One caveat per screen (audit 2026-11-15, user decision 2); the source column says "recorded only".
const CAVEAT = {
  recorded: (codes: string[]) => `Recorded only: kept with the entry, not used by the model (${codes.join(", ")}).`,
  x10: "Cable sizing only: used only for the cable sizing match (experimental).",
  bess: "used only by the battery advice, not by the network model (A2)",
} as const;

function EntryEditor({ e, onChange, x10 }: { e: CatalogEntry; onChange: (e: CatalogEntry) => void; x10: boolean }) {
  const b = block(e);
  const setValue = (k: string, v: unknown) =>
    onChange({ ...e, [BLOCK_KEY[e.kind]]: { ...b, [k]: v } });
  const setSource = (k: string, v: string) => onChange({ ...e, sources: { ...e.sources, [k]: v } });
  const text = (id: string, label: string, value: string | null | undefined, set: (v: string | null) => void) => (
    <span className={styles.text}>
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value ?? ""} onChange={(x) => set(x.target.value || null)} />
    </span>
  );
  const fields = ENTRY_FIELDS[e.kind].filter(([, , , use]) => x10 || use !== "x10");
  const recorded = [...new Set(fields.flatMap(([, , , use]) => (use === "A2" || use === "A4" ? [use] : [])))];
  return (
    <form aria-label={`Entry ${e.id}`} className={styles.editor} onSubmit={(x) => x.preventDefault()}>
      <fieldset>
        <legend>Provenance</legend>
        {PROVENANCE.map(([k, label]) => (
          <p key={k}>{text(`prov-${k}`, label, e.provenance?.[k], (v) => onChange({ ...e, provenance: { ...e.provenance, [k]: v } }))}</p>
        ))}
      </fieldset>
      <fieldset>
        <legend>Values</legend>
        {e.kind === "BATTERY_MODULE" && <p className={styles.caveat}>All values {CAVEAT.bess}.</p>}
        {recorded.length > 0 && <p className={styles.caveat}>{CAVEAT.recorded(recorded)}</p>}
        {fields.some(([, , , use]) => use === "x10") && <p className={styles.caveat}>{CAVEAT.x10}</p>}
        <table className={styles.values} aria-label={`Values of ${e.id}`}>
          <thead>
            <tr>
              <th scope="col">Value</th>
              <th scope="col">Source (page or section)</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(([k, label, unit, use]) => (
              <tr key={k}>
                <td>
                  {ENTRY_OPTIONS[k] ? (
                    <span className={styles.text}>
                      <label htmlFor={`val-${k}`}>{label}</label>
                      <select id={`val-${k}`} value={(b[k] as string | null) ?? ""} onChange={(x) => setValue(k, x.target.value || null)}>
                        <option value="">Choose…</option>
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
                    <input aria-label={`${label}: page or section`} value={e.sources?.[k] ?? ""} onChange={(x) => setSource(k, x.target.value)} />
                  ) : (
                    <span className={styles.muted}>{use === "x10" ? "cable sizing only" : use === "text" ? "—" : "recorded only"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {noPowerCapability(e) && <p role="note">{NO_POWER_WARNING}</p>}
        {e.kind === "INVERTER" && (
          <p>
            <label>
              <input type="checkbox" checked={!!b.grid_forming} onChange={(x) => setValue("grid_forming", x.target.checked)} /> Declared
              grid-forming in the datasheet
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
  const { dialog, confirm } = useConfirmDelete();
  const { catalog, checks, setCatalog } = useCatalog();
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<FileCheckResult | string | null>(null);
  const entries = catalog.entries;
  const sel = entries.find((e) => e.id === selected) ?? null;
  const x10 = useCableSizingFlag() === true; // FR-105: nothing of X10 while the flag is off

  function add(kind: CatalogEntry["kind"]) {
    const id = nextId("E", entries);
    setCatalog({ ...catalog, entries: [...entries, { id, kind, provenance: {}, sources: {}, [BLOCK_KEY[kind]]: {} }] });
    setSelected(id);
  }

  async function open(file: File | undefined) {
    if (!file) return;
    const read = await readJson(file);
    if (!read) return setNote(NOT_JSON);
    const r = await importCatalog(read.doc);
    if (!r.ok) return setNote(r.message);
    setNote(r.data.file_check);
    if (r.data.file_check.accepted && r.data.catalog) setCatalog(r.data.catalog as unknown as typeof catalog);
  }

  async function save() {
    const meta = await getMeta();
    if (!meta.ok) return setNote(meta.message);
    downloadJson("catalogue.mgcat.json", { ...catalog, app_version: meta.data.app_version });
  }

  return (
    <>
      <h1>Catalogue</h1>
      <p>
        A Catalogue is its own file, separate from any Project. Values copied into a Project stay there when the Catalogue
        changes. The entries are also kept in this browser until you delete them; save the Catalogue to a file to keep or share it.
      </p>
      <p>
        <button type="button" onClick={() => void save()}>
          Save catalogue
        </button>{" "}
        <label>
          Open catalogue file{" "}
          <input type="file" accept=".json,application/json" onChange={(x) => void open(x.target.files?.[0])} />
        </label>
      </p>
      {note && (typeof note === "string" ? <p role="alert">{note}</p> : <FileCheckText fc={note} />)}
      <p>
        <button type="button" onClick={() => add("INVERTER")}>
          + Add inverter entry
        </button>{" "}
        <button type="button" onClick={() => add("CONDUCTOR")}>
          + Add conductor entry
        </button>{" "}
        <button type="button" onClick={() => add("BATTERY_MODULE")}>
          + Add battery module entry
        </button>
        {x10 && (
          <>
            {" "}
            <button type="button" onClick={() => add("BREAKER")}>
              + Add breaker entry
            </button>
          </>
        )}
      </p>
      {entries.length === 0 ? (
        <p>The Catalogue is empty.</p>
      ) : (
        <table aria-label="Catalogue entries" className={styles.list}>
          <thead>
            <tr>
              <th>Id</th>
              <th>Kind</th>
              <th>Manufacturer and model</th>
              <th>Key values</th>
              <th>Use in a Project</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const c = checks.find((x) => x.entry_id === e.id);
              return (
                <tr key={e.id} aria-current={e.id === selected ? "true" : undefined}>
                  <th scope="row">{e.id}</th>
                  <td className={styles.kind}>{e.kind.toLowerCase().replace("_", " ")}</td>
                  <td>{[e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ") || "—"}</td>
                  <td className={styles.kind}>{keyValues(e)}</td>
                  <td>
                    {!c ? (
                      "Checking…"
                    ) : c.usable ? (
                      "Usable"
                    ) : c.reasons.length <= 2 ? (
                      `Information only: ${c.reasons.map((r) => reasonText(e.kind, r)).join("; ")}`
                    ) : (
                      // a long list folds away; the count says how much is left to enter
                      <details>
                        <summary>Information only: {c.reasons.length} things to fix</summary>
                        {c.reasons.map((r) => reasonText(e.kind, r)).join("; ")}
                      </details>
                    )}
                    {noPowerCapability(e) && ` (${NO_POWER_WARNING})`}
                  </td>
                  <td>
                    <button type="button" onClick={() => setSelected(e.id)}>
                      Edit {e.id}
                    </button>{" "}
                    <button
                      type="button"
                      onClick={() =>
                        confirm(`Delete ${e.id}?`, `Catalogue entry ${e.id} is removed; designs that used it keep their values. ${CANNOT_UNDO}`, () =>
                          setCatalog({ ...catalog, entries: entries.filter((x) => x.id !== e.id) }),
                        )
                      }
                    >
                      Delete {e.id}
                    </button>
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
            Entry {sel.id} ({sel.kind.toLowerCase().replace("_", " ")})
          </h2>
          <EntryEditor e={sel} x10={x10} onChange={(n) => setCatalog({ ...catalog, entries: entries.map((x) => (x.id === sel.id ? n : x)) })} />
        </>
      )}
      {dialog}
    </>
  );
}
