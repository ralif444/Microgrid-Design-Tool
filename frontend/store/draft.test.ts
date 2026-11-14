import { afterEach, describe, expect, it } from "vitest";
import { clearDraft, DRAFT_KEY, readDraft, writeDraft } from "./draft";
import { initialState, projectReducer, type ProjectState } from "./reducer";

// Plan F3: autosave is crash recovery; run records stay out, a draft of another schema version is ignored.
const store = new Map<string, string>();
const memory = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const v = { schema_version: 3, app_version: "0.1.0" };
const open: ProjectState = {
  ...projectReducer(initialState, { type: "projectCreated", meta: { id: "p1", name: "Draft test", created_at: "2026-11-14T10:00:00Z" }, nominal_voltage_kv: 0.4, nominal_frequency_hz: 50 }),
  runRecords: [{ record_id: "r1" } as unknown as ProjectState["runRecords"][number]],
};
const withStorage = (s: unknown) => Object.defineProperty(globalThis, "localStorage", { value: s, configurable: true });

describe("autosave draft (F3)", () => {
  afterEach(() => {
    store.clear();
    withStorage(undefined);
  });

  it("writes the Project without run records and reads it back", () => {
    withStorage(memory);
    expect(writeDraft(open, v, "2026-11-14T11:00:00Z")).toBe(true);
    const d = readDraft(3)!;
    expect(d.saved_at).toBe("2026-11-14T11:00:00Z");
    expect(d.file.project.name).toBe("Draft test");
    expect(d.file.run_records).toEqual([]);
    expect(projectReducer(initialState, { type: "draftRestored", file: d.file })).toMatchObject({ unsaved: true, example: null, project: { name: "Draft test" } });
    clearDraft();
    expect(readDraft(3)).toBeNull();
  });

  it("ignores a draft of another schema version and unreadable text", () => {
    withStorage(memory);
    writeDraft(open, v);
    expect(readDraft(4)).toBeNull();
    store.set(DRAFT_KEY, "{not json");
    expect(readDraft(3)).toBeNull();
  });

  it("reports a refused write and never throws when storage is missing or full", () => {
    withStorage({ ...memory, setItem: () => { throw new DOMException("full", "QuotaExceededError"); } });
    expect(writeDraft(open, v)).toBe(false);
    withStorage(undefined);
    expect(writeDraft(open, v)).toBe(false);
    expect(readDraft(3)).toBeNull();
    expect(() => clearDraft()).not.toThrow();
  });
});
