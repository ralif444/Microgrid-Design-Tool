"use client";
// S-10 Sweep (M3b) (Doc 7 §6.5, F4): one axis, range and point count; size indicator against
// SWEEP_CAP from /api/meta; over the cap the request is still sendable and comes back
// INPUT_INVALID / SWEEP_CAP_EXCEEDED (Doc 7 §3.1).
// UX-7 (Doc 12 X2–X4): KPI strip, metric picker over the metrics with data, crosshair, a mark at
// the first infeasible value; the points table on DataTable.
import { useState } from "react";
import type { KeyMetrics, M3bPayload, RunRecord, SweepPoint } from "../../api-types";
import { SizeIndicator, useAxis, useSweepCap } from "../../components/AxisForm";
import { LineChart } from "../../components/charts/LineChart";
import { Swatch } from "../../components/charts/marks";
import { FEAS } from "../../components/charts/palette";
import { DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import styles from "../../components/Further.module.css";
import { m3bKpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { ConstraintTable } from "../../components/M2Results";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";

type Metric = keyof KeyMetrics;
// [field, name, unit]; the optional ones appear only when a point carries them (point_metrics)
const KEY_METRICS: [Metric, string, string][] = [
  ["system_frequency_hz", "System frequency", "Hz"],
  ["min_voltage_pu", "Lowest bus voltage", "pu"],
  ["max_loading_ratio", "Highest inverter loading", "ratio"],
  ["total_losses_kw", "Total line losses", "kW"],
  ["epsilon_x_ratio", "ε_X validity indicator", "ratio"],
  ["max_q_sharing_error_pu", "Largest Q-sharing error", "pu of rating"],
  ["lambda_c", "Constraint loadability λ_c", "ratio"],
  ["zeta_min", "Lowest damping ζ_min", "ratio"],
  ["re_lambda_dom_per_s", "Real part of the dominant eigenvalue", "1/s"],
  ["r_tau", "r_τ line-to-filter time ratio", "ratio"],
  ["kappa", "κ dominant-mode speed", "ratio"],
];
const title = ([, name, unit]: (typeof KEY_METRICS)[number]) => `${name} (${unit})`;
const OPTIONAL = new Set<Metric>(["max_q_sharing_error_pu", "lambda_c", "zeta_min", "re_lambda_dom_per_s", "r_tau", "kappa"]);

function Sweep() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3b");
  const ax = useAxis(design);
  const cap = useSweepCap();
  const [metric, setMetric] = useState<Metric>("system_frequency_hz");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const unit = ax.unit;

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3bPayload) : null;
  const shown = KEY_METRICS.filter(([k]) => !OPTIONAL.has(k) || p?.points.some((pt) => typeof pt.key_metrics[k] === "number"));
  const columns: DataColumn<SweepPoint>[] = [
    { key: "v", header: "Value", unit, numeric: true, cell: (pt) => fmt(pt.value) },
    { key: "s", header: "Status", cell: (pt) => pt.status },
    ...shown.map(([k, name, u]) => ({ key: k, header: name, unit: u, numeric: true, cell: (pt: SweepPoint) => fmt(pt.key_metrics[k]) })),
    {
      key: "l",
      header: "Limiting constraint",
      cell: (pt) => (pt.limiting_constraint ? <ConstraintTable label={`Limiting constraint at ${fmt(pt.value)}`} rows={[pt.limiting_constraint]} /> : "—"),
    },
  ];
  return (
    <>
      <div className={styles.head}>
        <h1>Sweep (M3b)</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Sweep settings"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { axis: ax.axis } });
        }}
      >
        {ax.fields}
        <SizeIndicator points={ax.steps} cap={cap} />
        <button type="submit" className="primary" disabled={busy || fresh !== "current"} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run sweep"}
        </button>
      </form>
      {error && error !== dismissed && <Toast message={error} onDismiss={() => setDismissed(error)} />}
      {r && <StatusBanner type="M3b" result={r} />}
      {p && resp && <KpiStrip label="Sweep key figures" kpis={m3bKpis(p, unit)} record={resp.run_record} />}
      {p && resp && (
        <>
          <p data-testid="first-infeasible">
            First infeasible value:{" "}
            {p.first_infeasible_value === null ? "none in range" : `${fmt(p.first_infeasible_value)} ${unit}`}
          </p>
          <p>
            <label htmlFor="plot-metric">Plot</label>{" "}
            <select id="plot-metric" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              {shown.map((m) => (
                <option key={m[0]} value={m[0]}>
                  {title(m)}
                </option>
              ))}
            </select>
          </p>
          <SweepPlot points={p.points} metric={KEY_METRICS.find(([k]) => k === metric) ?? KEY_METRICS[0]} xName={ax.name} xUnit={unit} first={p.first_infeasible_value} record={resp.run_record} />
          <DataTable label="Sweep points" caption="Sweep points" columns={columns} rows={p.points} rowKey={(_, k) => k} rowName={(pt) => fmt(pt.value)} />
          <p className={styles.record}>
            RunRecord <code>{resp.run_record.record_id}</code>, engine {resp.run_record.engine_kind ?? "not called"}.
          </p>
        </>
      )}
      {!resp && <EmptyState title="No sweep run yet.">Choose an axis and run the sweep to see each point&apos;s status and key metrics.</EmptyState>}
    </>
  );
}

export default function SweepPage() {
  return (
    <RequireProject>
      <Sweep />
    </RequireProject>
  );
}

// Feasibility markers per VISUAL §9: ● feasible, ✕ infeasible, – unavailable (on the x axis); a
// point without a value is a gap in the line (Doc 12 X1, FR-86). Points without an axis value are not drawn.
function SweepPlot({
  points,
  metric,
  xName,
  xUnit,
  first,
  record,
}: {
  points: SweepPoint[];
  metric: (typeof KEY_METRICS)[number];
  xName: string;
  xUnit: string;
  first: number | null;
  record: RunRecord;
}) {
  const [k, name, unit] = metric;
  const shown = points.filter((p) => typeof p.value === "number");
  const legend = (Object.keys(FEAS) as (keyof typeof FEAS)[]).map((f) => ({ name: f, swatch: <Swatch color={FEAS[f].color} marker={FEAS[f].marker} filled={FEAS[f].filled} /> }));
  const mark = (p: SweepPoint) => {
    const f = typeof p.key_metrics[k] !== "number" ? FEAS.unavailable : p.status === "FEASIBLE" ? FEAS.feasible : FEAS.infeasible;
    return { m: f.marker, color: f.color, filled: f.filled };
  };
  return (
    <LineChart
      title="Sweep"
      xTitle={`${xName} (${xUnit})`}
      yTitle={title(metric)}
      x={shown.map((p) => p.value as number)}
      series={[{ name, values: shown.map((p) => (typeof p.key_metrics[k] === "number" ? (p.key_metrics[k] as number) : null)), marker: (i) => mark(shown[i]) }]}
      legend={legend}
      crosshair={{ xName, xUnit, unit }}
      vmarks={first === null ? [] : [{ x: first, label: "first infeasible" }]}
      note={`A point without a value (no operating point) leaves a gap in the line and is marked – on the x axis.${first === null ? "" : " The dashed vertical line marks the first infeasible value."} Focus the chart and use ←/→, Home, End to read exact points; Escape hides the readout.`}
      record={record}
    />
  );
}
