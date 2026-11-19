// KPI strip under the Status banner (Doc 12 X2, FR-87): Carbon-style tiles, label, value with
// unit (rounded for display), and the element it comes from. A FAKE run is marked (CLAUDE.md).
import type { RunRecord } from "../api-types";
import { fixed } from "./format";
import { Icon } from "./Icon";
import { useLanguage } from "./Language";
import type { Kpi } from "./kpi";
import styles from "./KpiStrip.module.css";
import { Term } from "./Term";

export function KpiStrip({ label, kpis, record }: { label: string; kpis: Kpi[]; record: RunRecord }) {
  const { t } = useLanguage();
  return (
    <section aria-label={t(label)} className={styles.strip}>
      <dl className={styles.tiles}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.tile}>
            <dt>
              {t(k.label)}
              {k.term && <Term k={k.term} />}
            </dt>
            <dd className={styles.value}>
              {k.icon && <Icon name={k.icon} size={20} />}
              {/* a payload word may break after "_" (RECOVERED_STABLE) without changing its text */}
              <span>{k.value === null ? "—" : typeof k.value === "string" ? t(k.value).split("_").flatMap((w, i) => (i ? ["_", <wbr key={i} />, w] : [w])) : fixed(k.value, k.unit)}</span>{" "}
              <span className={styles.unit}>{k.unit}</span>
            </dd>
            {k.detail && <dd className={styles.detail}>{t(k.detail)}</dd>}
          </div>
        ))}
      </dl>
      {record.engine_kind === "FAKE" && (
        <p className={styles.fake}>
          <strong>{t("FAKE engine:")}</strong> {t("placeholder values, not engine results.")}
        </p>
      )}
    </section>
  );
}
