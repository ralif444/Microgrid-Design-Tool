// Status presentation texts (Doc 7 §5). Headline and next-step hint per Status / reason.
import type { AnalysisResult, AnalysisType } from "../api-types";

export interface BannerText {
  role: "success" | "warning" | "error" | "caution" | "attention" | "neutral";
  headline: string;
  hint: string;
}

export function bannerText(type: AnalysisType, r: AnalysisResult): BannerText {
  const n = (r.diagnostics?.issues as unknown[] | undefined)?.length ?? 0;
  switch (r.status) {
    case "FEASIBLE":
      if (type === "M1")
        return {
          role: "success",
          headline:
            "Power flow completed: an operating point was found. This is not yet a check against your limits.",
          hint: "Run the constraint check (M2).",
        };
      if (type === "M2") {
        // WP 1.7.4: a check without a limit is not satisfied, so "all constraints" would overstate it.
        const skipped = ((r.payload as { not_evaluated?: unknown[] } | null)?.not_evaluated ?? []).length;
        const headline = skipped
          ? `The design meets every evaluated constraint; ${skipped} check(s) had no limit and were not evaluated.`
          : "The design meets all constraints.";
        return { role: "success", headline, hint: skipped ? "Enter the missing limits on Constraints, then re-run M2." : "Explore further analyses or open the report." };
      }
      if (type === "CB")
        return { role: "success", headline: "Sizing completed: advice for the overload rating and the conductor size only.", hint: "Check each element's outcome; open a row for its factors." };
      if (type === "BA")
        return { role: "success", headline: "Battery check completed: advice on the discharge power of each bank.", hint: "Check each bank's outcome and reason." };
      if (type === "PS") return { role: "success", headline: "Advice produced.", hint: "Accept or skip." }; // Edit deferred (Doc 9 D-45 K5)
      return { role: "success", headline: "Analysis completed.", hint: "Explore further analyses or open the report." };
    case "INFEASIBLE":
      return {
        role: "warning",
        headline: `A valid operating point exists, but the design violates ${r.limiting_constraints?.length ?? 0} constraint(s).`,
        hint: "Change the element named first, then re-run M1 and M2.",
      };
    case "SOLVER_FAILED":
      return {
        role: "error",
        headline: "The calculation did not reach a solution. This is a calculation problem, not a limit violation.",
        hint: "Check Inverter and Line data, then retry; keep the RunRecord for the developer.",
      };
    case "PHYSICALLY_INADMISSIBLE":
      return {
        role: "error",
        headline: "A solution was found but it is not physically possible, so it is not used.",
        hint: "Review loads, ratings and impedances; later analyses stay blocked.",
      };
    case "INPUT_INVALID":
      if (r.status_code === "SWEEP_CAP_EXCEEDED")
        return { role: "caution", headline: "This sweep has too many points. Nothing was calculated.", hint: "Reduce the range or step count." };
      return { role: "caution", headline: `The input has ${n} problem(s). Nothing was calculated.`, hint: "Fix the listed fields." };
    case "UNAVAILABLE":
      switch (r.status_code) {
        case "TIMEOUT":
          return { role: "attention", headline: "The analysis took longer than the time budget and was stopped.", hint: "Retry, or reduce the problem size. The attempt is kept in Run history." };
        case "DEPENDENCY_NOT_MET":
          if (type === "CB")
            return { role: "attention", headline: "Cable sizing needs a current constraint check (M2) result, and none is available.", hint: "Re-run M1 and M2 on this design, then retry." };
          switch (r.diagnostics?.dependency_reason) {
            case "STALE":
            case "ALTERED":
              return { role: "attention", headline: "The power flow result is out of date because the design changed. M1 must be re-run.", hint: "Re-run M1, then retry." };
            case "NOT_FEASIBLE":
              return { role: "attention", headline: "The power flow (M1) did not produce a usable result, so this analysis cannot run.", hint: "Fix the M1 problem first." };
            default:
              return { role: "attention", headline: "This analysis needs a valid power flow (M1) result, and none is available.", hint: "Go to Power flow and run M1." };
          }
        case "ENGINE_ERROR":
          return { role: "error", headline: "The calculation engine reported an unexpected error. Your data is unchanged.", hint: "Retry; if it repeats, export the RunRecord and report it." };
        default:
          return { role: "neutral", headline: "This analysis does not apply to this design.", hint: "Choose another analysis or change the design." };
      }
  }
}
