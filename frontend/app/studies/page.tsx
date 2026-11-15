"use client";
// Studies overview (audit 2026-11-14 Phase 5, D-10): the Studies tab lands here. One row per study:
// the question it answers, its last run and whether that run is on the current design. Nothing runs here.
import Link from "next/link";
import { BATTERY, CodedLabel, FURTHER, STUDY_TYPE } from "../../components/AreaNav";
import { DataTable, type DataColumn } from "../../components/DataTable";
import styles from "../../components/Further.module.css";
import { M1BlockedNote } from "../../components/M1Freshness";
import { RequireProject } from "../../components/RequireProject";
import { m1Freshness, useValidation } from "../../components/useValidation";
import { m1Ref, studyRun, useProject, type StudyState } from "../../store";

const QUESTION: Record<string, string> = {
  "/sensitivity/": "Which parameters move each output metric most?",
  "/sweep/": "How do the key metrics change as one input steps over a range?",
  "/scenarios/": "How do saved design variants, or the loss of one inverter, compare?",
  "/envelope/": "Which combinations of two inputs keep the design feasible?",
  "/small-signal/": "Is the operating point small-signal stable, and how well damped?",
  "/transient/": "How do frequency and voltage respond to a disturbance over time?",
  "/battery/": "Can each battery bank carry its inverter's power, and for how long?",
};
const STATE_WORD: Record<StudyState, string> = { current: "Current", stale: "Out of date", none: "Not run" };

type Row = { href: string; name: string; state: StudyState; at: string | null };

function Studies() {
  const { design, runRecords, batteryBanks } = useProject();
  const report = useValidation(design);
  const hash = report?.snapshot_hash ?? null;
  const fresh = m1Freshness(m1Ref(runRecords)?.snapshot_hash ?? null, report);
  const rows: Row[] = [...FURTHER, ...(batteryBanks.length ? [BATTERY] : [])].map(([href, name]) => {
    const { record, state } = studyRun(runRecords, STUDY_TYPE[href], hash);
    return { href, name, state, at: record?.created_at ?? null };
  });
  const columns: DataColumn<Row>[] = [
    { key: "name", header: "Study", cell: (r) => <CodedLabel text={r.name} /> },
    { key: "q", header: "Question it answers", cell: (r) => QUESTION[r.href] },
    { key: "at", header: "Last run", cell: (r) => (r.at ? <time dateTime={r.at} title={r.at}>{new Date(r.at).toLocaleString()}</time> : "—") },
    { key: "state", header: "Result", cell: (r) => (hash === null ? "Checking…" : STATE_WORD[r.state]) },
    { key: "open", header: "Open", cell: (r) => <Link href={r.href} aria-label={`Open ${r.name}`}>Open</Link> },
  ];
  return (
    <>
      <div className={styles.head}>
        <h1>Studies</h1>
      </div>
      <p className={styles.facts}>Each study runs on top of a current power flow (M1). A result is out of date once the design changes after its run; it stays readable until you run the study again.</p>
      <M1BlockedNote f={fresh} />
      <DataTable label="Studies" caption="Studies and their latest results" columns={columns} rows={rows} rowKey={(r) => r.href} rowName={(r) => r.name} />
    </>
  );
}

export default function StudiesPage() {
  return (
    <RequireProject>
      <Studies />
    </RequireProject>
  );
}
