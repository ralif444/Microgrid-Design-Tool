// KPI strip under the Status banner (Doc 12 X2, FR-87): Carbon-style tiles, label, value with
// unit (rounded for display), and the element it comes from. A FAKE run is marked (CLAUDE.md).
import type { RunRecord } from "../api-types";
import { num } from "./format";
import { Icon } from "./Icon";
import type { Kpi } from "./kpi";
import styles from "./KpiStrip.module.css";

export function KpiStrip({ label, kpis, record }: { label: string; kpis: Kpi[]; record: RunRecord }) {
  return (
    <section aria-label={label} className={styles.strip}>
      <dl className={styles.tiles}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.tile}>
            <dt>{k.label}</dt>
            <dd className={styles.value}>
              {k.icon && <Icon name={k.icon} size={20} />}
              {k.value === null ? "—" : typeof k.value === "string" ? k.value : num(k.value)} <span className={styles.unit}>{k.unit}</span>
            </dd>
            {k.detail && <dd className={styles.detail}>{k.detail}</dd>}
          </div>
        ))}
      </dl>
      {record.engine_kind === "FAKE" && (
        <p className={styles.fake}>
          <strong>FAKE engine:</strong> placeholder values, not engine results.
        </p>
      )}
    </section>
  );
}
