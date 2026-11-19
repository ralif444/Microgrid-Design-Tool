"use client";
// S-14 Transient (M4b) (Doc 7 §6.6, Doc 3 §6.9): one disturbance from the four-kind catalogue,
// simulation end, optional settling criteria without defaults (D-55 K90); time responses with a
// data table; class in words, or "not set" without settling criteria.
// UX-6 (Doc 12 X2, X3, X4): KPI strip, time responses with crosshair, start mark and final window.
import { useKept } from "../../components/useKept";
import type { M4bPayload } from "../../api-types";
import { LineChart } from "../../components/charts/LineChart";
import { EmptyState } from "../../components/EmptyState";
import { ExampleGuide, ExampleNext, ExampleTag, nextReady, NotSet, useExampleForm } from "../../components/ExampleForm";
import { fixedOr } from "../../components/format";
import { fmt, InfeasibleNote, OutOfDate, RunButton, tauMissing, useDependentRun } from "../../components/Further";
import { IndicatorPanel } from "../../components/IndicatorPanel";
import { useLanguage } from "../../components/Language";
import { m4bKpis } from "../../components/kpi";
import { KpiStrip } from "../../components/KpiStrip";
import { M1BlockedNote, M1FreshnessBadge } from "../../components/M1Freshness";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { ResultSheet } from "../../components/ResultSheet";
import { StatusBanner } from "../../components/StatusBanner";
import { Toast } from "../../components/Toast";
import styles from "../../components/Further.module.css";
import { useProject } from "../../store";
import type { ExamplePreset } from "../../store/example";

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
  const { t } = useLanguage();
  const { design, fresh, busy, resp, stale, error, clearError, run, m2Infeasible } = useDependentRun("M4b");
  // Example mode (Doc 12 X9 FR-103, D-92 K232): the seven D2 cases of Doc 13 §5 (SM, DR, TS; D-116) as presets;
  // the first fills the form on arrival, choosing one refills it, any edit makes the values the user's.
  const { example } = useProject();
  const presets = example?.settings.screens.transient?.presets ?? [];
  const d0 = presets[0]?.fields.disturbance as Record<string, unknown> | undefined;
  const ex = useExampleForm("transient", {}, {
    onReset: () => {
      if (presets[0]) apply(presets[0]);
      if (!s0) return;
      setFBand(s0.frequency_band_hz ?? null);
      setVBand(s0.voltage_band_kv ?? null);
      setWin(s0.window_s ?? null);
    },
  });
  const [preset, setPreset] = useKept("preset", presets[0]?.id ?? "");
  const [kind, setKindRaw] = useKept<Kind>("kind", (d0?.kind as Kind) ?? "LOAD_STEP");
  const [element, setElementRaw] = useKept("element", (d0?.element_id as string) ?? "");
  const [reference, setReferenceRaw] = useKept<Ref>("reference", (d0?.reference as Ref) ?? "P_SETPOINT");
  const [magnitude, setMagnitudeRaw] = useKept<number | null>("magnitude", (d0?.magnitude as number) ?? null);
  const [magKvar, setMagKvarRaw] = useKept<number | null>("magKvar", (d0?.magnitude_kvar as number) ?? null);
  const [start, setStartRaw] = useKept<number | null>("start", (d0?.start_time_s as number) ?? null);
  const [permanent, setPermanentRaw] = useKept("permanent", d0 ? d0.duration_s === null : true);
  const [duration, setDurationRaw] = useKept<number | null>("duration", (d0?.duration_s as number) ?? null);
  const [end, setEndRaw] = useKept<number | null>("end", presets[0]?.fields.simulation_end_s ?? null);
  const own =
    <V,>(f: (v: V) => void) =>
    (v: V) => {
      f(v);
      setPreset("");
    };
  const [setKind, setElement, setReference, setMagnitude, setMagKvar, setStart, setPermanent, setDuration, setEnd] = [
    own(setKindRaw), own(setElementRaw), own(setReferenceRaw), own(setMagnitudeRaw), own(setMagKvarRaw),
    own(setStartRaw), own(setPermanentRaw), own(setDurationRaw), own(setEndRaw),
  ];
  function apply(pr: ExamplePreset) {
    const d = pr.fields.disturbance;
    setKindRaw(d.kind as Kind);
    setElementRaw((d.element_id as string) ?? "");
    setReferenceRaw((d.reference as Ref) ?? "P_SETPOINT");
    setMagnitudeRaw((d.magnitude as number) ?? null);
    setMagKvarRaw((d.magnitude_kvar as number) ?? null);
    setStartRaw((d.start_time_s as number) ?? null);
    setPermanentRaw(d.duration_s === null || d.duration_s === undefined);
    setDurationRaw((d.duration_s as number) ?? null);
    setEndRaw(pr.fields.simulation_end_s);
    setPreset(pr.id);
  }
  const chosen = presets.find((x) => x.id === preset);
  // D-121: the example's settling bands are the author's declared convention (Doc 13 §6)
  const st0 = example?.settings.screens.transient?.fields.settling;
  const s0 = st0?.value as Settling | undefined;
  const [fBand, setFBand] = useKept<number | null>("fBand", s0?.frequency_band_hz ?? null);
  const [vBand, setVBand] = useKept<number | null>("vBand", s0?.voltage_band_kv ?? null);
  const [win, setWin] = useKept<number | null>("win", s0?.window_s ?? null);

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
    startS !== null ? t("Dashed vertical line: disturbance start at {value} s.", { value: fmt(startS) }) : null,
    band
      ? t("Shaded: the final window of {window} s of the settling check (bands: frequency {f} Hz, voltage {v} kV, judged by the engine around the final value).", { window: fmt(st?.window_s), f: fmt(st?.frequency_band_hz), v: fmt(st?.voltage_band_kv) })
      : t("No settling criteria in this run, so no final window is drawn."),
    t("Focus a chart and use ←/→, Home, End to read exact samples; Escape hides the readout."),
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <div className={styles.head}>
        <h1>
          {t("Transient")} <span className="code-label">(M4b)</span>
        </h1>
        <M1FreshnessBadge f={fresh} />
      </div>
      <ExampleGuide screen="transient" />
      <M1BlockedNote f={fresh} />
      <InfeasibleNote show={m2Infeasible} />
      <div className={styles.study}>
      <form
        aria-label={t("Transient settings")}
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {presets.length > 0 && (
          <p>
            <label htmlFor="d-preset">{t("Example disturbance")}</label>{" "}
            <select
              id="d-preset"
              value={preset}
              onChange={(e) => {
                const pr = presets.find((x) => x.id === e.target.value);
                if (pr) apply(pr);
              }}
            >
              {presets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
              <option value="">{t("Your own values")}</option>
            </select>
            {chosen && <ExampleTag label={t("Example disturbance")} source={chosen.source} />}
          </p>
        )}
        <p>
          <label htmlFor="d-kind">{t("Disturbance")}</label>{" "}
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
                {t(label)}
              </option>
            ))}
          </select>{" "}
          <label htmlFor="d-element">{t("Element")}</label>{" "}
          <select id="d-element" value={element} onChange={(e) => setElement(e.target.value)}>
            <option value="">{t("Choose…")}</option>
            {elements.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </p>
        {kind === "REFERENCE_STEP" && (
          <p>
            <label htmlFor="d-ref">{t("Reference")}</label>{" "}
            <select id="d-ref" value={reference} onChange={(e) => setReference(e.target.value as Ref)}>
              {REFS.map(([k, label]) => (
                <option key={k} value={k}>
                  {t(label)}
                </option>
              ))}
            </select>
          </p>
        )}
        {kind !== "INVERTER_OUTAGE" && (
          <p>
            <NumberField id="d-mag" label={kind === "LOAD_SCALING" ? t("Scaling factor") : t("Step size")} unit={magUnit} value={magnitude} onChange={setMagnitude} />
          </p>
        )}
        {kind === "LOAD_STEP" && (
          <p>
            <NumberField id="d-mag-kvar" label={t("Reactive step, optional")} unit="kvar" value={magKvar} onChange={setMagKvar} />
          </p>
        )}
        <p>
          <NumberField id="d-start" label={t("Start time")} unit="s" value={start} onChange={setStart} />
        </p>
        <p>
          <NumberField id="sim-end" label={t("Simulation end")} unit="s" value={end} onChange={setEnd} />
        </p>
        {kind !== "INVERTER_OUTAGE" && (
          <p>
            <label>
              <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} /> {t("Permanent")}
            </label>{" "}
            {!permanent && <NumberField id="d-duration" label={t("Duration")} unit="s" value={duration} onChange={setDuration} />}
          </p>
        )}
        <fieldset className={styles.settling}>
          <legend>{t("Settling criteria, optional (no defaults; without them no class is set)")}</legend>
          {ex.needs("settling") && fBand === null && vBand === null && win === null && <NotSet />}
          {s0 && fBand === s0.frequency_band_hz && vBand === s0.voltage_band_kv && win === s0.window_s && (
            <ExampleTag label={t("Example settling criteria")} source={st0!.source} />
          )}
          <NumberField id="st-f" label={t("Frequency band")} unit="Hz" value={fBand} onChange={setFBand} />
          <NumberField id="st-v" label={t("Voltage band, line-to-line")} unit="kV" value={vBand} onChange={setVBand} />
          <NumberField id="st-w" label={t("Final window")} unit="s" value={win} onChange={setWin} />
        </fieldset>
        {presets.length > 0 && ex.resetButton}
        <RunButton
          label="Run transient simulation"
          busy={busy}
          fresh={fresh}
          missing={[
            !element && "Element",
            kind !== "INVERTER_OUTAGE" && magnitude === null && (kind === "LOAD_SCALING" ? "Scaling factor" : "Step size"),
            start === null && "Start time",
            end === null && "Simulation end",
            kind !== "INVERTER_OUTAGE" && !permanent && duration === null && "Duration",
            ...tauMissing(design),
          ].filter((x): x is string => !!x)}
        />
      </form>
      <div className={styles.result}>
      {error && <Toast message={error} onDismiss={clearError} />}
      <OutOfDate show={stale} />
      {resp && r && (
        <ResultSheet record={resp.run_record}>
          <StatusBanner type="M4b" result={r} />
      {p && resp && <KpiStrip label={t("Transient key figures")} kpis={m4bKpis(p)} record={resp.run_record} />}
      {p && resp && (
        <>
          <h2>{t("Class: {value}", { value: p.transient_class ?? t("not set") })}</h2>
          <p data-testid="transient-class">
            {p.transient_class ? t(CLASS_WORDS[p.transient_class]) : t("No class: {reason}.", { reason: p.class_reason ?? t("reason not given") })}
          </p>
          <ul className={styles.facts}>
            <li>{t("Settled: {value}", { value: p.settled === null || p.settled === undefined ? t("not judged") : p.settled ? t("yes") : t("no") })}</li>
            <li>{t("Largest rate of change of frequency (descriptive): {value} Hz/s", { value: fixedOr(p.max_rocof_hz_per_s, "Hz/s") })}</li>
          </ul>
          <IndicatorPanel />
          {(
            [
              ["System frequency", "Hz", [{ name: t("system"), values: p.system_frequency_hz }]],
              ["Bus voltage", "kV", p.bus_voltage_kv.map((b) => ({ name: b.bus_id, values: b.values }))],
              ["Inverter active power", "kW", p.inverter_p_kw.map((s) => ({ name: s.inverter_id, values: s.values }))],
              ["Inverter reactive power", "kvar", p.inverter_q_kvar.map((s) => ({ name: s.inverter_id, values: s.values }))],
            ] as const
          ).map(([label, unit, series]) => (
            <LineChart
              key={label}
              title={t(label)}
              xTitle={t("time (s)")}
              yTitle={`${t(label)} (${unit})`}
              x={p.time_s}
              series={[...series]}
              crosshair={{ xName: "t", xUnit: "s", unit }}
              vmarks={startS !== null ? [{ x: startS, label: t("start") }] : []}
              xband={band}
              note={note}
              record={resp.run_record}
            />
          ))}
        </>
      )}
        </ResultSheet>
      )}
      {!resp && <EmptyState title={t("Not run yet.")}>{t("Define a disturbance and run M4b to see the time responses and the transient class.")}</EmptyState>}
      </div>
      </div>
      <ExampleNext screen="transient" ready={nextReady(r?.status)} />
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
