// M1 freshness badge and blocked banner for S-07 and S-08 (Doc 7 §3.1, §5).
import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./ui.module.css";
import type { Freshness } from "./useValidation";

export function M1FreshnessBadge({ f }: { f: Freshness }) {
  const text = { missing: "not run yet", stale: "stale", current: "current" }[f];
  const icon = ({ missing: "dot", stale: "warn", current: "check" } as const)[f];
  return (
    <p data-testid="m1-freshness" data-f={f} className={styles.fresh}>
      <Icon name={icon} size={14} />
      M1 result: {text}
    </p>
  );
}

export function M1BlockedNote({ f }: { f: Freshness }) {
  if (f === "current") return null;
  return (
    <p role="alert" data-testid="m1-blocked">
      {f === "stale"
        ? "The design changed after the last power flow. Re-run M1 to continue."
        : "Run power flow (M1) first."}{" "}
      <Link href="/power-flow/">Go to Power flow</Link>
    </p>
  );
}
