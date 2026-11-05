"use client";
// SLD gallery (Doc 12 X8, guideline §11 SLD-3): every symbol and state of guideline §5, and the layout
// fixtures. Numbers are gallery placeholders (counting numbers), never results of any analysis.
import type { LimitingConstraint, M1Payload, M2Payload, ProjectSnapshot } from "../../../api-types";
import { buildSldModel, type SldInput } from "../../../components/sld/buildSldModel";
import { SLD_FIXTURES } from "../../../components/sld/fixtures";
import styles from "../../../components/sld/sld.module.css";
import { SldSvg } from "../../../components/sld/SldSvg";
import { SldLegend, type Emph } from "../../../components/sld/symbols";
import { useSldLayout } from "../../../components/sld/useSldLayout";

const STATES: ProjectSnapshot = {
  nominal_voltage_kv: 1,
  nominal_frequency_hz: 2,
  buses: ["B1", "B2", "B3", "B9"].map((id) => ({ id })),
  lines: [
    { id: "LN1", from_bus_id: "B1", to_bus_id: "B2" },
    { id: "LN2", from_bus_id: "B1", to_bus_id: "B3" },
  ],
  inverters: [
    { id: "INV1", bus_id: "B1", rated_kva: 3 },
    { id: "INV2", bus_id: "B1", rated_kva: 4 },
  ],
  loads: [
    { id: "L1", bus_id: "B2", p_kw: 5, q_kvar: 6 },
    { id: "L2", bus_id: "B3", p_kw: 7, power_factor: 0.8, pf_direction: "LAGGING" },
  ],
};
const c = (element_id: string, margin: number): LimitingConstraint => ({ element_id, kind: "INVERTER_LOADING", value: 1, limit: 2, margin, normalised_margin: margin, unit: "ratio" });
const M2 = {
  payload: {
    verdict: "INFEASIBLE",
    constraint_margins: [c("INV1", -1), c("B3", 0.01)],
    not_evaluated: [],
    sizing_check: { per_inverter: [], per_line: [] },
  } as unknown as M2Payload,
  limiting: [c("LN2", 1)],
};
const M1 = {
  system_frequency_hz: 1,
  total_load_kw: 2,
  total_load_kvar: 3,
  total_losses_kw: 4,
  epsilon_x_ratio: 5,
  bus_results: ["B1", "B2", "B3"].map((bus_id, k) => ({ bus_id, voltage_kv: k + 1, voltage_pu: k + 1, angle_deg: k + 1 })),
  inverter_results: ["INV1", "INV2"].map((inverter_id, k) => ({ inverter_id, p_kw: k + 1, q_kvar: k + 1, s_kva: k + 1, loading_ratio: k + 1 })),
  line_results: ["LN1", "LN2"].map((line_id, k) => ({ line_id, p_from_kw: k + 1, q_from_kvar: 0, p_to_kw: 0, q_to_kvar: 0, current_a: k + 1, losses_kw: 0 })),
  sharing: [],
} as unknown as M1Payload;
const ISSUE = [{ code: "EMPTY_REQUIRED" as const, level: "field" as const, entity: "Load", id: "L2", field: "p_kw", message: "A required value is missing." }];

function Figure({ title, input, emph }: { title: string; input: SldInput; emph?: Record<string, Emph> }) {
  const model = buildSldModel(input);
  const { layout, failed } = useSldLayout(model);
  return (
    <section aria-label={title} style={{ marginBottom: "var(--space-8)" }}>
      <h2>{title}</h2>
      {failed ? <p>Diagram could not be drawn; the tables still work.</p> : layout ? <figure className={styles.figure}><SldSvg model={model} layout={layout} emph={emph} label={`Single-line diagram: ${title}`} /></figure> : <p>Laying out…</p>}
    </section>
  );
}

export default function SldGalleryPage() {
  return (
    <>
      <h1>Single-line diagram gallery</h1>
      <p>Symbols and states for review (Doc 12 X8). Numbers are gallery placeholders (counting numbers), not results of any analysis.</p>
      <section aria-label="Legend" style={{ marginBottom: "var(--space-8)" }}>
        <h2>Legend</h2>
        <SldLegend />
      </section>
      <Figure title="Design view" input={{ design: STATES }} />
      <Figure title="Hover or focus (INV2, LN1) and selected (B2, L1)" input={{ design: STATES }} emph={{ INV2: "hover", LN1: "hover", B2: "selected", L1: "selected" }} />
      <Figure title="Checks: violated INV1, limiting LN2, near limit B3; validation issue on L2; isolated B9" input={{ design: STATES, m2: M2, issues: ISSUE, marginWarn: 0.05 }} />
      <Figure title="Results overlay labels (placeholders)" input={{ design: STATES, m1: M1 }} />
      {Object.entries(SLD_FIXTURES).map(([name, design]) => (
        <Figure key={name} title={`Fixture: ${name}`} input={{ design }} />
      ))}
    </>
  );
}
