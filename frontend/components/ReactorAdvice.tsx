"use client";
// X11 (ADR-017; .scratch/coupling-reactor/spec.md F3, F4): guidance on an unstable or under-damped
// small-signal result, and the reactor sizing advice RS. The server searches the reactor size with
// M1 and M4a; this panel sends the usable catalogue reactors, shows the outcome and, on Apply, adds
// a terminal bus and a REACTOR line per inverter (explicit topology, Q1). Nothing changes without Apply.
import { useEffect, useState } from "react";
import type { M4aPayload } from "../api-types";
import { useProjectDispatch } from "../store";
import { fromEntry, REACTOR_LENGTH_KM, useCatalog } from "./Catalog";
import { fixedOr } from "./format";
import { fmt, OutOfDate, RunButton, tauMissing, useDependentRun } from "./Further";
import styles from "./Further.module.css";
import { useLanguage } from "./Language";
import { NumberField } from "./NumberField";
import { StatusBanner } from "./StatusBanner";
import { Toast } from "./Toast";
import { useKept } from "./useKept";

export const GUIDANCE =
  "Plain droop control assumes the inverters are coupled through inductive lines. Short low-voltage cables are mostly resistive and can couple the inverters too tightly, which gives a poorly damped or growing oscillation. The usual remedies are a coupling reactor between each inverter and its bus, or more electrical distance between the inverters.";

type Point = { stability_class?: string | null; zeta_min?: number | null; frequency_hz?: number | null; min_voltage_pu?: number; percent?: number | null };
type Row = { inverter_id: string; bus_id: string; terminal_bus_id: string; rated_current_a: number; needed_inductance_mh: number; entry_id: string | null };
type RsPayload = { outcome: string; percent_of_base?: number; inverters?: Row[]; confirmed?: Point; base?: Point; caveat_text: string };

/** Shown when M4a is not STABLE or misses its damping threshold. */
export function needsReactorAdvice(p: M4aPayload | null): boolean {
  return !!p && (p.stability_class !== "STABLE" || p.damping_pass === false);
}

export function ReactorAdvice({ threshold }: { threshold: number | null }) {
  const { t } = useLanguage();
  const dispatch = useProjectDispatch();
  const { catalog, checks } = useCatalog();
  const { design, fresh, busy, resp, stale, error, clearError, run } = useDependentRun("RS");
  const usable = catalog.entries.filter((e) => e.kind === "REACTOR" && e.reactor && checks.some((c) => c.entry_id === e.id && c.usable));
  const w = 2 * Math.PI * (design.nominal_frequency_hz ?? 0);
  const ratios = usable.map((e) => (w * (e.reactor!.inductance_mh ?? 0)) / (e.reactor!.resistance_mohm ?? 1)).sort((a, b) => a - b);
  const median = ratios.length ? Number(ratios[Math.floor(ratios.length / 2)].toPrecision(3)) : null;
  const [target, setTarget] = useKept<number | null>("rsTarget", threshold);
  const [ceiling, setCeiling] = useKept<number | null>("rsCeiling", null);
  const [xr, setXr] = useKept<number | null>("rsXr", median);
  // the Catalogue check can finish after mount: fill X/R once its median is known, never over a value
  useEffect(() => {
    if (median !== null) setXr((v) => v ?? median);
  }, [median, setXr]);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const r = resp?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as RsPayload) : null;
  const missing = [...tauMissing(design), ...(target === null ? ["Damping target"] : []), ...(ceiling === null ? ["Search ceiling"] : []), ...(xr === null ? ["Reactor X/R"] : [])];

  const apply = () => {
    if (!p?.inverters) return;
    for (const row of p.inverters) {
      const entry = usable.find((e) => e.id === row.entry_id);
      if (!entry) continue;
      dispatch({ type: "rowAdded", collection: "buses", row: { id: row.terminal_bus_id } });
      dispatch({
        type: "rowAdded",
        collection: "lines",
        row: { from_bus_id: row.terminal_bus_id, to_bus_id: row.bus_id, ...fromEntry(entry, catalog.schema_version, true, design.nominal_frequency_hz) },
      });
      dispatch({ type: "rowUpdated", collection: "inverters", id: row.inverter_id, patch: { bus_id: row.terminal_bus_id } });
    }
    setConfirm(false);
    setNote(t("Reactors applied. Run M1 and small-signal stability again."));
  };

  return (
    <section aria-label={t("Coupling reactors")} className={styles.box} data-testid="reactor-advice">
      <h2>{t("Coupling reactors")}</h2>
      <p className={styles.facts} data-testid="reactor-guidance">
        {t(GUIDANCE)} {t("The reactor sizing below searches for the smallest reactor that reaches your damping target.")}
      </p>
      <form
        aria-label={t("Reactor sizing settings")}
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          setNote(null);
          const reactors = usable.map((x) => ({ entry_id: x.id, inductance_mh: x.reactor!.inductance_mh, resistance_mohm: x.reactor!.resistance_mohm, rated_current_a: x.reactor!.rated_current_a }));
          void run({ parameters: { damping_target_ratio: target, max_percent: ceiling, reactor_x_over_r: xr, reactors } });
        }}
      >
        <p>
          <NumberField id="rs-target" label="Damping target ζ*" unit="ratio" value={target} onChange={setTarget} />
        </p>
        <p>
          <NumberField id="rs-ceiling" label="Search ceiling, share of the inverter base impedance" unit="%" value={ceiling} onChange={setCeiling} />
        </p>
        <p>
          <NumberField id="rs-xr" label="Reactor X/R used by the search" unit="ratio" value={xr} onChange={setXr} />
        </p>
        <p className={styles.source}>
          {usable.length
            ? t("{n} usable reactor entries in the Catalogue; X/R pre-filled with their median.", { n: usable.length })
            : t("No usable reactor entries in the Catalogue: the search gives the needed inductance only.")}
        </p>
        <RunButton label="Size coupling reactors" busy={busy} fresh={fresh} missing={missing} />
      </form>
      {error && <Toast message={error} onDismiss={clearError} />}
      <OutOfDate show={stale} />
      {r && <StatusBanner type="RS" result={r} />}
      {p && (
        <div data-testid="reactor-result" data-outcome={p.outcome}>
          {p.percent_of_base !== undefined && (
            <p>{t("Smallest reactor that reaches the target: {value} % of each inverter's base impedance.", { value: fixedOr(p.percent_of_base, "ratio") })}</p>
          )}
          {p.inverters && (
            <table className={styles.grid} aria-label={t("Reactor per inverter")}>
              <thead>
                <tr>
                  <th scope="col">{t("Inverter")}</th>
                  <th scope="col">{t("Rated current")} (A)</th>
                  <th scope="col">{t("Needed inductance")} (mH)</th>
                  <th scope="col">{t("Suggested catalogue reactor")}</th>
                </tr>
              </thead>
              <tbody>
                {p.inverters.map((x) => (
                  <tr key={x.inverter_id}>
                    <th scope="row">{x.inverter_id}</th>
                    <td>{fmt(Number(x.rated_current_a.toPrecision(4)))}</td>
                    <td>{fmt(Number(x.needed_inductance_mh.toPrecision(3)))}</td>
                    <td>{x.entry_id ?? t("none fits")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {p.confirmed && (
            <p data-testid="reactor-confirmed">
              {t("Checked with the catalogue reactors: {cls}, ζ_min {zeta}, mode {f} Hz, lowest bus voltage {v} p.u.", {
                cls: p.confirmed.stability_class ?? "—",
                zeta: fixedOr(p.confirmed.zeta_min ?? null, "ratio"),
                f: fixedOr(p.confirmed.frequency_hz ?? null, "Hz"),
                v: fixedOr(p.confirmed.min_voltage_pu ?? null, "p.u."),
              })}
            </p>
          )}
          <p className={styles.source}>{t(p.caveat_text)}</p>
          {p.outcome === "FOUND" && !confirm && (
            <p>
              <button type="button" onClick={() => setConfirm(true)}>
                {t("Apply to the design")}
              </button>
            </p>
          )}
          {confirm && (
            <p role="alert" className={styles.actions}>
              {t("This adds a terminal bus and a reactor line ({length} km) for each inverter and moves the inverter to that bus.", { length: REACTOR_LENGTH_KM })}{" "}
              <button type="button" className="primary" onClick={apply}>
                {t("Apply")}
              </button>
              <button type="button" onClick={() => setConfirm(false)}>
                {t("Cancel")}
              </button>
            </p>
          )}
        </div>
      )}
      {note && <p role="status">{note}</p>}
    </section>
  );
}
