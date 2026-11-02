// Project file layout (Doc 3 §8, Doc 9 D-47 K14): nominal values sit in `project`; scenarios
// stay [] until stage 1.5. The versions come from /api/meta so the app never hard-codes them.
import type { ProjectFile } from "../api-types";
import type { ProjectState } from "./reducer";

export function toProjectFile(
  s: ProjectState,
  versions: { schema_version: number; app_version: string },
  modified_at: string,
): ProjectFile {
  if (!s.project) throw new Error("No open Project");
  const d = s.design;
  return {
    schema_version: versions.schema_version,
    app_version: versions.app_version,
    project: {
      ...s.project,
      modified_at,
      nominal_voltage_kv: d.nominal_voltage_kv ?? null,
      nominal_frequency_hz: d.nominal_frequency_hz ?? null,
    },
    buses: d.buses ?? [],
    lines: d.lines ?? [],
    loads: d.loads ?? [],
    inverters: d.inverters ?? [],
    load_profile: d.load_profile ?? null,
    design_constraints: d.design_constraints ?? {},
    sizing_advice: s.sizingAdvice as unknown as ProjectFile["sizing_advice"],
    scenarios: [],
    run_records: s.runRecords,
  };
}
