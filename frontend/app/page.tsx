"use client";
// S-01 Start (Doc 7 §2): create a new Project (FR-01) or open a Project file (header, D-47 K17),
// or open an example Project as a new unsaved copy (Doc 12 FR-85), or the guided example D2, which also
// enters example mode (Doc 12 X9, FR-99); the action is hidden when its settings file is missing or invalid.
// With no Project open, an autosave draft is offered for restore (plan F3; Doc 7 S-01): it goes through
// the same file check as Open and stays unsaved.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getExample, getExampleSettings, getMeta, importProject } from "../api-client";
import type { ProjectFile } from "../api-types";
import { clearDraft, readDraft, type Draft } from "../store/draft";
import { parseExampleSettings, type ExampleSettings } from "../store/example";
import { CANNOT_UNDO, useConfirmDelete } from "../components/ConfirmDelete";
import { Icon } from "../components/Icon";
import { NumberField } from "../components/NumberField";
import uiStyles from "../components/ui.module.css";
import { UNSAVED_CONFIRM } from "../components/ProjectFileMenu";
import { useProject, useProjectDispatch } from "../store";
import { HOME } from "../components/PipelineStepper";

// Doc 13 §4 reference designs (prototype values until WP 1.6.1).
const EXAMPLES: [string, string][] = [
  ["d1", "D1: one inverter, 20 kW + 8 kvar"],
  ["d2", "D2: two inverters with different droop gains, 25 kW + 10 kvar"],
  ["d2s", "D2S: D2 stressed, 60 kW + 24 kvar"],
  ["d2h", "D2H: D2 near the limit, 100 kW + 40 kvar"],
];

export default function Home() {
  const { project, unsaved } = useProject();
  const dispatch = useProjectDispatch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [kv, setKv] = useState<number | null>(null); // no default (Doc 3 §3.1)
  const [hz, setHz] = useState<number | null>(50); // default 50, editable (Doc 3 §3.1)
  const [note, setNote] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [guided, setGuided] = useState<ExampleSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { dialog, confirm } = useConfirmDelete();
  useEffect(() => {
    void getMeta().then((m) => {
      setEngine(m.ok ? m.data.engine.engine_kind : null);
      if (m.ok && !project) setDraft(readDraft(m.data.schema_version));
    });
    void getExampleSettings("guided-d2").then((s) => setGuided(s.ok ? parseExampleSettings(s.data) : null));
  }, []);

  async function openExample(key: string, settings?: ExampleSettings) {
    if (unsaved && !window.confirm(UNSAVED_CONFIRM)) return;
    const file = await getExample(key);
    const r = file.ok ? await importProject(file.data) : file;
    if (!r.ok) return setNote(r.message);
    if (!r.data.file_check.accepted || !r.data.project) return setNote(r.data.file_check.message);
    dispatch({
      type: "exampleOpened",
      file: r.data.project as unknown as ProjectFile,
      id: crypto.randomUUID().replaceAll("-", ""),
      created_at: new Date().toISOString(),
    });
    if (settings) dispatch({ type: "exampleEntered", settings });
    router.push(HOME);
  }

  async function restore(d: Draft) {
    const r = await importProject(d.file);
    if (!r.ok) return setNote(r.message);
    if (!r.data.file_check.accepted || !r.data.project) return setNote(r.data.file_check.message);
    dispatch({ type: "draftRestored", file: r.data.project as unknown as ProjectFile });
    router.push(HOME);
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (unsaved && !window.confirm(UNSAVED_CONFIRM)) return;
    dispatch({
      type: "projectCreated",
      meta: {
        id: crypto.randomUUID().replaceAll("-", ""),
        name: name.trim(),
        created_at: new Date().toISOString(),
      },
      nominal_voltage_kv: kv,
      nominal_frequency_hz: hz,
    });
    router.push(HOME);
  }

  return (
    <>
      <h1>Microgrid design tool</h1>
      {engine === "FAKE" && <p>The calculation engine is the Fake Engine; results are placeholders.</p>}
      <p>To continue earlier work, use “Open project file” in the header.</p>
      {project && (
        <p>
          Open Project: <Link href={HOME}>{project.name}</Link>
        </p>
      )}
      {draft && !project && (
        <section aria-label="Unsaved work" className={uiStyles.blocked}>
          <Icon name="clock" />
          <p className={uiStyles.draftText}>
            Unsaved work from {new Date(draft.saved_at).toLocaleString()}: {draft.file.project.name}. It was kept in this browser, not saved to a
            file; results are not kept, run them again.
          </p>
          <span>
            <button type="button" className="primary" onClick={() => void restore(draft)}>
              Restore unsaved work
            </button>{" "}
            <button
              type="button"
              onClick={() =>
                confirm("Discard unsaved work?", `The unsaved work on ${draft.file.project.name} is removed from this browser. ${CANNOT_UNDO}`, () => {
                  clearDraft();
                  setDraft(null);
                })
              }
            >
              Discard
            </button>
          </span>
        </section>
      )}
      {dialog}
      <form onSubmit={create} aria-label="New project">
        <h2>New project</h2>
        <p>
          <label htmlFor="name">Project name</label>{" "}
          <input id="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </p>
        <p>
          <NumberField id="kv" label="Nominal voltage, line-to-line" unit="kV" value={kv} onChange={setKv} />
        </p>
        <p>
          <NumberField id="hz" label="Nominal frequency" unit="Hz" value={hz} onChange={setHz} />
        </p>
        <button type="submit">Create project</button>
        {project && <span> (replaces the open Project)</span>}
      </form>
      <section aria-label="Example projects">
        <h2>Example projects</h2>
        {guided && (
          <div>
            <button type="button" className="primary" onClick={() => void openExample(guided.project, guided)}>
              Open guided example (D2)
            </button>
            <p>Every screen is pre-filled. Press Run on each step to see the whole pipeline.</p>
          </div>
        )}
        <p>Reference designs of the validation plan (prototype values, to be confirmed). Opening one makes a new unsaved copy.</p>
        <ul>
          {EXAMPLES.map(([key, label]) => (
            <li key={key}>
              <button type="button" onClick={() => void openExample(key)}>
                Open example {label}
              </button>
            </li>
          ))}
        </ul>
        {note && <p role="alert">{note}</p>}
      </section>
    </>
  );
}
