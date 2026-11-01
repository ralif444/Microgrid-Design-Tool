"use client";
// Global header (Doc 7 §2): Project name, unsaved indicator, pipeline stepper, engine badge.
// Save/Open arrive with the Project file in WP 1.2.3; stepper steps appear as their screens land.
import Link from "next/link";
import { useProject } from "../store";
import { EngineBadge } from "./EngineBadge";

export function AppHeader() {
  const { project, unsaved } = useProject();
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
        <Link href="/sizing/">2 Sizing advice</Link> · <Link href="/power-flow/">5 Power flow (M1)</Link>
      </nav>
      <EngineBadge />
    </header>
  );
}
