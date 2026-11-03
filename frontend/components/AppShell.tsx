"use client";
// App shell (Doc 7 §2 global elements): brand, Project name with unsaved indicator, Save / Open,
// Run history and Catalogue, engine kind badge on every screen (P2), pipeline stepper (P1).
import Link from "next/link";
import type { ReactNode } from "react";
import { useProject } from "../store";
import styles from "./AppShell.module.css";
import { EngineBadge } from "./EngineBadge";
import { PipelineStepper } from "./PipelineStepper";
import { ProjectFileMenu } from "./ProjectFileMenu";

export function UnsavedFlag() {
  return (
    <span className={styles.unsaved} title="Unsaved changes">
      {" "}
      *unsaved
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { project, unsaved } = useProject();
  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link href="/" className={styles.brand}>
            Microgrid design tool
          </Link>
          {project && (
            <span data-testid="project-name" className={styles.project}>
              {project.name}
              {unsaved && <UnsavedFlag />}
            </span>
          )}
          <span className={styles.spacer} />
          <Link href="/runs/" className={styles.util}>
            Run history
          </Link>
          <Link href="/catalogue/" className={styles.util}>
            Catalogue
          </Link>
          <ProjectFileMenu />
          <EngineBadge />
        </div>
        <PipelineStepper />
      </header>
      <main>{children}</main>
    </>
  );
}
