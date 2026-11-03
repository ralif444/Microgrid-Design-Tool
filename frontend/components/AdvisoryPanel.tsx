// Advisory treatment (Doc 7 P4, FR-08, FR-27; guideline §8): dashed outline on layer-02 and a purple
// Tag, never design data.
import { Tag } from "@carbon/react";
import type { ReactNode } from "react";
import styles from "./ui.module.css";

export function AdvisoryPanel({ label, title, tag = "Advice", children }: { label: string; title: string; tag?: string; children: ReactNode }) {
  return (
    <section className={styles.advice} aria-label={label}>
      <div className={styles.adviceHead}>
        <Tag type="purple" size="sm" className={styles.adviceTag}>
          {tag}
        </Tag>
        {title}
      </div>
      {children}
    </section>
  );
}
