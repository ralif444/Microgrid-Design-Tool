// Status strip of S-07 and S-08 (ADR-016, plan W3; mockup phase 2): power flow and constraint check as
// two statuses, the counts, a few key facts and the M1 freshness, in one row above the results. Values
// are read from the payloads (select and count only, guideline §1 rule 1), rounded for display.
import type { M1Payload, M2Payload, RunRecord } from "../api-types";
import styles from "./CheckStrip.module.css";
import { fixed } from "./format";
import { Icon, type IconName } from "./Icon";
import { pick } from "./kpi";
import { M1FreshnessBadge } from "./M1Freshness";
import { marginStatus, useMarginWarn } from "./M2Results";
import type { Freshness } from "./useValidation";

type Tone = "quiet" | "negative";
const Chip = ({ icon, tone = "quiet", children }: { icon: IconName; tone?: Tone; children: string }) => (
  <span className={styles.chip} data-tone={tone}>
    <Icon name={icon} />
    {children}
  </span>
);
const Fact = ({ label, value, unit, at }: { label: string; value: string; unit?: string; at?: string }) => (
  <span className={styles.fact}>
    <span className={styles.label}>{label}</span> {value}
    {unit && ` ${unit}`}
    {at && <span className={styles.label}> at {at}</span>}
  </span>
);

/** Counts of the margins table: pass, near limit, violated, not evaluated (zeros left out except pass). */
export function countsText(p: M2Payload, marginWarn: number | null): string {
  const s = p.constraint_margins.map((c) => marginStatus(c, marginWarn));
  const n = (k: string) => s.filter((x) => x === k).length;
  return [
    `${n("pass") + n("near")} pass`,
    ...(n("near") ? [`${n("near")} near limit`] : []),
    ...(n("violated") ? [`${n("violated")} violated`] : []),
    ...(p.not_evaluated.length ? [`${p.not_evaluated.length} not evaluated`] : []),
  ].join(", ");
}

const runTitle = (r: RunRecord | null) =>
  r ? `Power flow run ${r.created_at.slice(0, 16).replace("T", " ")}, engine ${r.engine_kind ?? "not called"}${r.engine_version ? ` ${r.engine_version}` : ""}, RunRecord ${r.record_id}` : undefined;

export function CheckStrip({
  fresh,
  m1,
  m1Record,
  m2,
}: {
  fresh: Freshness;
  /** current FEASIBLE M1 payload, or null */
  m1: M1Payload | null;
  m1Record: RunRecord | null;
  /** S-08 only: the current M2 payload, or null when not run on this design */
  m2?: M2Payload | null;
}) {
  const marginWarn = useMarginWarn();
  const lo = m1 && pick(m1.bus_results, (b) => b.voltage_pu);
  return (
    <section aria-label="Check status" className={styles.strip}>
      {m1 ? <Chip icon="feasible">Power flow solved</Chip> : <Chip icon="dot">No current power flow</Chip>}
      {m2 !== undefined &&
        (m2 ? (
          <>
            {m2.verdict === "FEASIBLE" ? <Chip icon="feasible">Feasible</Chip> : <Chip icon="misuse" tone="negative">Not feasible</Chip>}
            <span className={styles.fact}>{countsText(m2, marginWarn)}</span>
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
      {m2 && <Fact label="λ_c" value={m2.loadability.lambda_c === null ? "not available" : fixed(m2.loadability.lambda_c, "ratio")} />}
      <span className={styles.spacer} />
      <M1FreshnessBadge f={fresh} title={runTitle(m1Record)} />
    </section>
  );
}
