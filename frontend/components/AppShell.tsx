"use client";
// App shell (Doc 7 §2 global elements; visual guidelines §5): Carbon Header in navy with the wordmark,
// Project name with unsaved indicator, Run history, Catalogue, About (S-17), Save / Open and the engine kind badge
// (P2); the 4 px signature gradient bar; the pipeline stepper strip (P1).
import { Header, HeaderName } from "@carbon/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useProject } from "../store";
import styles from "./AppShell.module.css";
import { EngineBadge } from "./EngineBadge";
import { PipelineStepper } from "./PipelineStepper";
import { ProjectFileMenu } from "./ProjectFileMenu";

// The visible mark is a dot; the text stays for assistive tech and tests.
export function UnsavedFlag() {
  return (
    <span className={styles.unsaved} title="Unsaved changes">
      <span aria-hidden="true" className={styles.dot} />
      <span className="sr-only"> *unsaved</span>
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { project, unsaved } = useProject();
  return (
    <>
      <Header aria-label="Microgrid Design Tool" className={styles.header}>
        <HeaderName as={Link} href="/" prefix="" className={styles.brand}>
          Microgrid Design Tool
        </HeaderName>
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
        <Link href="/about/" className={styles.util}>
          About
        </Link>
        <ProjectFileMenu />
        <EngineBadge />
      </Header>
      <div className={`no-print ${styles.below}`}>
        <div className={styles.signature} aria-hidden="true" />
        <div className={styles.strip}>
          <PipelineStepper />
        </div>
      </div>
      <main>{children}</main>
    </>
  );
}
