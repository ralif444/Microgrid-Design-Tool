"use client";
// Global header (Doc 7 §2): Project name, unsaved indicator, pipeline stepper, engine badge.
// Step 7 lists the further analyses (stage 1.5, D-56 K95); Run history is reachable at any time (Doc 7 §3).
import Link from "next/link";
import { m1Ref, useProject } from "../store";
import { EngineBadge } from "./EngineBadge";
import { ProjectFileMenu } from "./ProjectFileMenu";
import { m1Freshness, useValidation } from "./useValidation";

export function AppHeader() {
  const { project, unsaved, design, runRecords } = useProject();
  const fresh = m1Freshness(m1Ref(runRecords)?.snapshot_hash ?? null, useValidation(design));
  return (
    <header>
      <Link href="/">Microgrid design tool</Link>
      {project && (
        <span data-testid="project-name">
          {project.name}
          {unsaved && <span title="Unsaved changes"> *unsaved</span>}
        </span>
      )}
      <nav aria-label="Pipeline">
        <Link href="/project/">Project</Link> · <Link href="/loads/">1 Loads</Link> ·{" "}
        <Link href="/sizing/">2 Sizing advice</Link> · <Link href="/network/">3 Network</Link> ·{" "}
        <Link href="/constraints/">4 Constraints</Link> · <Link href="/power-flow/">5 Power flow (M1)</Link> ·{" "}
        <Link href="/constraint-check/">6 Constraint check (M2)</Link>
        {project && fresh !== "current" && <span data-testid="step-6-blocked"> (blocked: M1 {fresh === "stale" ? "stale" : "missing"})</span>}{" "}
        · 7 Further analyses: <Link href="/sensitivity/">Sensitivity (M3a)</Link>, <Link href="/sweep/">Sweep (M3b)</Link>,{" "}
        <Link href="/scenarios/">Scenarios (M3c)</Link> · <Link href="/report/">8 Report</Link> | <Link href="/runs/">Run history</Link>
      </nav>
      <ProjectFileMenu />
      <EngineBadge />
    </header>
  );
}
