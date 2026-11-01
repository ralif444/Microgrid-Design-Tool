"use client";
// Global header (Doc 7 §2): Project name, unsaved indicator, pipeline stepper, engine badge.
// Save/Open arrive with the Project file in WP 1.2.3; steps 7-8 appear as their screens land.
import Link from "next/link";
import { m1Ref, useProject } from "../store";
import { EngineBadge } from "./EngineBadge";
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
        {project && fresh !== "current" && <span data-testid="step-6-blocked"> (blocked: M1 {fresh === "stale" ? "stale" : "missing"})</span>}
      </nav>
      <EngineBadge />
    </header>
  );
}
