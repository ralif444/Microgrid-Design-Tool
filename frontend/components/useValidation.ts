"use client";
// Debounced live stage-1 check through /api/projects/validate (Doc 6 §3.4); the server holds the
// only rule set. Also yields the snapshot hash used for the stale-M1 check (D-46).
import { useEffect, useState } from "react";
import { validateProject } from "../api-client";
import type { AnalysisType, BatteryBank, ProjectSnapshot, ValidationReport } from "../api-types";

// Banks are checked only when some exist (D-108), so the request is otherwise unchanged. The
// default is one shared array: a fresh [] per render would restart the debounce every render.
const NO_BANKS: BatteryBank[] = [];
export function useValidation(design: ProjectSnapshot, target: AnalysisType | null = null, banks: BatteryBank[] = NO_BANKS): ValidationReport | null {
  return useValidationState(design, target, banks).report;
}

// Audit O-4: a failed check is its own state (`error`), never read as "no problems"; `retry` asks again.
export function useValidationState(design: ProjectSnapshot, target: AnalysisType | null = null, banks: BatteryBank[] = NO_BANKS) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void validateProject({ project_snapshot: design, target_analysis_type: target, ...(banks.length ? { battery_banks: banks } : {}) }).then((r) => {
        if (!live) return;
        setReport(r.ok ? r.data : null);
        setError(r.ok ? null : r.message);
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [design, target, banks, attempt]);
  return { report, error, retry: () => setAttempt((n) => n + 1) };
}

export type Freshness = "missing" | "checking" | "stale" | "current";

// Doc 7 §3.1 stale-M1 rule, decided by hash re-check (D-46): current iff the latest FEASIBLE M1
// was run on the snapshot now in the store. The API still enforces it (FR-38, FR-40).
export function m1Freshness(m1SnapshotHash: string | null, report: ValidationReport | null): Freshness {
  if (!m1SnapshotHash) return "missing";
  if (!report) return "checking"; // the live check has not answered yet: neither current nor stale
  return report?.snapshot_hash === m1SnapshotHash ? "current" : "stale";
}
