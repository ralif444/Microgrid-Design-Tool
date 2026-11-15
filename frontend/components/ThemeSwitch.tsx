"use client";
// Light / dark switch (ADR-016 §3). The choice is a per-viewer convenience kept in localStorage, never
// project data; layout.tsx applies it to <html data-theme> before first paint.
import { useEffect, useState } from "react";

const THEME_KEY = "mdt-theme"; // also in the pre-paint script of app/layout.tsx
type Theme = "light" | "dark";

export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  const choose = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  };
  return (
    <span role="group" aria-label="Theme" className={className}>
      {(["light", "dark"] as const).map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => choose(t)}>
          {t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </span>
  );
}
