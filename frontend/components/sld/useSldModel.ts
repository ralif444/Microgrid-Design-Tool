"use client";
// Store side of the SLD model (guideline §4.3, §A5): the current M1 and M2 come from the FR-93 selector
// (`latestRun` on the current design hash), issues from the live validation, MARGIN_WARN from /api/meta.
// `design` has no runs (S-05 draws design data only); `full` feeds tooltip, inspector and overlays.
import { useEffect, useMemo, useState } from "react";
import { getMeta } from "../../api-client";
import type { M1Payload, M2Payload } from "../../api-types";
import { latestRun, useProject } from "../../store";
import { useValidation } from "../useValidation";
import { buildSldModel, type SldModel } from "./buildSldModel";

let marginWarnCache: Promise<number | null> | null = null;
const marginWarn = () => (marginWarnCache ??= getMeta().then((m) => (m.ok ? m.data.limits.margin_warn : null)));

export function useSldModel(): { design: SldModel; full: SldModel; fake: boolean } {
  const { design, runRecords } = useProject();
  const report = useValidation(design);
  const [warn, setWarn] = useState<number | null>(null);
  useEffect(() => {
    void marginWarn().then(setWarn);
  }, []);
  const current = report?.snapshot_hash ?? null;
  const m1r = latestRun(runRecords, "M1", current);
  const m2r = latestRun(runRecords, "M2", current);
  return useMemo(() => {
    const issues = report?.issues ?? [];
    const m1 = m1r?.result.status === "FEASIBLE" ? (m1r.result.payload as unknown as M1Payload) : null;
    const m2 =
      m2r && (m2r.result.status === "FEASIBLE" || m2r.result.status === "INFEASIBLE")
        ? { payload: m2r.result.payload as unknown as M2Payload, limiting: m2r.result.limiting_constraints ?? [] }
        : null;
    const fake = [m1 && m1r, m2 && m2r].some((r) => r && r.engine_kind === "FAKE");
    return { design: buildSldModel({ design, issues }), full: buildSldModel({ design, m1, m2, issues, marginWarn: warn }), fake };
  }, [design, report, m1r, m2r, warn]);
}
