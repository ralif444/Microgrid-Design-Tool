// Browser autosave (plan F3; manuscript 4.3.1, Doc 4 §3, Doc 7 S-01 and §7): crash recovery only, never a
// saved Project. The draft is the Project file without run records (results are re-runnable), so a
// restore goes through the same file check as Open. Every storage call is wrapped: a private window
// or a full quota turns autosave off, nothing else.
import type { ProjectFile } from "../api-types";
import { toProjectFile } from "./projectFile";
import type { ProjectState } from "./reducer";

export const DRAFT_KEY = "mgapp-draft";
export type Draft = { saved_at: string; file: ProjectFile };
type Versions = { schema_version: number; app_version: string };

/** Writes the draft; false when storage refused it. */
export function writeDraft(s: ProjectState, versions: Versions, now = new Date().toISOString()): boolean {
  try {
    const draft: Draft = { saved_at: now, file: toProjectFile({ ...s, runRecords: [] }, versions, now) };
    globalThis.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

/** The stored draft, or null when there is none, it is unreadable, or it has another schema version. */
export function readDraft(schemaVersion: number): Draft | null {
  try {
    const d = JSON.parse(globalThis.localStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
    return d?.file?.schema_version === schemaVersion && typeof d.saved_at === "string" ? d : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    globalThis.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}
