"use client";
// S-12 Envelope (M3d) (Doc 7 §2, Doc 3 §6.7): two axes; point count = product of the point
// counts against SWEEP_CAP (over the cap still sendable, F4); grid of per-point Status in words
// and marker (o feasible, x infeasible, – failed), and the feasible fraction.
import type { M3dPayload } from "../../api-types";
import { SizeIndicator, useAxis, useSweepCap } from "../../components/AxisForm";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";

const MARK: Record<string, string> = { FEASIBLE: "o feasible", INFEASIBLE: "x infeasible" };

function Envelope() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M3d");
  const x = useAxis(design, "X axis: ");
  const y = useAxis(design, "Y axis: ");
  const cap = useSweepCap();
  const points = x.steps !== null && y.steps !== null ? x.steps * y.steps : null;

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M3dPayload) : null;
  const xs = p ? [...new Set(p.grid.map((g) => g.x_value))] : [];
  const ys = p ? [...new Set(p.grid.map((g) => g.y_value))] : [];
  return (
    <>
      <h1>Envelope (M3d)</h1>
      <M1FreshnessBadge f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Envelope settings"
        onSubmit={(e) => {
          e.preventDefault();
          void run({ parameters: { axis_x: x.axis, axis_y: y.axis } });
        }}
      >
        <fieldset>
          <legend>X axis</legend>
          {x.fields}
        </fieldset>
        <fieldset>
          <legend>Y axis</legend>
          {y.fields}
        </fieldset>
        <SizeIndicator points={points} cap={cap} />
        <button type="submit" disabled={busy || fresh !== "current"}>
          {busy ? "Running..." : "Run envelope"}
        </button>
      </form>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M3d" result={r} />}
      {p && (
        <>
          <p data-testid="feasible-fraction">Feasible fraction: {fmt(p.feasible_fraction * 100)} % of {p.grid.length} points</p>
          <table aria-label="Envelope grid">
            <caption>
              Status per point: rows {y.name} ({y.unit}), columns {x.name} ({x.unit})
            </caption>
            <thead>
              <tr>
                <th>
                  {y.name} \ {x.name}
                </th>
                {xs.map((v) => (
                  <th key={String(v)}>{fmt(v)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ys.map((yv) => (
                <tr key={String(yv)}>
                  <th scope="row">{fmt(yv)}</th>
                  {xs.map((xv) => {
                    const g = p.grid.find((q) => q.x_value === xv && q.y_value === yv);
                    return <td key={String(xv)}>{g ? (MARK[g.status] ?? `– ${g.status}`) : ""}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {!resp && <p>No envelope run yet.</p>}
    </>
  );
}

export default function EnvelopePage() {
  return (
    <RequireProject>
      <Envelope />
    </RequireProject>
  );
}
