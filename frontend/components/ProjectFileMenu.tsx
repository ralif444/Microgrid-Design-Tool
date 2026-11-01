"use client";
// Save / Open of the Project file (FR-54, FR-55, FR-57; Doc 9 D-47 K14, K17). A refused file
// leaves the open Project as it was (NFR-16).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMeta, importProject } from "../api-client";
import type { FileCheckResult, ProjectFile } from "../api-types";
import { toProjectFile, useProject, useProjectDispatch } from "../store";
import { downloadJson, NOT_JSON, readJson } from "./files";

export const UNSAVED_CONFIRM = 
  "The open Project has unsaved changes. OK to discard them; Cancel to keep them (then Save first)."; // D-48 K23

export function FileCheckText({ fc }: { fc: FileCheckResult }) {
  return (
    <span role="status" data-testid="file-check">
      {fc.message}
      {(fc.details ?? []).length > 0 && (
        <ul>
          {(fc.details ?? []).map((d) => (
            <li key={d.path}>
              {d.path}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

export function ProjectFileMenu() {
  const state = useProject();
  const dispatch = useProjectDispatch();
  const router = useRouter();
  const [note, setNote] = useState<FileCheckResult | string | null>(null);

  useEffect(() => {
    if (!state.unsaved) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [state.unsaved]);

  async function save() {
    const meta = await getMeta();
    if (!meta.ok) return setNote(meta.message);
    const now = new Date().toISOString();
    const file = toProjectFile(state, meta.data, now);
    downloadJson(`${file.project.name}.mgproj.json`, file);
    dispatch({ type: "projectSaved", modified_at: now });
    setNote(null);
  }

  async function open(file: File | undefined) {
    if (!file) return;
    if (state.unsaved && !window.confirm(UNSAVED_CONFIRM)) return;
    const read = await readJson(file);
    if (!read) return setNote(NOT_JSON);
    const r = await importProject(read.doc);
    if (!r.ok) return setNote(r.message);
    setNote(r.data.file_check);
    if (!r.data.file_check.accepted || !r.data.project) return;
    dispatch({ type: "projectLoaded", file: r.data.project as unknown as ProjectFile });
    router.push("/project/");
  }

  return (
    <span className="file-menu">
      {state.project && (
        <button type="button" onClick={() => void save()}>
          Save
        </button>
      )}{" "}
      <label>
        Open project file{" "}
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {note && (typeof note === "string" ? <span role="status" data-testid="file-check">{note}</span> : <FileCheckText fc={note} />)}
    </span>
  );
}
