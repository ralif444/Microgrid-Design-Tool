"use client";
// App shell (Doc 7 §2 global elements; ADR-016 option B): Carbon Header on the page surface with the
// wordmark, Project name with unsaved indicator, the area tabs, Catalogue, About (S-17), Save / Open, the
// theme switch and the engine kind badge (P2); below it the screens of the current area, which replace
// the pipeline stepper (Doc 14 D15). In example mode (Doc 12 X9,
// FR-99) a blue Tag "Example mode" (info, not a status colour) and "Leave example mode" sit by the badge.
import { Header, HeaderName, Tag } from "@carbon/react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { useProject, useProjectDispatch } from "../store";
import styles from "./AppShell.module.css";
import { EngineBadge } from "./EngineBadge";
import { AreaScreens, AreaTabs } from "./AreaNav";
import { ProjectFileMenu } from "./ProjectFileMenu";
import { Toggletip } from "./Term";
import { LanguageSwitch } from "./Language";
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
        {/* useSearchParams in a static export needs a Suspense boundary */}
        {project && (
          <Suspense fallback={null}>
            <AreaTabs />
          </Suspense>
        )}
        <span className={styles.spacer} />
        <Link href="/catalogue/" className={styles.util}>
          Catalogue
        </Link>
        <Link href="/about/" className={styles.util}>
          About
        </Link>
        <ProjectFileMenu />
        <ThemeSwitch className={styles.seg} />
        <LanguageSwitch className={styles.seg} />
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
      {project && (
        <div className={`no-print ${styles.below}`}>
          <div className={styles.strip}>
            <Suspense fallback={null}>
              <AreaScreens />
            </Suspense>
          </div>
        </div>
      )}
      <main>{children}</main>
    </>
  );
}
