// M1 freshness badge and blocked banner for S-07 and S-08 (Doc 7 §3.1, §5).
import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./ui.module.css";
import type { Freshness } from "./useValidation";

// Quiet chip (ADR-016 §3, W3): grey when current or not run, attention colour when stale; icon + word.
// `title` carries the run details (date, engine) where the caller has them.
export function M1FreshnessBadge({ f, title }: { f: Freshness; title?: string }) {
  const text = { missing: "not run yet", stale: "stale", current: "current" }[f];
  const icon = ({ missing: "dot", stale: "clock", current: "feasible" } as const)[f];
  return (
    <span data-testid="m1-freshness" data-f={f} className={styles.fresh} title={title}>
      <Icon name={icon} />
      M1 result: {text}
    </span>
  );
}

export function M1BlockedNote({ f }: { f: Freshness }) {
  if (f === "current") return null;
  return (
    <p role="alert" data-testid="m1-blocked" className={styles.blocked}>
      <Icon name={f === "stale" ? "clock" : "link"} />
      {f === "stale"
        ? "The design changed after the last power flow. Re-run M1 to continue."
        : "Run power flow (M1) first."}{" "}
      <Link href="/power-flow/">Go to Power flow</Link>
    </p>
  );
}
