// Empty state (Doc 7 §6 "States: Empty"; guideline §6): 32 px icon, what is missing, the one action.
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { useLanguage } from "./Language";
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
  const { t } = useLanguage();
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>
        <Icon name={icon} size={32} />
        {t(title)}
      </p>
      {children && <p>{typeof children === "string" ? t(children) : children}</p>}
      {action}
    </div>
  );
}
