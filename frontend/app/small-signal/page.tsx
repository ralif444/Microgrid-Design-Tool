"use client";
// S-13 Small-signal (M4a) (Doc 7 §6.6, Doc 3 §6.8): optional τ_in and damping threshold; class in
// words; validity-indicator panel (FR-61); τ_in pre-filled from a catalogue entry (Doc 12 FR-71).
import Link from "next/link";
import { useState } from "react";
import type { M4aPayload } from "../../api-types";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";

const CLASS_WORDS: Record<string, string> = {
  STABLE: "Stable: every eigenvalue lies in the left half-plane.",
  MARGINAL: "Marginal: the largest real part is zero within the tolerance.",
  UNSTABLE: "Unstable: at least one eigenvalue has a positive real part.",
};

const yesNo = (b: boolean | null | undefined, none: string) => (b === null || b === undefined ? none : b ? "yes" : "no");

function SmallSignal() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M4a");
  const refs = (design.inverters ?? []).flatMap((i) => (i.catalog_ref?.tau_in_s != null ? [i.catalog_ref] : []));
  const taus = new Set(refs.map((r) => r.tau_in_s));
  const from = taus.size === 1 ? refs[0] : null; // one τ_in per run, so only one shared value pre-fills
  const [tauIn, setTauIn] = useState<number | null>(from?.tau_in_s ?? null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M4aPayload) : null;
  const dom = new Set(p?.dominant_modes.map((d) => d.eigenvalue_index));
  return (
    <>
      <h1>Small-signal (M4a)</h1>
      <M1FreshnessBadge f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Small-signal settings"
        onSubmit={(e) => {
          e.preventDefault();
          const parameters: Record<string, number> = {};
          if (tauIn !== null) parameters.tau_in_s = tauIn;
          if (threshold !== null) parameters.damping_threshold_ratio = threshold;
          void run({ parameters });
        }}
      >
        <p>
          <NumberField id="tau-in" label="Inner-loop time constant τ_in, optional" unit="s" value={tauIn} onChange={setTauIn} />
        </p>
        {from && (
          <p data-testid="tau-in-source">
            Pre-filled from catalogue entry {from.entry_id}:{" "}
            {[from.provenance.manufacturer, from.provenance.model, from.provenance.document, from.provenance.revision, from.sources?.tau_in_s]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        )}
        {taus.size > 1 && <p>Catalogue entries give different τ_in values, so none is pre-filled.</p>}
        <p>
          <NumberField id="damping-threshold" label="Damping pass threshold, optional" unit="ratio" value={threshold} onChange={setThreshold} />
        </p>
        <button type="submit" disabled={busy || fresh !== "current"}>
          {busy ? "Running..." : "Run M4a"}
        </button>
      </form>
      <M1BlockedNote f={fresh} />
      {error && <p role="alert">{error}</p>}
      {r && <StatusBanner type="M4a" result={r} />}
      {p && (
        <>
          <h2>Class: {p.stability_class}</h2>
          <p data-testid="stability-class">{CLASS_WORDS[p.stability_class]}</p>
          <ul>
            <li>Lowest damping of the oscillatory modes ζ_min: {fmt(p.zeta_min)}</li>
            <li>Damping passes the threshold: {yesNo(p.damping_pass, "not judged (no threshold or no oscillatory mode)")}</li>
            {p.outside_definition && <li>The operating point violates constraints: outside definition [19].</li>}
          </ul>
          <IndicatorPanel />
          <table aria-label="Dominant modes">
            <caption>Dominant modes</caption>
            <thead>
              <tr>
                <th>Eigenvalue</th>
                <th>Damping ratio</th>
                <th>Frequency (Hz)</th>
                <th>Associated elements</th>
              </tr>
            </thead>
            <tbody>
              {p.dominant_modes.map((d) => (
                <tr key={d.eigenvalue_index}>
                  <td>#{d.eigenvalue_index}</td>
                  <td>{fmt(d.damping_ratio)}</td>
                  <td>{fmt(d.frequency_hz)}</td>
                  <td>
                    {d.associated_element_ids.map((id) => (
                      <Link key={id} href={`/network/?focus=${encodeURIComponent(id)}`}>
                        {id}
                      </Link>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <table aria-label="Eigenvalues">
            <caption>Eigenvalues and modes (Eq. 4.20)</caption>
            <thead>
              <tr>
                <th>#</th>
                <th>Real part (1/s)</th>
                <th>Imaginary part (1/s)</th>
                <th>Damping ratio</th>
                <th>Frequency (Hz)</th>
              </tr>
            </thead>
            <tbody>
              {p.eigenvalues.map((e, k) => {
                const m = p.modes.find((x) => x.eigenvalue_index === k);
                return (
                  <tr key={k}>
                    <td>
                      {k}
                      {dom.has(k) ? " (dominant)" : ""}
                    </td>
                    <td>{fmt(e.real_per_s)}</td>
                    <td>{fmt(e.imag_per_s)}</td>
                    <td>{fmt(m?.damping_ratio)}</td>
                    <td>{fmt(m?.frequency_hz)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {p.participation ? (
            <table aria-label="Participation factors">
              <caption>Participation factors (Eq. 4.21), rows = states, columns = modes</caption>
              <thead>
                <tr>
                  <th>State</th>
                  {p.participation.factors.map((_, k) => (
                    <th key={k}>#{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.participation.state_names.map((s, i) => (
                  <tr key={s}>
                    <td>{s}</td>
                    {p.participation!.factors.map((f, k) => (
                      <td key={k}>{fmt(f[i])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Participation factors not available: {String(r?.diagnostics?.participation_reason ?? "not reported")}.</p>
          )}
        </>
      )}
      {!resp && <p>Not run yet.</p>}
    </>
  );
}

export default function SmallSignalPage() {
  return (
    <RequireProject>
      <SmallSignal />
    </RequireProject>
  );
}
