"use client";
// Single-line diagram with the results overlay on S-07 and S-08 (Doc 12 X8, FR-96; guideline §5, §A5,
// §A6). "Show results" is on by default. The overlay needs the current FEASIBLE M1 (FR-93 selector);
// S-08 adds the M2 marks of the current M2. Without a current run the overlay is hidden and the
// reason is shown above the diagram.
import { useState } from "react";
import type { ElementRef } from "../Inspector";
import { Icon } from "../Icon";
import uiStyles from "../ui.module.css";
import type { Freshness } from "../useValidation";
import { SingleLineDiagram } from "./SingleLineDiagram";
import { useSldModel } from "./useSldModel";

export function ResultsDiagram({
  fresh,
  checks = false,
  selected,
  onSelect,
}: {
  fresh: Freshness;
  /** S-08: also draw violated, limiting and near-limit marks */
  checks?: boolean;
  selected: string | null;
  onSelect: (t: ElementRef) => void;
}) {
  const sld = useSldModel();
  const [show, setShow] = useState(true);
  const on = show && fresh === "current" && sld.has.m1;
  const reason =
    fresh === "stale"
      ? "Outdated: design changed after this run. Re-run M1."
      : fresh === "missing"
        ? "No power-flow result yet. Run M1 to show results on the diagram."
        : checks && !sld.has.m2
          ? "No current constraint check. Run M2 to show the checks on the diagram."
          : null;
  return (
    <section aria-label="Single-line diagram">
      <h2>Single-line diagram</h2>
      {show && reason && (
        <p role="status" data-testid="sld-overlay-note" className={uiStyles.blocked}>
          <Icon name={fresh === "stale" ? "clock" : "dot"} />
          {reason}
        </p>
      )}
      {on && sld.fake && (
        <p data-testid="sld-fake">
          <strong>FAKE engine:</strong> placeholder values on the diagram, not engine results.
        </p>
      )}
      <SingleLineDiagram
        drawing={on ? (checks ? sld.full : sld.m1) : sld.design}
        details={sld.full}
        selected={selected}
        onSelect={onSelect}
        tools={
          <button type="button" aria-pressed={show} onClick={() => setShow(!show)}>
            Show results
          </button>
        }
      />
    </section>
  );
}
