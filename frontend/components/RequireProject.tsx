"use client";
// Gating for S-02..S-06 (Doc 7 §3.1): editing screens need an open Project.
import Link from "next/link";
import type { ReactNode } from "react";
import { useProject } from "../store";

export function RequireProject({ children }: { children: ReactNode }) {
  const { project } = useProject();
  if (project) return <>{children}</>;
  return (
    <p role="alert">
      Create or open a Project first. <Link href="/">Go to Start</Link>
    </p>
  );
}
