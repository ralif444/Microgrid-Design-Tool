"use client";
// S-12 Envelope (M3d) (Doc 7 §2, Doc 3 §6.7): two axes; point count = product of the point
// counts against SWEEP_CAP (over the cap still sendable, F4); grid of per-point Status in words
// and icon, and the feasible fraction.
// UX-7 (Doc 12 X2, X3): KPI strip; the grid is a status-grid figure (icon + word in every cell,
// never colour alone); focus or hover a cell to read its limiting constraint. One tab stop, arrows move.
import { useState, type KeyboardEvent } from "react";
import type { M3dPayload, RunRecord, SweepPoint } from "../../api-types";
import { axisNeeds, SizeIndicator, useAxis, useSweepCap } from "../../components/AxisForm";
import { ExampleGuide, ExampleNext, nextReady, useExampleForm } from "../../components/ExampleForm";
import { ChartFrame } from "../../components/charts/ChartFrame";
import { EmptyState } from "../../components/EmptyState";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import styles from "../../components/Further.module.css";
import { Icon, type IconName } from "../../components/Icon";
import { m3dKpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { KIND_WORDS } from "../../components/M2Results";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { useProject } from "../../store";
import { Toast } from "../../components/Toast";

const CELL: Record<string, [IconName, string, string]> = {
  FEASIBLE: ["feasible", "feasible", styles.ok],
  INFEASIBLE: ["misuse", "infeasible", styles.bad],
};
const cell = (s: string): [IconName, string, string] => CELL[s] ?? ["warn", s.toLowerCase().replace(/_/g, " "), styles.other];
const limiting = (g: SweepPoint) => {
  const c = g.limiting_constraint;
  return c ? `${KIND_WORDS[c.kind] ?? c.kind}, ${c.element_id}, normalised margin ${fmt(c.normalised_margin)}` : "none";
};

function Envelope() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3d");
  // Example mode (Doc 12 X9, D-92 K230/K231): X axis from the guided example, Y axis left to the user.
  const { example } = useProject();
  const s = example?.settings.screens.envelope;
  const x = useAxis(design, "X axis: ", s && { ex: s.fields.axis_x ?? null, needs: axisNeeds(s.needs_value, "axis_x") });
  const y = useAxis(design, "Y axis: ", s && { ex: s.fields.axis_y ?? null, needs: axisNeeds(s.needs_value, "axis_y") });
  const ex = useExampleForm("envelope", {}, { onReset: () => (x.reset(), y.reset()) });
  const cap = useSweepCap();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const points = x.steps !== null && y.steps !== null ? x.steps * y.steps : null;

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3dPayload) : null;
  return (
    <>
      <div className={styles.head}>
        <h1>Envelope (M3d)</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <ExampleGuide screen="envelope" />
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Envelope settings"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { axis_x: x.axis, axis_y: y.axis } });
        }}
      >
        <fieldset className={styles.box}>
          <legend>X axis</legend>
          {x.fields}
        </fieldset>
        <fieldset className={styles.box}>
          <legend>Y axis</legend>
          {y.fields}
        </fieldset>
        <SizeIndicator points={points} cap={cap} />
        {ex.resetButton}
        <button type="submit" className="primary" disabled={busy || fresh !== "current"} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run envelope"}
        </button>
      </form>
      {error && error !== dismissed && <Toast message={error} onDismiss={() => setDismissed(error)} />}
      {r && <StatusBanner type="M3d" result={r} />}
      {p && resp && <KpiStrip label="Envelope key figures" kpis={m3dKpis(p)} record={resp.run_record} />}
      {p && resp && (
        <>
          <p data-testid="feasible-fraction">Feasible fraction: {fmt(p.feasible_fraction * 100)} % of {p.grid.length} points</p>
          <StatusGrid p={p} x={x} y={y} record={resp.run_record} />
          <p className={styles.record}>
            RunRecord <code>{resp.run_record.record_id}</code>, engine {resp.run_record.engine_kind ?? "not called"}.
          </p>
        </>
      )}
      {!resp && <EmptyState title="No envelope run yet.">Choose two axes and run the envelope to see the status of every point.</EmptyState>}
      <ExampleNext screen="envelope" ready={nextReady(r?.status)} />
    </>
  );
}

type Ax = { name: string; unit: string };

function StatusGrid({ p, x, y, record }: { p: M3dPayload; x: Ax; y: Ax; record: RunRecord }) {
  const xs = [...new Set(p.grid.map((g) => g.x_value))];
  const ys = [...new Set(p.grid.map((g) => g.y_value))];
  const at = (r: number, c: number) => p.grid.find((q) => q.x_value === xs[c] && q.y_value === ys[r]);
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  const [shown, setShown] = useState<SweepPoint | null>(null);
  const keys = (e: KeyboardEvent<HTMLTableElement>) => {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (e.key === "Escape") return setShown(null);
    if (!d) return;
    e.preventDefault();
    const next: [number, number] = [Math.min(ys.length - 1, Math.max(0, pos[0] + d[0])), Math.min(xs.length - 1, Math.max(0, pos[1] + d[1]))];
    setPos(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-cell="${next[0]}-${next[1]}"]`)?.focus();
  };
  const legend = [
    { name: "feasible", swatch: <Icon name="feasible" /> },
    { name: "infeasible", swatch: <Icon name="misuse" /> },
    { name: "other Status, named in the cell", swatch: <Icon name="warn" /> },
  ];
  return (
    <ChartFrame
      title="Status per point"
      record={record}
      legend={legend}
      note="Every cell names its Status with an icon and a word. Focus the grid (arrow keys move) or point at a cell to read its limiting constraint."
      data={{
        columns: [`${x.name} (${x.unit})`, `${y.name} (${y.unit})`, "Status", "Limiting constraint"],
        rows: p.grid.map((g) => [g.x_value ?? null, g.y_value ?? null, g.status, limiting(g)]),
      }}
    >
      <table aria-label="Envelope grid" className={styles.grid} onKeyDown={keys}>
        <caption>
          Status per point: rows {y.name} ({y.unit}), columns {x.name} ({x.unit})
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {y.name} \ {x.name}
            </th>
            {xs.map((v) => (
              <th key={String(v)} scope="col">
                {fmt(v)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ys.map((yv, r) => (
            <tr key={String(yv)}>
              <th scope="row">{fmt(yv)}</th>
              {xs.map((xv, c) => {
                const g = at(r, c);
                if (!g) return <td key={String(xv)} />;
                const [icon, word, cls] = cell(g.status);
                return (
                  <td
                    key={String(xv)}
                    className={cls}
                    data-cell={`${r}-${c}`}
                    tabIndex={pos[0] === r && pos[1] === c ? 0 : -1}
                    onFocus={() => {
                      setPos([r, c]);
                      setShown(g);
                    }}
                    onMouseEnter={() => setShown(g)}
                  >
                    <Icon name={icon} /> {word}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p data-testid="envelope-readout" className={styles.readout} aria-live="polite">
        {shown
          ? `${x.name} ${fmt(shown.x_value)} ${x.unit}, ${y.name} ${fmt(shown.y_value)} ${y.unit}: ${shown.status}; limiting constraint: ${limiting(shown)}.`
          : "Focus or point at a cell to read its Status and limiting constraint."}
      </p>
    </ChartFrame>
  );
}

export default function EnvelopePage() {
  return (
    <RequireProject>
      <Envelope />
    </RequireProject>
  );
}
