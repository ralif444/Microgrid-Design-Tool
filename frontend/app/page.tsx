"use client";
// S-01 Start (Doc 7 §2): create a new Project (FR-01). Opening a Project file arrives in WP 1.2.3.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NumberField } from "../components/NumberField";
import { useProject, useProjectDispatch } from "../store";

export default function Home() {
  const { project } = useProject();
  const dispatch = useProjectDispatch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [kv, setKv] = useState<number | null>(null); // no default (Doc 3 §3.1)
  const [hz, setHz] = useState<number | null>(50); // default 50, editable (Doc 3 §3.1)

  function create(e: React.FormEvent) {
    e.preventDefault();
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
    </>
  );
}
