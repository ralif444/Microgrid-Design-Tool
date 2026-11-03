"use client";
// S-10 Sweep (M3b) (Doc 7 §6.5, F4): one axis, range and point count; size indicator against
// SWEEP_CAP from /api/meta; over the cap the request is still sendable and comes back
// INPUT_INVALID / SWEEP_CAP_EXCEEDED (Doc 7 §3.1).
import { useState } from "react";
import type { KeyMetrics, M3bPayload, RunRecord, SweepPoint } from "../../api-types";
import { SizeIndicator, useAxis, useSweepCap } from "../../components/AxisForm";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { ConstraintTable } from "../../components/M2Results";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { LineChart } from "../../components/charts/LineChart";
import { Swatch } from "../../components/charts/marks";
import { SERIES } from "../../components/charts/palette";

const KEY_METRICS: [keyof KeyMetrics, string][] = [
  ["system_frequency_hz", "System frequency (Hz)"],
  ["min_voltage_pu", "Lowest bus voltage (pu)"],
  ["max_loading_ratio", "Highest inverter loading (ratio)"],
  ["total_losses_kw", "Total line losses (kW)"],
  ["epsilon_x_ratio", "ε_X validity indicator (ratio)"],
  ["max_q_sharing_error_pu", "Largest Q-sharing error (pu of rating)"],
];

function Sweep() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3b");
  const ax = useAxis(design);
  const cap = useSweepCap();
  const [metric, setMetric] = useState<keyof KeyMetrics>("system_frequency_hz");
  const unit = ax.unit;

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3bPayload) : null;
  return (
    <>
      <h1>Sweep (M3b)</h1>
      <M1FreshnessBadge f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Sweep settings"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { axis: ax.axis } });
        }}
      >
        {ax.fields}
        <SizeIndicator points={ax.steps} cap={cap} />
        <button type="submit" disabled={busy || fresh !== "current"}>
          {busy ? "Running..." : "Run sweep"}
        </button>
      </form>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M3b" result={r} />}
      {p && (
        <>
          <p data-testid="first-infeasible">
            First infeasible value:{" "}
            {p.first_infeasible_value === null ? "none in range" : `${fmt(p.first_infeasible_value)} ${unit}`}
          </p>
          <p>
            <label htmlFor="plot-metric">Plot</label>{" "}
            <select id="plot-metric" value={metric} onChange={(e) => setMetric(e.target.value as keyof KeyMetrics)}>
              {KEY_METRICS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </p>
          <SweepPlot points={p.points} metric={metric} xTitle={`${ax.name} (${unit})`} record={resp?.run_record ?? null} />
          <table aria-label="Sweep points">
            <caption>Sweep points</caption>
            <thead>
              <tr>
                <th>Value ({unit})</th>
                <th>Status</th>
                {KEY_METRICS.map(([k, label]) => (
                  <th key={k}>{label}</th>
                ))}
                <th>Limiting constraint</th>
              </tr>
            </thead>
            <tbody>
              {p.points.map((pt, k) => (
                <tr key={k}>
                  <td>{fmt(pt.value)}</td>
                  <td>{pt.status}</td>
                  {KEY_METRICS.map(([m]) => (
                    <td key={m}>{fmt(pt.key_metrics[m])}</td>
                  ))}
                  <td>
                    {pt.limiting_constraint ? (
                      <ConstraintTable label={`Limiting constraint at ${fmt(pt.value)}`} rows={[pt.limiting_constraint]} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!resp && <p>No sweep run yet.</p>}
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

// Marker shape carries the Status (circle feasible, cross infeasible); a point without a value is
// a gap, listed in the point table (Doc 12 X1, FR-86). Points without an axis value are not drawn.
function SweepPlot({ points, metric, xTitle, record }: { points: SweepPoint[]; metric: keyof KeyMetrics; xTitle: string; record: RunRecord | null }) {
  const shown = points.filter((p) => typeof p.value === "number");
  const legend = [
    { name: "feasible", swatch: <Swatch color={SERIES[0]} marker="circle" /> },
    { name: "infeasible", swatch: <Swatch color={SERIES[0]} marker="cross" /> },
  ];
  return (
    <LineChart
      title="Sweep"
      xTitle={xTitle}
      yTitle={KEY_METRICS.find(([k]) => k === metric)?.[1] ?? metric}
      x={shown.map((p) => p.value as number)}
      series={[{ name: KEY_METRICS.find(([k]) => k === metric)?.[1] ?? metric, values: shown.map((p) => (typeof p.key_metrics[metric] === "number" ? (p.key_metrics[metric] as number) : null)), marker: (i) => (shown[i].status === "FEASIBLE" ? "circle" : "cross") }]}
      legend={legend}
      note="A point with no operating point (failed) has no value and leaves a gap."
      record={record}
    />
  );
}
