"use client";
// M4a charts (Doc 12 X3, FR-88), shared by S-13 and the S-16 report: the eigenvalue plane (dominant
// mode by shape, ζ and f as hover text from `modes`) and the participation grid (Eq. 4.21), or the
// reason it is not available. Values are read from the payload; nothing is derived.
import type { M4aPayload, RunRecord } from "../api-types";
import { GridChart } from "./charts/GridChart";
import { LineChart } from "./charts/LineChart";
import { Swatch } from "./charts/marks";
import { SERIES } from "./charts/palette";
import { fmt } from "./Further";
import { participationRows } from "./participation";

export type EigRow = { k: number; re: number; im: number; zeta: number | null | undefined; f: number | undefined; dominant: boolean };

export function eigenRows(p: M4aPayload): EigRow[] {
  const dom = new Set(p.dominant_modes.map((d) => d.eigenvalue_index));
  return p.eigenvalues.map((e, k) => {
    const m = p.modes.find((x) => x.eigenvalue_index === k);
    return { k, re: e.real_per_s, im: e.imag_per_s, zeta: m?.damping_ratio, f: m?.frequency_hz, dominant: dom.has(k) };
  });
}

export function M4aCharts({ p, record, reason }: { p: M4aPayload; record: RunRecord; reason: unknown }) {
  const eig = eigenRows(p);
  const dom = new Set(p.dominant_modes.map((d) => d.eigenvalue_index));
  return (
    <>
      <LineChart
        title="Eigenvalues in the complex plane"
        xTitle="Real part (1/s)"
        yTitle="Imaginary part (1/s)"
        x={eig.map((e) => e.re)}
        line={false}
        series={[
          {
            name: "Eigenvalue",
            values: eig.map((e) => e.im),
            marker: (i) => (eig[i].dominant ? { m: "diamond", filled: true } : { m: "circle" }),
            title: (i) => `#${eig[i].k}: ζ ${fmt(eig[i].zeta)}, f ${fmt(eig[i].f)} Hz${eig[i].dominant ? " (dominant)" : ""}`,
          },
        ]}
        legend={[
          { name: "Eigenvalue", word: "hollow circle", swatch: <Swatch color={SERIES[0]} marker="circle" /> },
          { name: "Dominant mode", word: "filled diamond", swatch: <Swatch color={SERIES[0]} marker="diamond" filled /> },
        ]}
        note="Hover a point for its damping ratio and frequency; the table lists every mode. No damping-threshold line is drawn."
        record={record}
      />
      {p.participation ? (
        <GridChart
          title="Participation factors (Eq. 4.21), states × modes"
          rowTitle="State"
          columns={p.participation.factors.map((_, k) => `#${k}${dom.has(k) ? " dom." : ""}`)}
          rows={participationRows(p.participation)}
          note="Rows are states grouped per inverter (δ, P_f, Q_f); columns are modes. The shade repeats the printed value."
          record={record}
        />
      ) : (
        <p>Participation factors not available: {String(reason ?? "not reported")}.</p>
      )}
    </>
  );
}
