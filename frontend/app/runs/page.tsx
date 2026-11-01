"use client";
// S-15 Run history (Doc 7 §6.8, flow F3): list, detail, export one file (FR-49), import with
// verify (FR-50, FR-57), re-run with reproduction outcome (FR-51..FR-53). Verified imports join
// the Project (D-47 K18); a refused file is not added, so every listed record may be re-run.
import { useEffect, useState } from "react";
import { getMeta, rerunRunRecord, verifyRunRecord } from "../../api-client";
import type { EngineComparison, FileCheckResult, MetaInfo, RerunResponse, RunRecord } from "../../api-types";
import { downloadJson, NOT_JSON, readJson } from "../../components/files";
import { FileCheckText } from "../../components/ProjectFileMenu";
import { RequireProject } from "../../components/RequireProject";
import { useProject, useProjectDispatch } from "../../store";

const short = (h: string) => h.slice(0, 12);

function engineText(e: { engine_kind: string | null; engine_version: string | null; engine_git_commit: string | null }) {
  return e.engine_kind === null ? "engine not called" : `${e.engine_kind} ${e.engine_version} (${e.engine_git_commit})`;
}

function VersionNote({ c }: { c: EngineComparison | null | undefined }) {
  if (!c) return null;
  return (
    <p data-testid="version-comparison" role={c.differs ? "alert" : undefined}>
      Engine: stored {engineText(c.stored)} | current {engineText(c.current)}
      {c.differs && " — the engine version differs, so results may differ."}
    </p>
  );
}

function Detail({ r, meta }: { r: RunRecord; meta: MetaInfo | null }) {
  return (
    <section aria-label="Run detail">
      <h2>Run {r.record_id}</h2>
      <dl>
        <dt>Analysis</dt>
        <dd>{r.analysis_type}</dd>
        <dt>Status</dt>
        <dd>
          {r.result.status} ({r.result.status_code})
        </dd>
        <dt>Snapshot hash</dt>
        <dd><code>{r.snapshot_hash}</code></dd>
        <dt>Result hash</dt>
        <dd><code>{r.result_hash}</code></dd>
        {r.replay_of_record_id && (
          <>
            <dt>Re-run of</dt>
            <dd>{r.replay_of_record_id}</dd>
          </>
        )}
        <dt>Engine</dt>
        <dd>
          stored {engineText(r)}
          {meta && ` | current ${engineText(meta.engine)}`}
        </dd>
        <dt>App version</dt>
        <dd>{r.app_version}</dd>
      </dl>
      <details>
        <summary>Input snapshot, parameters, solver settings</summary>
        <pre>{JSON.stringify({ snapshot: r.snapshot, parameters: r.parameters, solver_config: r.solver_config }, null, 2)}</pre>
      </details>
    </section>
  );
}

function Reproduction({ out }: { out: RerunResponse }) {
  const rep = out.reproduction;
  if (!rep) return <FileCheckText fc={out.file_check} />;
  return (
    <section aria-label="Re-run outcome" data-testid="rerun-outcome">
      <h2>Re-run outcome: {rep.outcome === "REPRODUCED" ? "Reproduced" : "Differs"}</h2>
      <VersionNote c={rep.version_mismatch} />
      {out.analysis && <p>New run: {out.analysis.run_record.record_id}. The original record is unchanged.</p>}
      {rep.differences.length > 0 && (
        <table aria-label="Differences">
          <thead>
            <tr><th>Where</th><th>Kind</th><th>Stored</th><th>Now</th></tr>
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

function Runs() {
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
      <h1>Run history</h1>
      <p>
        <label>
          <input type="checkbox" checked={hideInvalid} onChange={(e) => setHideInvalid(e.target.checked)} /> Hide
          INPUT_INVALID
        </label>
        {hideInvalid && hidden > 0 && <span> ({hidden} hidden)</span>}{" "}
        <label>
          Import RunRecord{" "}
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
        <p>No runs recorded yet.</p>
      ) : (
        <table aria-label="Runs">
          <thead>
            <tr><th>Time</th><th>Type</th><th>Status</th><th>Code</th><th>Engine</th><th>Hash</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.record_id} data-testid={`run-${r.record_id}`}>
                <td>{r.created_at}</td>
                <td>{r.analysis_type}</td>
                <td>{r.result.status}</td>
                <td>{r.result.status_code}</td>
                <td>{r.engine_kind ?? "engine not called"}</td>
                <td><code title={r.result_hash}>{short(r.result_hash)}</code></td>
                <td>
                  <button type="button" onClick={() => setSelected(r.record_id)}>View</button>{" "}
                  <button type="button" onClick={() => downloadJson(`${r.record_id}.mgrun.json`, r)}>Export</button>{" "}
                  <button type="button" onClick={() => void doVerify(r)}>Verify</button>{" "}
                  <button type="button" disabled={busy !== null} onClick={() => void doRerun(r)}>
                    {busy === r.record_id ? "Re-running..." : "Re-run"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rerun && <Reproduction out={rerun} />}
      {sel && <Detail r={sel} meta={meta} />}
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
