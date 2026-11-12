"use client";
// One analysis request with its busy flag and transport error, shared by every screen that runs
// an analysis (Doc 7 §5). A Status of any kind is a normal response; null means the request itself
// failed and `error` holds the message.
import { useState } from "react";
import { runAnalysis } from "../api-client";
import type { AnalysisRequestBody, AnalysisResponse, AnalysisType } from "../api-types";

// Manuscript 4.2.3 defaults (Doc 3 §5.1); the app has no solver settings screen.
export const SOLVER = { mismatch_tolerance_w: 0.001, max_iterations: 50, initial_guess: "DEFAULT" as const };

export function useAnalysisCall() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function call(type: AnalysisType, body: AnalysisRequestBody): Promise<AnalysisResponse | null> {
    setError(null);
    setBusy(true);
    const out = await runAnalysis(type, body);
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return null;
    }
    return out.data;
  }
  return { busy, error, setError, call };
}
