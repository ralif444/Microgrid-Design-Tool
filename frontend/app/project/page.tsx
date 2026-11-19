"use client";
// Retired (audit 2026-11-14 Phase 7, decision 4; Doc 14 D16): the workspace edits these fields.
// The route stays as a redirect so old links and bookmarks still land on them.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useLanguage } from "../../components/Language";

export default function Redirect() {
  const { t } = useLanguage();
  const router = useRouter();
  useEffect(() => router.replace("/workspace/?el=system"), [router]);
  return <p>{t("Opening the workspace…")}</p>;
}
