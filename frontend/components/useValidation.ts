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
  const [report, setReport] = useState<ValidationReport | null>(null);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void validateProject({ project_snapshot: design, target_analysis_type: target, ...(banks.length ? { battery_banks: banks } : {}) }).then((r) => {
        if (live) setReport(r.ok ? r.data : null);
      });
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [design, target, banks]);
  return report;
}

export type Freshness = "missing" | "stale" | "current";

// Doc 7 §3.1 stale-M1 rule, decided by hash re-check (D-46): current iff the latest FEASIBLE M1
// was run on the snapshot now in the store. The API still enforces it (FR-38, FR-40).
export function m1Freshness(m1SnapshotHash: string | null, report: ValidationReport | null): Freshness {
  if (!m1SnapshotHash) return "missing";
  return report?.snapshot_hash === m1SnapshotHash ? "current" : "stale";
}
