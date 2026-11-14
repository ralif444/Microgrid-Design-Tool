"use client";
// App shell (Doc 7 §2 global elements; ADR-016 §3): Carbon Header on the page surface with the wordmark,
// Project name with unsaved indicator, the W4 Workspace (beside the step pages), Run history, Catalogue, About (S-17), Save / Open and the engine kind badge
// (P2), the theme switch; the pipeline stepper strip (P1). In example mode (Doc 12 X9,
// FR-99) a blue Tag "Example mode" (info, not a status colour) and "Leave example mode" sit by the badge.
import { Header, HeaderName, Tag } from "@carbon/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useProject, useProjectDispatch } from "../store";
import styles from "./AppShell.module.css";
import { EngineBadge } from "./EngineBadge";
import { PipelineStepper } from "./PipelineStepper";
import { ProjectFileMenu } from "./ProjectFileMenu";
import { Toggletip } from "./Term";
import { ThemeSwitch } from "./ThemeSwitch";

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
  const { project, unsaved, example } = useProject();
  const dispatch = useProjectDispatch();
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
        {project && (
          <Link href="/workspace/" className={styles.util}>
            Workspace
          </Link>
        )}
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
        <ThemeSwitch className={styles.seg} />
        {example && (
          <span className={styles.example} data-testid="example-mode">
            <Tag type="blue" size="md">
              Example mode
            </Tag>
            <Toggletip label="About example mode" className={styles.tip}>
              Analysis forms are pre-filled from the guided example D2, each value with its source. Save writes a
              normal Project file: the example settings are not saved, so reopening the file opens a normal Project.
            </Toggletip>
            <button type="button" onClick={() => dispatch({ type: "exampleLeft" })}>
              Leave example mode
            </button>
          </span>
        )}
        <EngineBadge />
      </Header>
      <div className={`no-print ${styles.below}`}>
        <div className={styles.strip}>
          <PipelineStepper />
        </div>
      </div>
      <main>{children}</main>
    </>
  );
}
