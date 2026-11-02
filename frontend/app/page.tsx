"use client";
// S-01 Start (Doc 7 §2): create a new Project (FR-01) or open a Project file (header, D-47 K17),
// or open an example Project as a new unsaved copy (Doc 12 FR-85).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getExample, importProject } from "../api-client";
import type { ProjectFile } from "../api-types";
import { NumberField } from "../components/NumberField";
import { UNSAVED_CONFIRM } from "../components/ProjectFileMenu";
import { useProject, useProjectDispatch } from "../store";

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

  async function openExample(key: string) {
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
    router.push("/project/");
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
    router.push("/project/");
  }

  return (
    <>
      <h1>Microgrid design tool</h1>
      <p>Stage 1.2: the calculation engine is the Fake Engine; results are placeholders.</p>
      <p>To continue earlier work, use “Open project file” in the header.</p>
      {project && (
        <p>
          Open Project: <Link href="/project/">{project.name}</Link>
        </p>
      )}
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
