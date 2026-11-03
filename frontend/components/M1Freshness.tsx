// M1 freshness badge and blocked banner for S-07 and S-08 (Doc 7 §3.1, §5).
import { Tag } from "@carbon/react";
import Link from "next/link";
import { Icon } from "./Icon";
import styles from "./ui.module.css";
import type { Freshness } from "./useValidation";

// Carbon Tag (guideline §6 badges): green current, warm-gray stale, cool-gray not run yet.
export function M1FreshnessBadge({ f }: { f: Freshness }) {
  const text = { missing: "not run yet", stale: "stale", current: "current" }[f];
  const icon = ({ missing: "dot", stale: "clock", current: "feasible" } as const)[f];
  const type = ({ missing: "cool-gray", stale: "warm-gray", current: "green" } as const)[f];
  return (
    <Tag type={type} size="md" renderIcon={() => <Icon name={icon} />} data-testid="m1-freshness" data-f={f} className={styles.fresh}>
      M1 result: {text}
    </Tag>
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
