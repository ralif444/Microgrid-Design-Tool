// Status strip of S-07 and S-08 (ADR-016, plan W3; mockup phase 2): power flow and constraint check as
// two statuses, the counts, a few key facts and the M1 freshness, in one row above the results. Values
// are read from the payloads (select and count only, guideline §1 rule 1), rounded for display.
import type { ReactNode } from "react";
import type { M1Payload, M2Payload, RunRecord } from "../api-types";
import { useProject } from "../store";
import type { M2Params } from "./elementFields";
import styles from "./CheckStrip.module.css";
import { fixed } from "./format";
import { Icon, type IconName } from "./Icon";
import { displayLang, translate } from "./i18n";
import { useLanguage } from "./Language";
import { pick } from "./kpi";
import { M1FreshnessBadge } from "./M1Freshness";
import { m2NothingChecked } from "./status-text";
import { marginStatus, useMarginWarn } from "./M2Results";
import type { Freshness } from "./useValidation";

type Tone = "quiet" | "negative";
const Chip = ({ icon, tone = "quiet", children }: { icon: IconName; tone?: Tone; children: string }) => {
  const { t } = useLanguage();
  return (
    <span className={styles.chip} data-tone={tone}>
      <Icon name={icon} />
      {t(children)}
    </span>
  );
};
const Fact = ({ label, value, unit, at }: { label: string; value: string; unit?: string; at?: string }) => {
  const { t } = useLanguage();
  return (
    <span className={styles.fact}>
      <span className={styles.label}>{t(label)}</span> {value}
      {unit && ` ${unit}`}
      {at && <span className={styles.label}> {t("at {bus}", { bus: at })}</span>}
    </span>
  );
};

/** Counts of the margins table: pass, near limit, violated, not evaluated (zeros left out except pass). */
export function countsText(p: M2Payload, marginWarn: number | null): string {
  const s = p.constraint_margins.map((c) => marginStatus(c, marginWarn));
  const n = (k: string) => s.filter((x) => x === k).length;
  const t = (key: string, count: number) => translate(displayLang(), key, { count });
  return [
    `${t("{count} pass", n("pass") + n("near"))}${n("near") ? ` (${t("{count} near limit", n("near"))})` : ""}`,
    ...(n("violated") ? [t("{count} violated", n("violated"))] : []),
    ...(p.not_evaluated.length ? [t("{count} not evaluated", p.not_evaluated.length)] : []),
  ].join(", ");
}

const runTitle = (r: RunRecord | null) =>
  r
    ? translate(displayLang(), "Power flow run {at}, engine {engine}, RunRecord {id}", {
        at: r.created_at.slice(0, 16).replace("T", " "),
        engine: `${r.engine_kind ?? translate(displayLang(), "not called")}${r.engine_version ? ` ${r.engine_version}` : ""}`,
        id: r.record_id,
      })
    : undefined;

export function CheckStrip({
  fresh,
  m1,
  m1Record,
  m2,
  m2Record,
}: {
  fresh: Freshness;
  /** current FEASIBLE M1 payload, or null */
  m1: M1Payload | null;
  m1Record: RunRecord | null;
  /** S-08 only: the current M2 payload, or null when not run on this design */
  m2?: M2Payload | null;
  /** its RunRecord, to restate the design margins the check used (audit D-9) */
  m2Record?: RunRecord | null;
}) {
  const { t } = useLanguage();
  const used = m2Record?.parameters as { inverter_margin_ratio?: number; line_margin_ratio?: number } | undefined;
  const marginWarn = useMarginWarn();
  const lo = m1 && pick(m1.bus_results, (b) => b.voltage_pu);
  return (
    <section aria-label={t("Check status")} className={styles.strip}>
      {m1 ? <Chip icon="feasible">Power flow solved</Chip> : <Chip icon="dot">No current power flow</Chip>}
      {m2 !== undefined &&
        (m2 ? (
          <>
            {m2.verdict !== "FEASIBLE" ? (
              <Chip icon="misuse" tone="negative">Not feasible</Chip>
            ) : m2NothingChecked(m2) ? (
              <Chip icon="dot">Nothing checked: no limits set</Chip>
            ) : (
              <Chip icon="feasible">Feasible</Chip>
            )}
            <span className={styles.fact}>{countsText(m2, marginWarn)}</span>
            {typeof used?.inverter_margin_ratio === "number" && typeof used.line_margin_ratio === "number" && (
              <Fact label="with m_inv" value={`${fixed(used.inverter_margin_ratio, "ratio")}, m_line ${fixed(used.line_margin_ratio, "ratio")}`} />
            )}
          </>
        ) : (
          <Chip icon="dot">No current constraint check</Chip>
        ))}
      {m1 && (
        <>
          <Fact label="System frequency" value={fixed(m1.system_frequency_hz, "Hz")} unit="Hz" />
          {lo && <Fact label="Lowest bus voltage" value={fixed(lo.voltage_pu, "p.u.")} unit="p.u." at={lo.bus_id} />}
          <Fact label="Total losses" value={fixed(m1.total_losses_kw, "kW")} unit="kW" />
        </>
      )}
      {m2 && <Fact label="λ_c" value={m2.loadability.lambda_c === null ? t("not available") : fixed(m2.loadability.lambda_c, "ratio")} />}
      <span className={styles.spacer} />
      <M1FreshnessBadge f={fresh} title={runTitle(m1Record)} />
    </section>
  );
}

// Audit O-8: the m_inv the accepted Sizing advice used, next to M2's own m_inv field. The two stay
// separate inputs; the button only copies the value. Audit O3 (user 2026-11-15): Sizing owns t_aut, η_dc
// and DoD, so those M2 fields get the same note and copy button. Other fields keep the example note.
const FROM_SIZING: Partial<Record<keyof M2Params, string>> = {
  inverter_margin_ratio: "ratio",
  autonomy_h: "h",
  dc_efficiency_ratio: "ratio",
  depth_of_discharge_ratio: "ratio",
};
export function useSizingMarginNote(ex: { values: M2Params; set: (k: keyof M2Params, v: number | null) => void; note: (k: string) => ReactNode }) {
  const { t } = useLanguage();
  const { sizingAdvice } = useProject();
  const ps = sizingAdvice.findLast((a) => a.state === "ACCEPTED")?.ps_parameters;
  return (k: keyof M2Params): ReactNode => {
    const unit = FROM_SIZING[k];
    const m = unit && ps ? ((ps as unknown as Record<string, number | null>)[k] ?? null) : null;
    if (m === null) return ex.note(k);
    const v = `${fixed(m, unit!)}${unit === "h" ? " h" : ""}`;
    return (
      <>
        {ex.note(k)} {t("Accepted sizing advice used {v}.", { v })}
        {ex.values[k] !== m && (
          <>
            {" "}
            <button type="button" onClick={() => ex.set(k, m)}>
              {t("Use {v} from sizing advice", { v })}
            </button>
          </>
        )}
      </>
    );
  };
}
