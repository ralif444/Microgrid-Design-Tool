// Status banner (Doc 7 P2, §5): Status in words, plain message, next step, collapsible details.
import type { AnalysisResult, AnalysisType, ValidationIssue } from "../api-types";
import { bannerText } from "./status-text";

const ICON: Record<string, string> = {
  success: "✔", warning: "✖", error: "⚠", caution: "☰", attention: "⏱", neutral: "ℹ",
};

export function StatusBanner({ type, result }: { type: AnalysisType; result: AnalysisResult }) {
  const t = bannerText(type, result);
  const issues = (result.diagnostics?.issues ?? []) as ValidationIssue[];
  return (
    <section role="status" aria-label="Status" data-status={result.status} className={`banner banner-${t.role}`}>
      <h2>
        <span aria-hidden="true">{ICON[t.role]} </span>
        {result.status}
      </h2>
      <p>{t.headline}</p>
      <p>{result.message}</p>
      <p><strong>Next step:</strong> {t.hint}</p>
      {issues.length > 0 && (
        <ul aria-label="Issues">
          {issues.map((i, k) => (
            <li key={k}>
              {[i.entity, i.id, i.field].filter(Boolean).join(" / ")}: {i.message}
            </li>
          ))}
        </ul>
      )}
      <details>
        <summary>Details</summary>
        <p>status_code: <code>{result.status_code}</code></p>
        <p>warnings: {(result.warnings ?? []).map((w) => w.code).join(", ") || "none"}</p>
      </details>
    </section>
  );
}
