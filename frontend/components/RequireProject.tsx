"use client";
// Gating for S-02..S-06 (Doc 7 §3.1): editing screens need an open Project.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useProject } from "../store";
import { hasDraft } from "../store/draft";
import { useLanguage } from "./Language";

export function RequireProject({ children }: { children: ReactNode }) {
  const { project } = useProject();
  const { t } = useLanguage();
  // a deep link after a reload: point at the restore offer on Start (audit 2026-11-15 E16); read after mount
  const [draft, setDraft] = useState(false);
  useEffect(() => setDraft(hasDraft()), []);
  if (project) return <>{children}</>;
  return (
    <p role="alert">
      {t(draft ? "No Project is open. Unsaved work is kept in this browser; restore it on Start." : "Create or open a Project first.")}{" "}
      <Link href="/">{t("Go to Start")}</Link>
    </p>
  );
}
