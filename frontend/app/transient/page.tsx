"use client";
// S-14 Transient (M4b) (Doc 7 §6.6, Doc 3 §6.9): one disturbance from the four-kind catalogue,
// simulation end, optional settling criteria without defaults (D-55 K90); time responses with a
// data table; class in words, or "not set" without settling criteria.
// UX-6 (Doc 12 X2, X3, X4): KPI strip, time responses with crosshair, start mark and final window.
import { useState } from "react";
import type { M4bPayload } from "../../api-types";
import { LineChart } from "../../components/charts/LineChart";
import { EmptyState } from "../../components/EmptyState";
import { fmt, InfeasibleNote, useDependentRun } from "../../components/Further";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { m4bKpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import styles from "../../components/Further.module.css";

type Settling = { frequency_band_hz?: number | null; voltage_band_kv?: number | null; window_s?: number | null };
type Sent = { disturbance?: { start_time_s?: number | null }; settling?: Settling };

type Kind = "LOAD_STEP" | "LOAD_SCALING" | "REFERENCE_STEP" | "INVERTER_OUTAGE";
type Ref = "P_SETPOINT" | "Q_SETPOINT" | "V_SETPOINT" | "F_SETPOINT";

const KINDS: [Kind, string][] = [
  ["LOAD_STEP", "Load step"],
  ["LOAD_SCALING", "Load scaling (one load or all)"],
  ["REFERENCE_STEP", "Reference step on an inverter"],
  ["INVERTER_OUTAGE", "Inverter outage (permanent)"],
];
const REFS: [Ref, string, string][] = [
  ["P_SETPOINT", "P* active power set-point", "kW"],
  ["Q_SETPOINT", "Q* reactive power set-point", "kvar"],
  ["V_SETPOINT", "V* voltage set-point, line-to-line", "kV"],
  ["F_SETPOINT", "ω* frequency set-point", "Hz"],
];
const CLASS_WORDS: Record<string, string> = {
  RECOVERED_STABLE: "Recovered and stable: settled and inside the frequency and voltage bands.",
  CRITERIA_VIOLATED: "Settled, but the frequency or voltage left its band after the disturbance.",
  UNSTABLE: "Unstable: not settled, or the network solution was lost.",
};

function Transient() {
  const { design, fresh, busy, resp, error, run, m2Infeasible } = useDependentRun("M4b");
  const [kind, setKind] = useState<Kind>("LOAD_STEP");
  const [element, setElement] = useState("");
  const [reference, setReference] = useState<Ref>("P_SETPOINT");
  const [magnitude, setMagnitude] = useState<number | null>(null);
  const [magKvar, setMagKvar] = useState<number | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [permanent, setPermanent] = useState(true);
  const [duration, setDuration] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [fBand, setFBand] = useState<number | null>(null);
  const [vBand, setVBand] = useState<number | null>(null);
  const [win, setWin] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const onLoads = kind === "LOAD_STEP" || kind === "LOAD_SCALING";
  const elements = [
    ...(onLoads ? (design.loads ?? []) : (design.inverters ?? [])).map((x) => String(x.id)),
    ...(kind === "LOAD_SCALING" ? ["ALL"] : []),
  ];
  const magUnit =
    kind === "LOAD_STEP" ? "kW" : kind === "LOAD_SCALING" ? "ratio" : (REFS.find(([r]) => r === reference)?.[2] ?? "");

  function submit() {
    const disturbance: Record<string, unknown> = { kind, element_id: element || null, start_time_s: start };
    if (kind !== "INVERTER_OUTAGE") disturbance.magnitude = magnitude;
    if (kind === "LOAD_STEP" && magKvar !== null) disturbance.magnitude_kvar = magKvar;
    if (kind === "REFERENCE_STEP") disturbance.reference = reference;
    disturbance.duration_s = kind === "INVERTER_OUTAGE" || permanent ? null : duration;
    const parameters: Record<string, unknown> = { disturbance, simulation_end_s: end };
    if (fBand !== null || vBand !== null || win !== null)
      parameters.settling = { frequency_band_hz: fBand, voltage_band_kv: vBand, window_s: win };
    void run({ parameters });
  }

  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as M4bPayload) : null;
  // what the run was asked (RunRecord parameters), not what the form shows now
  const sent = (resp?.run_record.parameters ?? {}) as Sent;
  const startS = sent.disturbance?.start_time_s ?? null;
  const st = sent.settling;
  const lastT = p?.time_s.length ? p.time_s[p.time_s.length - 1] : null;
  const band = st?.window_s && lastT !== null ? { to: lastT, span: st.window_s } : undefined;
  const note = [
    startS !== null ? `Dashed vertical line: disturbance start at ${fmt(startS)} s.` : null,
    band
      ? `Shaded: the final window of ${fmt(st?.window_s)} s of the settling check (bands: frequency ${fmt(st?.frequency_band_hz)} Hz, voltage ${fmt(st?.voltage_band_kv)} kV, judged by the engine around the final value).`
      : "No settling criteria in this run, so no final window is drawn.",
    "Focus a chart and use ←/→, Home, End to read exact samples; Escape hides the readout.",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <div className={styles.head}>
        <h1>Transient (M4b)</h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <form
        aria-label="Transient settings"
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <p>
          <label htmlFor="d-kind">Disturbance</label>{" "}
          <select
            id="d-kind"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setElement("");
            }}
          >
            {KINDS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>{" "}
          <label htmlFor="d-element">Element</label>{" "}
          <select id="d-element" value={element} onChange={(e) => setElement(e.target.value)}>
            <option value="">Choose…</option>
            {elements.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </p>
        {kind === "REFERENCE_STEP" && (
          <p>
            <label htmlFor="d-ref">Reference</label>{" "}
            <select id="d-ref" value={reference} onChange={(e) => setReference(e.target.value as Ref)}>
              {REFS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </p>
        )}
        {kind !== "INVERTER_OUTAGE" && (
          <p>
            <NumberField id="d-mag" label={kind === "LOAD_SCALING" ? "Scaling factor" : "Step size"} unit={magUnit} value={magnitude} onChange={setMagnitude} />
          </p>
        )}
        {kind === "LOAD_STEP" && (
          <p>
            <NumberField id="d-mag-kvar" label="Reactive step, optional" unit="kvar" value={magKvar} onChange={setMagKvar} />
          </p>
        )}
        <p>
          <NumberField id="d-start" label="Start time" unit="s" value={start} onChange={setStart} />
        </p>
        <p>
          <NumberField id="sim-end" label="Simulation end" unit="s" value={end} onChange={setEnd} />
        </p>
        {kind !== "INVERTER_OUTAGE" && (
          <p>
            <label>
              <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} /> Permanent
            </label>{" "}
            {!permanent && <NumberField id="d-duration" label="Duration" unit="s" value={duration} onChange={setDuration} />}
          </p>
        )}
        <fieldset className={styles.settling}>
          <legend>Settling criteria, optional (no defaults; without them no class is set)</legend>
          <NumberField id="st-f" label="Frequency band" unit="Hz" value={fBand} onChange={setFBand} />
          <NumberField id="st-v" label="Voltage band, line-to-line" unit="kV" value={vBand} onChange={setVBand} />
          <NumberField id="st-w" label="Final window" unit="s" value={win} onChange={setWin} />
        </fieldset>
        <button type="submit" className="primary" disabled={busy || fresh !== "current"} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run M4b"}
        </button>
      </form>
      {error && error !== dismissed && <Toast message={error} onDismiss={() => setDismissed(error)} />}
      {r && <StatusBanner type="M4b" result={r} />}
      {p && resp && <KpiStrip label="Transient key figures" kpis={m4bKpis(p)} record={resp.run_record} />}
      {p && resp && (
        <>
          <h2>Class: {p.transient_class ?? "not set"}</h2>
          <p data-testid="transient-class">
            {p.transient_class ? CLASS_WORDS[p.transient_class] : `No class: ${p.class_reason ?? "reason not given"}.`}
          </p>
          <ul className={styles.facts}>
            <li>Settled: {p.settled === null || p.settled === undefined ? "not judged" : p.settled ? "yes" : "no"}</li>
            <li>Largest rate of change of frequency (descriptive): {fmt(p.max_rocof_hz_per_s)} Hz/s</li>
          </ul>
          <IndicatorPanel />
          {(
            [
              ["System frequency", "Hz", [{ name: "system", values: p.system_frequency_hz }]],
              ["Bus voltage", "kV", p.bus_voltage_kv.map((b) => ({ name: b.bus_id, values: b.values }))],
              ["Inverter active power", "kW", p.inverter_p_kw.map((s) => ({ name: s.inverter_id, values: s.values }))],
              ["Inverter reactive power", "kvar", p.inverter_q_kvar.map((s) => ({ name: s.inverter_id, values: s.values }))],
            ] as const
          ).map(([label, unit, series]) => (
            <LineChart
              key={label}
              title={label}
              xTitle="time (s)"
              yTitle={`${label} (${unit})`}
              x={p.time_s}
              series={[...series]}
              crosshair={{ xName: "t", xUnit: "s", unit }}
              vmarks={startS !== null ? [{ x: startS, label: "start" }] : []}
              xband={band}
              note={note}
              record={resp.run_record}
            />
          ))}
          <p className={styles.record}>
            RunRecord <code>{resp.run_record.record_id}</code>, engine {resp.run_record.engine_kind ?? "not called"}.
          </p>
        </>
      )}
      {!resp && <EmptyState title="Not run yet.">Define a disturbance and run M4b to see the time responses and the transient class.</EmptyState>}
    </>
  );
}

export default function TransientPage() {
  return (
    <RequireProject>
      <Transient />
    </RequireProject>
  );
}
