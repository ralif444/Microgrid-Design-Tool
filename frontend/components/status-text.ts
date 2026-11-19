// Status presentation texts (Doc 7 §5). Headline and next-step hint per Status / reason.
import type { AnalysisResult, AnalysisType } from "../api-types";
import { displayLang, translate } from "./i18n";

export interface BannerText {
  role: "success" | "warning" | "error" | "caution" | "attention" | "neutral";
  headline: string;
  hint: string;
}

// Texts go through translate(displayLang()) so every caller shows the chosen language.
const T = (en: string, vars?: Record<string, string | number>) => translate(displayLang(), en, vars);

// One violated count for banner, KPI and strip (audit D-21): evaluated margins below zero.
export const violatedCount = (p: { constraint_margins?: { margin: number }[] } | null | undefined) =>
  p?.constraint_margins?.filter((c) => c.margin < 0).length ?? null;

// M2 with no evaluated margin: "Feasible" would read as checked (audit 2026-11-15 E15)
export const m2NothingChecked = (p: unknown) => ((p as { constraint_margins?: unknown[] } | null)?.constraint_margins ?? []).length === 0;

export function bannerText(type: AnalysisType, r: AnalysisResult): BannerText {
  const n = (r.diagnostics?.issues as unknown[] | undefined)?.length ?? 0;
  switch (r.status) {
    case "FEASIBLE":
      if (type === "M1")
        return {
          role: "success",
          headline:
            T("Power flow completed: an operating point was found. This is not yet a check against your limits."),
          hint: T("Run the constraint check (M2)."),
        };
      if (type === "M2") {
        // WP 1.7.4: a check without a limit is not satisfied, so "all constraints" would overstate it.
        const skipped = ((r.payload as { not_evaluated?: unknown[] } | null)?.not_evaluated ?? []).length;
        if (m2NothingChecked(r.payload))
          return { role: "neutral", headline: T("Nothing was checked: no limit is set, so every check was not evaluated."), hint: T("Enter the limits on Constraints, then re-run M2.") };
        const headline = skipped
          ? skipped === 1
            ? T("The design meets every evaluated constraint; 1 check had no limit and was not evaluated.")
            : T("The design meets every evaluated constraint; {count} checks had no limit and were not evaluated.", { count: skipped })
          : T("The design meets all constraints.");
        return { role: "success", headline, hint: T(skipped ? "Enter the missing limits on Constraints, then re-run M2." : "Explore further analyses or open the report.") };
      }
      if (type === "CB")
        return { role: "success", headline: T("Sizing completed: advice for the overload rating and the conductor size only."), hint: T("Check each element's outcome; open a row for its factors.") };
      if (type === "BA")
        return { role: "success", headline: T("Battery check completed: advice on the discharge power of each bank."), hint: T("Check each bank's outcome and reason.") };
      if (type === "RS")
        return { role: "success", headline: T("Reactor sizing completed (advice only)."), hint: T("Check the outcome; apply the reactors only when it says they were found and confirmed.") };
      if (type === "PS") return { role: "success", headline: T("Advice produced."), hint: T("Accept or skip.") }; // Edit deferred (Doc 9 D-45 K5)
      return { role: "success", headline: T("Analysis completed."), hint: T("Explore further analyses or open the report.") };
    case "INFEASIBLE":
      return {
        role: "warning",
        headline: (() => {
          const c = violatedCount(r.payload as never) ?? r.limiting_constraints?.length ?? 0;
          return T(c === 1 ? "A valid operating point exists, but the design violates {count} constraint." : "A valid operating point exists, but the design violates {count} constraints.", { count: c });
        })(),
        hint: T("Change the element named first, then re-run M1 and M2."),
      };
    case "SOLVER_FAILED":
      return {
        role: "error",
        headline: T("The calculation did not reach a solution. This is a calculation problem, not a limit violation."),
        hint: T("Check Inverter and Line data, then retry; keep the RunRecord for the developer."),
      };
    case "PHYSICALLY_INADMISSIBLE":
      return {
        role: "error",
        headline: T("A solution was found but it is not physically possible, so it is not used."),
        hint: T("Review loads, ratings and impedances; later analyses stay blocked."),
      };
    case "INPUT_INVALID":
      if (r.status_code === "SWEEP_CAP_EXCEEDED")
        return { role: "caution", headline: T("This sweep has too many points. Nothing was calculated."), hint: T("Reduce the range or step count.") };
      return { role: "caution", headline: T(n === 1 ? "The input has {count} problem. Nothing was calculated." : "The input has {count} problems. Nothing was calculated.", { count: n }), hint: T("Fix the listed fields.") };
    case "UNAVAILABLE":
      switch (r.status_code) {
        case "TIMEOUT":
          return { role: "attention", headline: T("The analysis took longer than the time budget and was stopped."), hint: T("Retry, or reduce the problem size. The attempt is kept in Run history.") };
        case "DEPENDENCY_NOT_MET":
          if (type === "CB")
            return { role: "attention", headline: T("Cable sizing needs a current constraint check (M2) result, and none is available."), hint: T("Re-run M1 and M2 on this design, then retry.") };
          switch (r.diagnostics?.dependency_reason) {
            case "STALE":
            case "ALTERED":
              return { role: "attention", headline: T("The power flow result is out of date because the design changed. M1 must be re-run."), hint: T("Re-run M1, then retry.") };
            case "NOT_FEASIBLE":
              return { role: "attention", headline: T("The power flow (M1) did not produce a usable result, so this analysis cannot run."), hint: T("Fix the M1 problem first.") };
            default:
              return { role: "attention", headline: T("This analysis needs a valid power flow (M1) result, and none is available."), hint: T("Go to Power flow and run M1.") };
          }
        case "ENGINE_ERROR":
          return { role: "error", headline: T("The calculation engine reported an unexpected error. Your data is unchanged."), hint: T("Retry; if it repeats, export the RunRecord and report it.") };
        default:
          return { role: "neutral", headline: T("This analysis does not apply to this design."), hint: T("Choose another analysis or change the design.") };
      }
  }
}

// BA: no bank got a power or autonomy verdict, so "Advice ready" would overstate it (audit 2026-11-15 B3).
const baNothingEvaluated = (r: AnalysisResult) => {
  const banks = (r.payload as { banks?: { power: { outcome: string }; autonomy: { outcome: string } }[] } | null)?.banks ?? [];
  return banks.length > 0 && banks.every((b) => b.power.outcome === "NOT_EVALUATED" && b.autonomy.outcome === "NOT_EVALUATED");
};

// Banner headline word (audit D-5): analyses without a constraint check get their own word, not "FEASIBLE".
const CLASS_WORD: Record<string, string> = { STABLE: "Stable", MARGINAL: "Marginally stable", UNSTABLE: "Unstable" };
export function statusWord(type: AnalysisType, r: AnalysisResult): string {
  switch (r.status) {
    case "FEASIBLE":
      if (type === "M1") return T("Solved");
      if (type === "M4a") return T(CLASS_WORD[(r.payload as { stability_class?: string } | null)?.stability_class ?? ""] ?? "Analysed");
      if (type === "M4b") return T("Simulated");
      if (type === "M2") return T(m2NothingChecked(r.payload) ? "Not evaluated" : "Meets the limits");
      if (type === "BA" && baNothingEvaluated(r)) return T("Not evaluated");
      if (type === "PS" || type === "CB" || type === "BA" || type === "RS") return T("Advice ready");
      return T("Completed");
    case "INFEASIBLE":
      return T("Limits violated");
    case "SOLVER_FAILED":
      return T("No solution");
    case "PHYSICALLY_INADMISSIBLE":
      return T("Not physically possible");
    case "INPUT_INVALID":
      return T("Input needs fixing");
    case "UNAVAILABLE":
      return T(({ TIMEOUT: "Timed out", DEPENDENCY_NOT_MET: "Needs an earlier result", ENGINE_ERROR: "Engine error" } as Record<string, string>)[r.status_code] ?? "Not applicable");
  }
}
