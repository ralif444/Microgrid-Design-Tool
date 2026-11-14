"use client";
// Save / Open of the Project file (FR-54, FR-55, FR-57; Doc 9 D-47 K14, K17). A refused file
// leaves the open Project as it was (NFR-16).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getMeta, importProject } from "../api-client";
import type { FileCheckResult, MetaInfo, ProjectFile } from "../api-types";
import { toProjectFile, useProject, useProjectDispatch } from "../store";
import { clearDraft, writeDraft } from "../store/draft";
import { downloadJson, NOT_JSON, readJson } from "./files";
import styles from "./ui.module.css";

export const UNSAVED_CONFIRM = 
  "The open Project has unsaved changes. OK to discard them; Cancel to keep them (then Save first)."; // D-48 K23

export const AUTOSAVE_OFF = "Autosave is off: this browser refused local storage. Use Save to keep your work.";
const AUTOSAVE_DELAY_MS = 1000;

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

  // Autosave (plan F3): crash recovery only; Save and the unsaved flag keep their meaning. A saved or
  // freshly loaded Project clears the draft; example mode is never autosaved.
  const versions = useRef<MetaInfo | null>(null);
  const warned = useRef(false);
  useEffect(() => {
    if (!state.project) return; // start-up: keep the draft for the restore offer on S-01
    if (state.example || !state.unsaved) return clearDraft();
    const t = setTimeout(async () => {
      if (!versions.current) {
        const m = await getMeta();
        if (!m.ok) return;
        versions.current = m.data;
      }
      if (!writeDraft(state, versions.current) && !warned.current) {
        warned.current = true;
        setNote(AUTOSAVE_OFF);
      }
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [state]);

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
    <span className={styles.fileMenu}>
      {state.project && (
        <button type="button" onClick={() => void save()}>
          Save
        </button>
      )}
      {/* The native file input stays in the tab order; the label is drawn as a button. */}
      <label className={styles.fileButton}>
        Open project file
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void open(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {note && <span className={styles.fileNote}>{typeof note === "string" ? <span role="status" data-testid="file-check">{note}</span> : <FileCheckText fc={note} />}</span>}
    </span>
  );
}
