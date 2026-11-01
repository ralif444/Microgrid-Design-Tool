"use client";
// S-06 Design constraints (Doc 7 §2): no numeric defaults; an empty limit is "not evaluated"
// (FR-15, FR-16, manuscript 4.2.4).
import type { DesignConstraints } from "../../api-types";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";

const FIELDS: [keyof DesignConstraints, string, string][] = [
  ["voltage_min_pu", "Bus voltage, lower limit", "p.u."],
  ["voltage_max_pu", "Bus voltage, upper limit", "p.u."],
  ["frequency_min_hz", "Frequency, lower limit", "Hz"],
  ["frequency_max_hz", "Frequency, upper limit", "Hz"],
  ["inverter_loading_limit_ratio", "Inverter loading limit", "ratio of rating"],
  ["line_current_limit_a", "Line current limit, all lines", "A"],
  ["balance_tolerance_kw", "Power-balance tolerance, optional", "kW"],
];

function Constraints() {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const c = design.design_constraints ?? {};
  const issues = (useValidation(design)?.issues ?? []).filter((i) => i.entity === "DesignConstraints");
  return (
    <>
      <h1>Design constraints</h1>
      <p>Every limit starts empty. An empty limit is not evaluated and is never counted as satisfied.</p>
      {FIELDS.map(([k, label, unit]) => (
        <p key={k}>
          <NumberField
            id={k}
            label={label}
            unit={unit}
            value={c[k]}
            onChange={(v) => dispatch({ type: "constraintSet", field: k, value: v })}
          />
          {c[k] == null && <span data-testid={`not-evaluated-${k}`}> not evaluated</span>}
          {issues
            .filter((i) => i.field === k)
            .map((i, n) => (
              <span key={n} role="alert">
                {" "}
                {i.message}
              </span>
            ))}
        </p>
      ))}
    </>
  );
}

export default function ConstraintsPage() {
  return (
    <RequireProject>
      <Constraints />
    </RequireProject>
  );
}
