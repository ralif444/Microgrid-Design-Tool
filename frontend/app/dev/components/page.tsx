"use client";
// Component gallery (ADR-011 step 1, ADR-012 step b): every core component in every state, for review
// and screenshots. Not linked from the app. All content is sample UI data: banner rows use the
// Doc 7 §5 texts from status-text.ts, table rows are the D2 example inputs, not results.
import { Tag } from "@carbon/react";
import { useState } from "react";
import type { AnalysisResult, AnalysisType, RunRecord } from "../../../api-types";
import { BarChart } from "../../../components/charts/BarChart";
import { LineChart } from "../../../components/charts/LineChart";
import { AdvisoryPanel } from "../../../components/AdvisoryPanel";
import { DataTable, type DataColumn, type RowError } from "../../../components/DataTable";
import { EmptyState } from "../../../components/EmptyState";
import { EngineBadgeView } from "../../../components/EngineBadge";
import { Icon } from "../../../components/Icon";
import { M1BlockedNote, M1FreshnessBadge } from "../../../components/M1Freshness";
import { NumberField } from "../../../components/NumberField";
import { PipelineStepperView, STEPS, type StepState } from "../../../components/PipelineStepper";
import { StatusBanner, TOKEN_ROLE, statusIcon } from "../../../components/StatusBanner";
import { bannerText } from "../../../components/status-text";
import { Toast } from "../../../components/Toast";
import { UnsavedFlag } from "../../../components/AppShell";

const FAKE = { code: "ENGINE_KIND_FAKE", message: "Result from the Fake Engine; not an engine calculation." };
const r = (status: AnalysisResult["status"], status_code: string, extra: Partial<AnalysisResult> = {}): AnalysisResult => ({
  status,
  status_code,
  message: "",
  ...extra,
});

// One entry per Doc 7 §5 row.
const BANNERS: [string, AnalysisType, AnalysisResult][] = [
  ["FEASIBLE (M1)", "M1", r("FEASIBLE", "OK")],
  ["FEASIBLE (M2), every limit given", "M2", r("FEASIBLE", "OK", { payload: { not_evaluated: [] } })],
  ["FEASIBLE (M2), limits missing", "M2", r("FEASIBLE", "OK", { payload: { not_evaluated: [{}, {}, {}] } })],
  ["FEASIBLE (PS)", "PS", r("FEASIBLE", "OK")],
  ["FEASIBLE (M3/M4), Fake Engine", "M4a", r("FEASIBLE", "OK", { warnings: [FAKE] as AnalysisResult["warnings"] })],
  ["INFEASIBLE (M2)", "M2", r("INFEASIBLE", "CONSTRAINT_VIOLATED", { limiting_constraints: [{}, {}] as AnalysisResult["limiting_constraints"] })],
  ["SOLVER_FAILED", "M1", r("SOLVER_FAILED", "MAX_ITERATIONS_REACHED")],
  ["PHYSICALLY_INADMISSIBLE", "M1", r("PHYSICALLY_INADMISSIBLE", "OPERATING_POINT_NOT_PHYSICAL")],
  [
    "INPUT_INVALID",
    "M1",
    r("INPUT_INVALID", "MULTIPLE_ISSUES", {
      diagnostics: {
        issues: [
          { entity: "Line", id: "LN2", field: "length_km", message: "This value must be greater than 0." },
          { entity: "Load", id: "L1", field: "q_kvar", message: "Enter either reactive power or power factor." },
        ],
      },
    }),
  ],
  ["INPUT_INVALID / SWEEP_CAP_EXCEEDED", "M3b", r("INPUT_INVALID", "SWEEP_CAP_EXCEEDED")],
  ["UNAVAILABLE / TIMEOUT", "M1", r("UNAVAILABLE", "TIMEOUT")],
  ["UNAVAILABLE / DEPENDENCY_NOT_MET, missing", "M2", r("UNAVAILABLE", "DEPENDENCY_NOT_MET")],
  ["UNAVAILABLE / DEPENDENCY_NOT_MET, stale", "M2", r("UNAVAILABLE", "DEPENDENCY_NOT_MET", { diagnostics: { dependency_reason: "STALE" } })],
  ["UNAVAILABLE / DEPENDENCY_NOT_MET, M1 not usable", "M2", r("UNAVAILABLE", "DEPENDENCY_NOT_MET", { diagnostics: { dependency_reason: "NOT_FEASIBLE" } })],
  ["UNAVAILABLE / NOT_APPLICABLE", "M4b", r("UNAVAILABLE", "NOT_APPLICABLE")],
  ["UNAVAILABLE / ENGINE_ERROR", "M1", r("UNAVAILABLE", "ENGINE_ERROR")],
];

// One row per guideline §7.2 line.
const MAPPING = [
  "FEASIBLE (M1)",
  "INFEASIBLE (M2)",
  "SOLVER_FAILED",
  "PHYSICALLY_INADMISSIBLE",
  "UNAVAILABLE / ENGINE_ERROR",
  "INPUT_INVALID",
  "UNAVAILABLE / TIMEOUT",
  "UNAVAILABLE / DEPENDENCY_NOT_MET, missing",
  "UNAVAILABLE / NOT_APPLICABLE",
];

const STEPPER: [string, StepState[], string, boolean][] = [
  ["New project, on Loads", STEPS.map(() => "todo"), "/loads/", true],
  ["Design entered, M1 not run, on Power flow", ["done", "done", "todo", "done", "done", "todo", "blocked", "blocked", "todo"], "/power-flow/", true],
  ["M1 and M2 done, on Constraint check", ["done", "done", "done", "done", "done", "done", "done", "todo", "done"], "/constraint-check/", false],
  ["Design edited after M1, on Sweep", ["done", "done", "done", "done", "done", "stale", "blocked", "blocked", "done"], "/sweep/", false],
];

type LineRow = { id: string; from_bus_id: string; to_bus_id: string; r_ohm_per_km: number | null; x_ohm_per_km: number | null; length_km: number | null };
const D2_LINES: LineRow[] = [
  { id: "LN1", from_bus_id: "B1", to_bus_id: "B2", r_ohm_per_km: 0.02, x_ohm_per_km: 0.04, length_km: 1.0 },
  { id: "LN2", from_bus_id: "B2", to_bus_id: "B3", r_ohm_per_km: 0.025, x_ohm_per_km: 0.045, length_km: 1.0 },
];

function TableDemo({ withError }: { withError: boolean }) {
  const [rows, setRows] = useState<LineRow[]>(() => D2_LINES.map((l, k) => (withError && k === 1 ? { ...l, length_km: null } : l)));
  const set = (id: string, patch: Partial<LineRow>) => setRows((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const num = (key: "r_ohm_per_km" | "x_ohm_per_km" | "length_km", header: string, unit: string): DataColumn<LineRow> => ({
    key,
    header,
    unit,
    numeric: true,
    edit: { kind: "number", value: (x) => x[key], onChange: (x, v) => set(x.id, { [key]: v }) },
  });
  const columns: DataColumn<LineRow>[] = [
    { key: "id", header: "Id", cell: (x) => x.id },
    { key: "from_bus_id", header: "From bus", edit: { kind: "select", options: ["B1", "B2", "B3"], value: (x) => x.from_bus_id, onChange: (x, v) => set(x.id, { from_bus_id: v ?? "" }) } },
    { key: "to_bus_id", header: "To bus", edit: { kind: "select", options: ["B1", "B2", "B3"], value: (x) => x.to_bus_id, onChange: (x, v) => set(x.id, { to_bus_id: v ?? "" }) } },
    num("r_ohm_per_km", "R", "Ω/km"),
    num("x_ohm_per_km", "X", "Ω/km"),
    num("length_km", "Length", "km"),
    { key: "r_total", header: "R total, derived", unit: "Ω", numeric: true, cell: (x) => (x.r_ohm_per_km !== null && x.length_km !== null ? x.r_ohm_per_km * x.length_km : null) },
  ];
  const errors = (x: LineRow): RowError[] => (x.length_km === null || x.length_km <= 0 ? [{ field: "length_km", message: "This value must be greater than 0." }] : []);
  return (
    <DataTable
      label={withError ? "Lines, with a row error" : "Lines"}
      columns={columns}
      rows={rows}
      rowKey={(x) => x.id}
      rowName={(x) => x.id}
      rowErrors={errors}
      actions={(x) => (
        <button type="button" onClick={() => setRows((rs) => rs.filter((y) => y.id !== x.id))}>
          Delete {x.id}
        </button>
      )}
      empty={<EmptyState title="No lines yet.">Add a line between two buses.</EmptyState>}
    />
  );
}

// Gallery placeholders only (counting numbers), not results of any analysis.
const SAMPLE_X = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const FAKE_RECORD = { analysis_type: "M4b", record_id: "gallery-sample", engine_kind: "FAKE" } as unknown as RunRecord;

function Demo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} style={{ marginBottom: "var(--space-8)" }}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentsPage() {
  const [v, setV] = useState<number | null>(0.2);
  const [toast, setToast] = useState(true);
  return (
    <>
      <h1>Component gallery</h1>
      <p>Sample states for review (ADR-012). Banner texts are the Doc 7 §5 texts; table rows are the D2 example inputs. Nothing here is a result.</p>

      <Demo title="Status mapping, guideline §7.2">
        <table>
          <thead>
            <tr>
              <th scope="col">Status / reason</th>
              <th scope="col">Role</th>
              <th scope="col">Icon and word</th>
            </tr>
          </thead>
          <tbody>
            {BANNERS.filter(([label]) => MAPPING.includes(label)).map(([label, type, res]) => {
              const role = TOKEN_ROLE[bannerText(type, res).role];
              return (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{role}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span style={{ display: "inline-flex", color: `var(--role-${role}-icon)` }}>
                        <Icon name={statusIcon(res)} size={20} />
                      </span>
                      {res.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Demo>

      <Demo title="Tags">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", alignItems: "center" }}>
          <Tag type="warm-gray" size="md" renderIcon={() => <Icon name="warn" />}>
            Near limit
          </Tag>
          <Tag type="purple" size="sm">
            Advice
          </Tag>
          <Tag type="purple" size="sm">
            Sizing check · from the network
          </Tag>
          <M1FreshnessBadge f="current" />
          <M1FreshnessBadge f="stale" />
          <M1FreshnessBadge f="missing" />
        </div>
      </Demo>

      <Demo title="M1 blocked note">
        <M1BlockedNote f="stale" />
        <M1BlockedNote f="missing" />
      </Demo>

      <Demo title="Engine badge and unsaved indicator">
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <EngineBadgeView kind="REAL" />
          <EngineBadgeView kind="FAKE" />
          <EngineBadgeView kind="unreachable" />
          <span>
            Example D2
            <UnsavedFlag />
          </span>
        </div>
      </Demo>

      <Demo title="Pipeline stepper">
        {STEPPER.map(([label, states, path, missing]) => (
          <figure key={label} style={{ margin: "0 0 var(--space-4)" }}>
            <figcaption style={{ color: "var(--color-fg-muted)", fontSize: "var(--text-xs)", marginBottom: "var(--space-1)" }}>{label}</figcaption>
            <PipelineStepperView states={states} path={path} m1Missing={missing} />
          </figure>
        ))}
      </Demo>

      <Demo title="Status banner, every Doc 7 §5 row">
        {BANNERS.map(([label, type, res]) => (
          <figure key={label} style={{ margin: 0 }}>
            <figcaption style={{ color: "var(--color-fg-muted)", fontSize: "var(--text-xs)" }}>{label}</figcaption>
            <StatusBanner type={type} result={res} />
          </figure>
        ))}
      </Demo>

      <Demo title="Number field">
        {/* a form aligns its fields with --field-label */}
        <div style={{ "--field-label": "16rem" } as React.CSSProperties}>
        <p>
          <NumberField id="g-normal" label="Inverter design margin m_inv" unit="ratio" value={v} onChange={setV} />
        </p>
        <p>
          <NumberField id="g-empty" label="Frequency, lower limit" unit="Hz" value={null} onChange={() => undefined} />
        </p>
        <p>
          <NumberField id="g-error" label="Length of LN2" unit="km" value={0} onChange={() => undefined} error="This value must be greater than 0." />
        </p>
        <p>
          <NumberField id="g-disabled" label="Nominal frequency" unit="Hz" value={50} onChange={() => undefined} disabled />
        </p>
        </div>
      </Demo>

      <Demo title="Data table">
        <h3>Normal (Enter moves down, Escape restores)</h3>
        <TableDemo withError={false} />
        <h3>Row error</h3>
        <TableDemo withError />
        <h3>Empty</h3>
        <DataTable label="Lines, empty" columns={[]} rows={[] as LineRow[]} rowKey={(x) => x.id} rowName={(x) => x.id} empty={<EmptyState title="No lines yet.">Add a line between two buses.</EmptyState>} />
      </Demo>

      <Demo title="Buttons">
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button type="button">Tertiary</button>
          <button type="button" className="primary">
            Primary
          </button>
          <form onSubmit={(e) => e.preventDefault()} style={{ display: "inline" }}>
            <button type="submit">Run M1</button>
          </form>
          <button type="button" disabled aria-busy="true">
            Running...
          </button>
          <button type="button" disabled>
            Run M2
          </button>
        </div>
      </Demo>

      <Demo title="Advisory panel">
        <AdvisoryPanel label="Sizing advice sample" title="Sizing advice (not design data)">
          <p>Accept makes it design data; Skip leaves the design unchanged.</p>
        </AdvisoryPanel>
        <AdvisoryPanel label="Sizing check sample" tag="Sizing check · from the network" title="Sizing check (advisory, from the network)">
          <p>Computed from the network result; it never changes the design.</p>
        </AdvisoryPanel>
      </Demo>

      <Demo title="Charts">
        <p>Placeholder numbers for the look only; no analysis produced them.</p>
        <LineChart title="Line chart, two series" xTitle="sample index (count)" yTitle="sample value (count)" x={SAMPLE_X} series={[{ name: "series A", values: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, { name: "series B", values: [9, 8, 7, 6, 5, 4, 3, 2, 1] }]} />
        <LineChart title="Line chart with gaps (null values)" xTitle="sample index (count)" yTitle="sample value (count)" x={SAMPLE_X} series={[{ name: "series A", values: [1, 2, null, 4, 5, null, null, 8, 9] }]} />
        <LineChart title="Point chart with markers" xTitle="sample index (count)" yTitle="sample value (count)" x={SAMPLE_X} line={false} series={[{ name: "series A", values: [2, 3, null, 5, 4, 6, 5, 7, 6], marker: (i) => (i % 3 === 0 ? "cross" : "circle") }]} />
        <LineChart title="FAKE caption" xTitle="sample index (count)" yTitle="sample value (count)" x={SAMPLE_X} series={[{ name: "series A", values: [1, 1, 2, 2, 3, 3, 2, 2, 1] }]} record={FAKE_RECORD} />
        <LineChart title="Empty chart" xTitle="sample index (count)" yTitle="sample value (count)" x={[]} series={[{ name: "series A", values: [] }]} />
        <BarChart title="Bar chart with a reference line and a missing value" valueTitle="sample value (count)" categoryTitle="Item" bars={[{ label: "A", value: 3 }, { label: "B", value: null }, { label: "C", value: 5 }]} refs={[{ value: 4, label: "reference 4" }]} />
      </Demo>

      <Demo title="Empty state">
        <EmptyState title="No loads yet." action={<button type="button">+ Add load</button>}>
          Add the first load.
        </EmptyState>
      </Demo>

      <Demo title="Toast">
        <Toast inline message="The local service did not answer correctly" />
        {toast && <Toast message="The local service did not answer correctly" onDismiss={() => setToast(false)} />}
      </Demo>
    </>
  );
}
