"use client";
// S-15 Run history (Doc 7 §6.8, flow F3): list, detail, export one file (FR-49), import with
// verify (FR-50, FR-57), re-run with reproduction outcome (FR-51..FR-53). Verified imports join
// the Project (D-47 K18); a refused file is not added, so every listed record may be re-run.
// Compare two RunRecords in the client (Doc 12 FR-83).
import { useEffect, useState } from "react";
import { getMeta, rerunRunRecord, verifyRunRecord } from "../../api-client";
import type { EngineComparison, FileCheckResult, MetaInfo, RerunResponse, RunRecord } from "../../api-types";
import { jsonDiff } from "../../components/diff";
import { displayLang, translate } from "../../components/i18n";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { downloadJson, NOT_JSON, readJson } from "../../components/files";
import { unitOf } from "../../components/Further";
import { useLanguage } from "../../components/Language";
import { FileCheckText } from "../../components/ProjectFileMenu";
import { RequireProject } from "../../components/RequireProject";
import styles from "./runs.module.css";
import { useProject, useProjectDispatch } from "../../store";

const short = (h: string) => h.slice(0, 12);
const id8 = (r: RunRecord) => r.record_id.slice(0, 8);

const tr = (k: string) => translate(displayLang(), k);
const columns = (t: (k: string) => string): DataColumn<RunRecord>[] => [
  { key: "created_at", header: t("Time"), cell: (r) => <time dateTime={r.created_at} title={r.created_at}>{new Date(r.created_at).toLocaleString()}</time> },
  { key: "analysis_type", header: t("Type"), cell: (r) => r.analysis_type },
  { key: "status", header: t("Status"), cell: (r) => r.result.status },
  { key: "status_code", header: t("Code"), cell: (r) => r.result.status_code },
  { key: "engine", header: t("Engine"), cell: (r) => r.engine_kind ?? t("engine not called") },
  { key: "hash", header: t("Hash"), cell: (r) => <code title={r.result_hash}>{short(r.result_hash)}</code> },
];

function engineText(e: { engine_kind: string | null; engine_version: string | null; engine_git_commit: string | null }) {
  return e.engine_kind === null ? tr("engine not called") : `${e.engine_kind} ${e.engine_version} (${e.engine_git_commit})`;
}

function VersionNote({ c }: { c: EngineComparison | null | undefined }) {
  const { t } = useLanguage();
  if (!c) return null;
  return (
    <p data-testid="version-comparison" role={c.differs ? "alert" : undefined}>
      {t("Engine: stored {stored} | current {current}", { stored: engineText(c.stored), current: engineText(c.current) })}
      {c.differs && ` ${t("— the engine version differs, so results may differ.")}`}
    </p>
  );
}

function Detail({ r, meta }: { r: RunRecord; meta: MetaInfo | null }) {
  const { t } = useLanguage();
  return (
    <section aria-label={t("Run detail")}>
      <h2>{t("Run {id}", { id: r.record_id })}</h2>
      <dl>
        <dt>{t("Analysis")}</dt>
        <dd>{r.analysis_type}</dd>
        <dt>{t("Status")}</dt>
        <dd>
          {r.result.status} ({r.result.status_code})
        </dd>
        <dt>{t("Snapshot hash")}</dt>
        <dd><code>{r.snapshot_hash}</code></dd>
        <dt>{t("Result hash")}</dt>
        <dd><code>{r.result_hash}</code></dd>
        {r.replay_of_record_id && (
          <>
            <dt>{t("Re-run of")}</dt>
            <dd>{r.replay_of_record_id}</dd>
          </>
        )}
        <dt>{t("Engine")}</dt>
        <dd>
          {t("stored {stored}", { stored: engineText(r) })}
          {meta && ` | ${t("current {current}", { current: engineText(meta.engine) })}`}
        </dd>
        <dt>{t("App version")}</dt>
        <dd>{r.app_version}</dd>
      </dl>
      <details>
        <summary>{t("Input snapshot, parameters, solver settings")}</summary>
        <pre>{JSON.stringify({ snapshot: r.snapshot, parameters: r.parameters, solver_config: r.solver_config }, null, 2)}</pre>
      </details>
    </section>
  );
}

function Reproduction({ out }: { out: RerunResponse }) {
  const { t } = useLanguage();
  const rep = out.reproduction;
  if (!rep) return <FileCheckText fc={out.file_check} />;
  return (
    <section aria-label={t("Re-run outcome")} data-testid="rerun-outcome">
      <h2>{t("Re-run outcome: {outcome}", { outcome: t(rep.outcome === "REPRODUCED" ? "Reproduced" : "Differs") })}</h2>
      <VersionNote c={rep.version_mismatch} />
      {out.analysis && <p>{t("New run: {id}. The original record is unchanged.", { id: out.analysis.run_record.record_id })}</p>}
      {rep.differences.length > 0 && (
        <table aria-label={t("Differences")}>
          <thead>
            <tr><th>{t("Where")}</th><th>{t("Kind")}</th><th>{t("Stored")}</th><th>{t("Now")}</th></tr>
          </thead>
          <tbody>
            {rep.differences.map((d, k) => (
              <tr key={k}>
                <td>{d.path}</td><td>{d.kind}</td><td>{JSON.stringify(d.stored)}</td><td>{JSON.stringify(d.current)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Compare({ runs }: { runs: RunRecord[] }) {
  const { t } = useLanguage();
  const show = (v: unknown) => (v === undefined ? t("absent") : JSON.stringify(v));
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const ra = runs.find((r) => r.record_id === a);
  const rb = runs.find((r) => r.record_id === b);
  const pick = (id: string, label: string, v: string, set: (v: string) => void) => (
    <>
      <label htmlFor={id}>{label}</label>{" "}
      <select id={id} value={v} onChange={(e) => set(e.target.value)}>
        <option value="">{t("Choose…")}</option>
        {runs.map((r) => (
          <option key={r.record_id} value={r.record_id}>
            {r.analysis_type} {r.record_id}
          </option>
        ))}
      </select>{" "}
    </>
  );
  const table = (label: string, rows: ReturnType<typeof jsonDiff>, units: boolean) =>
    rows.length === 0 ? (
      <p>{t("{label}: no differences.", { label })}</p>
    ) : (
      <table aria-label={label}>
        <thead>
          <tr><th>{t("Path")}</th>{units && <th>{t("Unit")}</th>}<th>{t("First run")}</th><th>{t("Second run")}</th></tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.path}>
              <td>{d.path}</td>{units && <td>{unitOf(d.path)}</td>}<td>{show(d.a)}</td><td>{show(d.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  return (
    <section aria-label={t("Compare runs")}>
      <h2>{t("Compare two runs")}</h2>
      <p>
        {pick("cmp-a", t("First run"), a, setA)}
        {pick("cmp-b", t("Second run"), b, setB)}
      </p>
      {ra && rb && (
        <>
          {table(t("Input differences"), jsonDiff(ra.snapshot, rb.snapshot), false)}
          {table(t("Result differences"), jsonDiff(ra.result.payload, rb.result.payload), true)}
        </>
      )}
    </section>
  );
}

function Runs() {
  const { t } = useLanguage();
  const { runRecords } = useProject();
  const dispatch = useProjectDispatch();
  const [hideInvalid, setHideInvalid] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [check, setCheck] = useState<{ fc: FileCheckResult | string; engine?: EngineComparison | null } | null>(null);
  const [rerun, setRerun] = useState<RerunResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  useEffect(() => {
    void getMeta().then((r) => r.ok && setMeta(r.data));
  }, []);

  const shown = runRecords.filter((r) => !hideInvalid || r.result.status !== "INPUT_INVALID");
  const hidden = runRecords.length - shown.length;
  const sel = runRecords.find((r) => r.record_id === selected) ?? null;

  async function importFile(file: File | undefined) {
    if (!file) return;
    setRerun(null);
    const read = await readJson(file);
    if (!read) return setCheck({ fc: NOT_JSON });
    const out = await verifyRunRecord(read.doc);
    if (!out.ok) return setCheck({ fc: out.message });
    setCheck({ fc: out.data.file_check, engine: out.data.engine_comparison });
    if (!out.data.file_check.accepted) return;
    const rec = read.doc as RunRecord;
    if (!runRecords.some((r) => r.record_id === rec.record_id)) dispatch({ type: "runRecordImported", record: rec });
    setSelected(rec.record_id);
  }

  async function doRerun(r: RunRecord) {
    setBusy(r.record_id);
    setRerun(null);
    const out = await rerunRunRecord(r);
    setBusy(null);
    if (!out.ok) return setCheck({ fc: out.message });
    setRerun(out.data);
    if (out.data.analysis) dispatch({ type: "runRecordAdded", record: out.data.analysis.run_record });
  }

  async function doVerify(r: RunRecord) {
    const out = await verifyRunRecord(r);
    setCheck(out.ok ? { fc: out.data.file_check, engine: out.data.engine_comparison } : { fc: out.message });
  }

  return (
    <>
      <h1>{t("Run history")}</h1>
      <p>
        <label>
          <input type="checkbox" checked={hideInvalid} onChange={(e) => setHideInvalid(e.target.checked)} /> {t("Hide runs refused for invalid input")}
        </label>
        {hideInvalid && hidden > 0 && <span> {t("({n} hidden)", { n: hidden })}</span>}{" "}
        <label>
          {t("Import RunRecord")}{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </p>
      {check && (
        <div data-testid="verify-result">
          {typeof check.fc === "string" ? <p role="status">{check.fc}</p> : <FileCheckText fc={check.fc} />}
          <VersionNote c={check.engine} />
        </div>
      )}
      {runRecords.length === 0 ? (
        <p>{t("No runs recorded yet.")}</p>
      ) : (
        <div className={`${styles.split} ${sel ? styles.withDetail : ""}`}>
          <DataTable
            label={t("Runs")}
            columns={columns(t)}
            rows={shown}
            rowKey={(r) => r.record_id}
            rowName={(r) => id8(r)}
            rowTestId={(r) => `run-${r.record_id}`}
            rowCurrent={(r) => r.record_id === selected}
            actions={(r) => (
              <>
                <button type="button" aria-label={t("View run {id}", { id: id8(r) })} onClick={() => setSelected(r.record_id)}>{t("View")}</button>{" "}
                <button type="button" aria-label={t("Export run {id}", { id: id8(r) })} onClick={() => downloadJson(`${r.record_id}.mgrun.json`, r)}>{t("Export")}</button>{" "}
                <button type="button" aria-label={t("Verify run {id}", { id: id8(r) })} onClick={() => void doVerify(r)}>{t("Verify")}</button>{" "}
                <button type="button" aria-label={t("Re-run run {id}", { id: id8(r) })} disabled={busy !== null} onClick={() => void doRerun(r)}>
                  {busy === r.record_id ? t("Re-running...") : t("Re-run")}
                </button>
              </>
            )}
          />
          {sel && <div className={styles.detail}><Detail r={sel} meta={meta} /></div>}
        </div>
      )}
      {runRecords.length >= 2 && <Compare runs={runRecords} />}
      {rerun && <Reproduction out={rerun} />}
    </>
  );
}

export default function RunsPage() {
  return (
    <RequireProject>
      <Runs />
    </RequireProject>
  );
}
