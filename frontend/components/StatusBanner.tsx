// Status banner (Doc 7 P2, §5): colour role + icon + Status word, plain message, next step,
// collapsible details. Texts come from status-text.ts; this file only presents them.
import type { AnalysisResult, AnalysisType, ValidationIssue } from "../api-types";
import { Icon, type IconName } from "./Icon";
import styles from "./StatusBanner.module.css";
import { type BannerText, bannerText } from "./status-text";

// status-text roles → token roles (ADR-011 decision 4)
export const TOKEN_ROLE: Record<BannerText["role"], string> = {
  success: "success", warning: "negative", error: "error", caution: "caution", attention: "attention", neutral: "info",
};

// One icon per Doc 7 §5 row; error rows get distinct icons.
export function statusIcon(r: Pick<AnalysisResult, "status" | "status_code">): IconName {
  if (r.status === "UNAVAILABLE")
    return ({ TIMEOUT: "clock", DEPENDENCY_NOT_MET: "link", ENGINE_ERROR: "wrench" } as Record<string, IconName>)[r.status_code] ?? "info";
  return ({ FEASIBLE: "check", INFEASIBLE: "cross", SOLVER_FAILED: "alert", PHYSICALLY_INADMISSIBLE: "ban", INPUT_INVALID: "list" } as Record<string, IconName>)[r.status];
}

const plain = (s: string) => s.trim().replace(/\.$/, "");

export function StatusBanner({ type, result }: { type: AnalysisType; result: AnalysisResult }) {
  const t = bannerText(type, result);
  const issues = (result.diagnostics?.issues ?? []) as ValidationIssue[];
  const fake = result.warnings?.find((w) => w.code === "ENGINE_KIND_FAKE"); // D-48 K20
  // The engine message often repeats the headline; show it only when it adds something.
  const message = result.message && !t.headline.includes(plain(result.message)) ? result.message : null;
  return (
    <section role="status" aria-label="Status" data-status={result.status} data-role={TOKEN_ROLE[t.role]} className={styles.banner}>
      <h2 className={styles.status}>
        <Icon name={statusIcon(result)} size={20} />
        {result.status}
      </h2>
      <p className={styles.headline}>{t.headline}</p>
      {message && <p className={styles.message}>{message}</p>}
      {fake && (
        <p className={`fake-note ${styles.fake}`} data-testid="fake-warning">
          <strong>FAKE engine:</strong> {fake.message}
        </p>
      )}
      {issues.length > 0 && (
        <ul aria-label="Issues" className={styles.issues}>
          {issues.map((i, k) => (
            <li key={k}>
              <span className={styles.where}>{[i.entity, i.id, i.field].filter(Boolean).join(" / ") || "Design"}</span>: {i.message}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.next}>
        <strong>Next step:</strong> {t.hint}
      </p>
      <details className={styles.details}>
        <summary>Details</summary>
        <dl>
          <dt>status_code</dt>
          <dd>
            <code>{result.status_code}</code>
          </dd>
          <dt>warnings</dt>
          <dd>{(result.warnings ?? []).map((w) => w.code).join(", ") || "none"}</dd>
        </dl>
      </details>
    </section>
  );
}
