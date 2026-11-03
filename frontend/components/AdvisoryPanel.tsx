// Advisory treatment (Doc 7 P4, FR-08, FR-27): dashed outline and an "Advice" tag, never design data.
import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function AdvisoryPanel({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.advice} aria-label={label}>
      <p className={styles.adviceHead}>
        <span className={styles.adviceChip}>Advice</span>
        {title}
      </p>
      {children}
    </section>
  );
}
