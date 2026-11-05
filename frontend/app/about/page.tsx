"use client";
// S-17 About and limits (Doc 7 §2; FR-51, FR-91): app, schema and engine versions, the active
// limits from GET /meta, the offline note and the glossary (Indonesian, with sources; D-89).
// Independent of any Project, so no RequireProject.
import { useEffect, useState } from "react";
import { getMeta } from "../../api-client";
import type { MetaInfo } from "../../api-types";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { GLOSSARY, type GlossaryEntry } from "../../components/glossary";

type Row = [string, number | string | null | undefined, string];
const COLUMNS: DataColumn<Row>[] = [
  { key: "q", header: "Quantity", cell: (r) => r[0] },
  { key: "v", header: "Value", numeric: true, cell: (r) => r[1] ?? "no limit" }, // null = no limit (Doc 6 /meta)
  { key: "u", header: "Unit", cell: (r) => r[2] },
];
const TERMS: DataColumn<GlossaryEntry>[] = [
  { key: "t", header: "Term", cell: (e) => <strong>{e.term}</strong> },
  { key: "d", header: "Definisi", cell: (e) => <span lang="id">{e.short}</span> },
  { key: "s", header: "Sumber", cell: (e) => e.source },
];

export default function AboutPage() {
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void getMeta().then((r) => (r.ok ? setMeta(r.data) : setFailed(true)));
  }, []);
  const e = meta?.engine;
  const l = meta?.limits;
  return (
    <>
      <h1>About and limits</h1>
      <p>Microgrid Design Tool runs on this computer only: no account, no database, no remote requests.</p>
      {failed && <p>Versions and limits could not be read from the server.</p>}
      {meta && e && l && (
        <>
          <DataTable
            label="Versions"
            caption="Versions"
            columns={COLUMNS}
            rows={[
              ["App version", meta.app_version, ""],
              ["Project schema version", meta.schema_version, ""],
              ["RunRecord schema version", meta.record_schema_version, ""],
              ["API description version", meta.api_description_version, ""],
              ["Engine", e.engine_kind === "FAKE" ? "FAKE (placeholder results, not engine results)" : e.engine_kind, ""],
              ["Engine version", e.engine_version, ""],
              ["Engine commit", e.engine_git_commit, ""],
              ["Indicator threshold version", meta.indicator_threshold_version ?? "not calibrated", ""],
            ]}
            rowKey={(r) => r[0]}
            rowName={(r) => r[0]}
          />
          <DataTable
            label="Active limits"
            caption="Active limits"
            columns={COLUMNS}
            rows={[
              ["Time budget per request (TIME_BUDGET)", l.time_budget_s, "s"],
              ["Sweep size cap (SWEEP_CAP)", l.sweep_cap, "points"],
              ["Scenario cap (SCENARIO_CAP)", l.scenario_cap, "scenarios"],
              ["M3a parameter cap", l.m3a_parameter_cap, "parameters"],
              ["M4b duration cap", l.m4b_duration_cap_s, "s"],
              ["λ_c point cap", l.lambda_c_point_cap, "points"],
              ["Margin warning threshold", l.margin_warn, "ratio"],
              ["Request body limit", l.body_limit_mib, "MiB"],
            ]}
            rowKey={(r) => r[0]}
            rowName={(r) => r[0]}
          />
        </>
      )}
      <h2>Glosarium</h2>
      <p>Definitions are taken from the manuscript (Seminar, 28-10-2026) or Doc 3 §2; each names its source. The same texts open from the info button beside a term.</p>
      <DataTable label="Glossary" caption="Glossary" columns={TERMS} rows={Object.values(GLOSSARY)} rowKey={(r) => r.term} rowName={(r) => r.term} />
    </>
  );
}
