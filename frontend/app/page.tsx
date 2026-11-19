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
import { clearDraft, DRAFT_REPLACE, readDraft, type Draft } from "../store/draft";
import { parseExampleSettings, type ExampleSettings } from "../store/example";
import { useConfirmDelete } from "../components/ConfirmDelete";
import { Icon } from "../components/Icon";
import { useLanguage } from "../components/Language";
import { NumberField } from "../components/NumberField";
import uiStyles from "../components/ui.module.css";
import { UNSAVED_CONFIRM } from "../components/ProjectFileMenu";
import { useProject, useProjectDispatch } from "../store";
import { HOME } from "../components/AreaNav";

// Doc 13 §4 reference designs on the base catalogue (D-116), one example per design; each lists the
// Doc 13 §5 validation cases it serves and what each case tests.
const EXAMPLES: { key: string; label: string; cases: string[] }[] = [
  { key: "d1", label: "D1: one TRUMPF 50 kVA inverter, 20 kW + 8 kvar", cases: ["SS-01 steady state: V, f, P, Q, losses"] },
  {
    key: "d2",
    label: "D2: TRUMPF 75 kVA + 50 kVA, equal per-unit droop, 27.17 kW + 10.87 kvar",
    cases: [
      "SS-02 steady state: P shared in proportion to rating",
      "SM-01, SM-02 small steps (load +3 %, P* +2.14 % of INV1): dominant mode",
      "DR-01, DR-02 medium steps (load +10 %, P* +2.86 % of INV1): settling, overshoot, RoCoF",
      "TS-01, TS-02, TS-03 large disturbances (load +300 %, INV2 trip, P* +21.43 % of INV1): transient class",
      "The SM, DR and TS disturbances are presets on the Transient screen of the guided example",
    ],
  },
  { key: "d2s", label: "D2S: D2 stressed, 2.4 × load, 65.22 kW + 26.09 kvar", cases: ["SS-03 steady state at 56 % of rating"] },
  { key: "d2h", label: "D2H: D2 near the limit, 4.0 × load, 108.7 kW + 43.48 kvar", cases: ["SS-04 steady state at 94 % of rating"] },
];

export default function Home() {
  const { project, unsaved } = useProject();
  const { t } = useLanguage();
  const dispatch = useProjectDispatch();
  const router = useRouter();
  const [name, setName] = useState("");
  const [kv, setKv] = useState<number | null>(null); // no default (Doc 3 §3.1)
  const [hz, setHz] = useState<number | null>(50); // default 50, editable (Doc 3 §3.1)
  const [note, setNote] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [guided, setGuided] = useState<ExampleSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { dialog, confirm, ask } = useConfirmDelete();
  useEffect(() => {
    void getMeta().then((m) => {
      setEngine(m.ok ? m.data.engine.engine_kind : null);
      if (m.ok && !project) setDraft(readDraft(m.data.schema_version));
    });
    void getExampleSettings("guided-d2").then((s) => setGuided(s.ok ? parseExampleSettings(s.data) : null));
  }, []);

  // a new Project is autosaved over the draft, so ask while the draft is still offered
  const keepsDraft = async () => !draft || (await ask(...DRAFT_REPLACE));

  async function openExample(key: string, settings?: ExampleSettings) {
    if (unsaved && !(await ask(...UNSAVED_CONFIRM))) return;
    if (!settings && !(await keepsDraft())) return; // example mode is never autosaved
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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (unsaved && !(await ask(...UNSAVED_CONFIRM))) return;
    if (!(await keepsDraft())) return;
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
      <h1>{t("Microgrid design tool")}</h1>
      {engine === "FAKE" && <p>{t("The calculation engine is the Fake Engine; results are placeholders.")}</p>}
      <p>{t("To continue earlier work, use “Open project file” in the header.")}</p>
      {project && (
        <p>
          {t("Open Project:")} <Link href={HOME}>{project.name}</Link>
        </p>
      )}
      {draft && !project && (
        <section aria-label={t("Unsaved work")} className={uiStyles.blocked}>
          <Icon name="clock" />
          <p className={uiStyles.draftText}>
            {t("Unsaved work from {date}: {name}. It was kept in this browser, not saved to a file; results are not kept, run them again.", {
              date: new Date(draft.saved_at).toLocaleString(),
              name: draft.file.project.name,
            })}
          </p>
          <span>
            <button type="button" className="primary" onClick={() => void restore(draft)}>
              {t("Restore unsaved work")}
            </button>{" "}
            <button
              type="button"
              onClick={() =>
                confirm(t("Discard unsaved work?"), t("The unsaved work on {name} is removed from this browser. This cannot be undone.", { name: draft.file.project.name }), () => {
                  clearDraft();
                  setDraft(null);
                })
              }
            >
              {t("Discard")}
            </button>
          </span>
        </section>
      )}
      {dialog}
      <form onSubmit={(e) => void create(e)} aria-label={t("New project")}>
        <h2>{t("New project")}</h2>
        <p>
          <label htmlFor="name">{t("Project name")}</label>{" "}
          <input id="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </p>
        <p>
          <NumberField id="kv" label={t("Nominal voltage, line-to-line")} unit="kV" value={kv} onChange={setKv} />
        </p>
        <p>
          <NumberField id="hz" label={t("Nominal frequency")} unit="Hz" value={hz} onChange={setHz} />
        </p>
        <button type="submit">{t("Create project")}</button>
        {project && <span> {t("(replaces the open Project)")}</span>}
      </form>
      <section aria-label={t("Example projects")}>
        <h2>{t("Example projects")}</h2>
        {guided && (
          <div>
            <button type="button" className="primary" onClick={() => void openExample(guided.project, guided)}>
              {t("Open guided example (D2)")}
            </button>
            <p>{t("Every screen is pre-filled. Press Run on each step to see the whole pipeline.")}</p>
          </div>
        )}
        <p>{t("Reference designs of the validation plan, built from catalogue products (TRUMPF inverters, First Cable N2XY 4×16 mm² lines). Opening one makes a new unsaved copy.")}</p>
        <ul>
          {EXAMPLES.map(({ key, label, cases }) => (
            <li key={key}>
              <button type="button" onClick={() => void openExample(key)}>
                {t("Open example {label}", { label: t(label) })}
              </button>
              <ul aria-label={t("Validation cases of {key}", { key: key.toUpperCase() })}>
                {cases.map((c) => (
                  <li key={c}>{t(c)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {note && <p role="alert">{note}</p>}
      </section>
    </>
  );
}
