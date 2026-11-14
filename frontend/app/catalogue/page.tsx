"use client";
// S-18 Catalogue (Doc 12 §5; FR-64 - FR-68; D-61): open, save, add, edit and delete entries with
// provenance per value; the server's guard shows which entries may be used in a Project.
// Independent of any Project, so no RequireProject. The app ships no entries (D-59 K107).
import { useState } from "react";
import { getMeta, importCatalog } from "../../api-client";
import type { CatalogEntry, FileCheckResult } from "../../api-types";
import { NO_POWER_WARNING, noPowerCapability } from "../../components/battery";
import { useCableSizingFlag } from "../../components/cable";
import { block, BLOCK_KEY, ENTRY_FIELDS, ENTRY_OPTIONS, useCatalog } from "../../components/Catalog";
import { downloadJson, NOT_JSON, readJson } from "../../components/files";
import { CANNOT_UNDO, useConfirmDelete } from "../../components/ConfirmDelete";
import { NumberField } from "../../components/NumberField";
import { FileCheckText } from "../../components/ProjectFileMenu";
import { nextId } from "../../store/reducer";

const PROVENANCE: [keyof NonNullable<CatalogEntry["provenance"]>, string][] = [
  ["manufacturer", "Manufacturer"],
  ["model", "Model"],
  ["document", "Datasheet title or document id"],
  ["revision", "Revision or date"],
];
const UNUSED = {
  A2: "not used by the model (A2)",
  A4: "not used by the model (A4)",
  x10: "used only for the cable sizing match (experimental)",
  bess: "used only by the battery advice, not by the network model (A2)",
} as const;

function EntryEditor({ e, onChange, x10 }: { e: CatalogEntry; onChange: (e: CatalogEntry) => void; x10: boolean }) {
  const b = block(e);
  const setValue = (k: string, v: unknown) =>
    onChange({ ...e, [BLOCK_KEY[e.kind]]: { ...b, [k]: v } });
  const setSource = (k: string, v: string) => onChange({ ...e, sources: { ...e.sources, [k]: v } });
  const text = (id: string, label: string, value: string | null | undefined, set: (v: string | null) => void) => (
    <>
      <label htmlFor={id}>{label}</label> <input id={id} value={value ?? ""} onChange={(x) => set(x.target.value || null)} />
    </>
  );
  return (
    <form aria-label={`Entry ${e.id}`} onSubmit={(x) => x.preventDefault()}>
      <fieldset>
        <legend>Provenance</legend>
        {PROVENANCE.map(([k, label]) => (
          <p key={k}>{text(`prov-${k}`, label, e.provenance?.[k], (v) => onChange({ ...e, provenance: { ...e.provenance, [k]: v } }))}</p>
        ))}
      </fieldset>
      <fieldset>
        <legend>Values</legend>
        {ENTRY_FIELDS[e.kind].filter(([, , , use]) => x10 || use !== "x10").map(([k, label, unit, use]) => (
          <p key={k}>
            {ENTRY_OPTIONS[k] ? (
              <>
                <label htmlFor={`val-${k}`}>{label}</label>{" "}
                <select id={`val-${k}`} value={(b[k] as string | null) ?? ""} onChange={(x) => setValue(k, x.target.value || null)}>
                  <option value="">(choose)</option>
                  {ENTRY_OPTIONS[k].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </>
            ) : unit === null
              ? text(`val-${k}`, label, b[k] as string | null, (v) => setValue(k, v))
              : <NumberField id={`val-${k}`} label={label} unit={unit} value={b[k] as number | null} onChange={(v) => setValue(k, v)} />}
            {(use === "model" || use === "bess") && unit !== null && <> {text(`src-${k}`, `${label}: page or section`, e.sources?.[k], (v) => setSource(k, v ?? ""))}</>}
            {(use === "A2" || use === "A4" || use === "x10" || use === "bess") && <em> {UNUSED[use]}</em>}
          </p>
        ))}
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
        changes.
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
        <table aria-label="Catalogue entries">
          <thead>
            <tr>
              <th>Id</th>
              <th>Kind</th>
              <th>Manufacturer and model</th>
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
                  <td>{e.kind.toLowerCase().replace("_", " ")}</td>
                  <td>{[e.provenance?.manufacturer, e.provenance?.model].filter(Boolean).join(" ") || "—"}</td>
                  <td>
                    {!c ? "checking…" : c.usable ? "usable" : `information only: ${c.reasons.join("; ")}`}
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
