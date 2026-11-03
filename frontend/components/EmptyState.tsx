// Empty state (Doc 7 §6 "States: Empty"): what is missing and the one action that fills it.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./ui.module.css";

export function EmptyState({
  title,
  children,
  action,
  icon = "info",
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>
        <Icon name={icon} />
        {title}
      </p>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
