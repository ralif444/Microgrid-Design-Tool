// W5 language switch (plan-workspace.md; vocabulary issue 01, user decision 2026-11-19): English is the
// key. Indonesian strings live per UI group in ./lang and are merged here; a missing key shows English.
// Kept in English in the Indonesian UI by the user's decision: Constraint, Line, Rating, Load, Loading,
// Overloaded, Power filter, Engine, Islanded, Inputs (and the codes M1, M2, PS, …).
import { ID_MODEL } from "./lang/id-model";
import { ID_PAGES } from "./lang/id-pages";
import { ID_REPORT } from "./lang/id-report";
import { ID_SHARED } from "./lang/id-shared";
import { ID_SHELL } from "./lang/id-shell";
import { ID_STUDIES } from "./lang/id-studies";

export type Lang = "en" | "id";
export const LANGS: Lang[] = ["en", "id"];
export const LOCALE: Record<Lang, string> = { en: "en", id: "id-ID" };

export const EN = {
  "area.model": "Model",
  "area.check": "Check",
  "area.studies": "Studies",
  "area.report": "Report",
  "study.current": "Current",
  "lang.label": "Language",
  "lang.en": "English",
  "lang.id": "Bahasa Indonesia",
} as const;
export type Key = keyof typeof EN;

const ID_KEYS: Partial<Record<Key, string>> = {
  "area.model": "Model",
  "area.check": "Pemeriksaan",
  "area.studies": "Studi",
  "area.report": "Laporan",
  "study.current": "Terkini",
  "lang.label": "Bahasa",
};
export const ID: Record<string, string> = { ...ID_SHELL, ...ID_PAGES, ...ID_MODEL, ...ID_STUDIES, ...ID_REPORT, ...ID_SHARED };

export type Vars = Record<string, string | number>;
const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** A key of EN, or the English text itself; {name} placeholders are filled from vars. */
export const translate = (lang: Lang, key: Key | string, vars?: Vars): string => {
  const en = (EN as Record<string, string>)[key] ?? key;
  const id = lang === "id" ? ((ID_KEYS as Record<string, string>)[key] ?? ID[en]) : undefined;
  return fill(id ?? en, vars);
};

export const decimalSeparator = (lang: Lang): string => new Intl.NumberFormat(LOCALE[lang]).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";

// Takes a number already shaped by num/fixed (format.ts) and swaps the decimal separator only: no
// thousands grouping, since parseNumber refuses "1,500" as ambiguous.
export const localize = (s: string, lang: Lang): string => s.replace(".", decimalSeparator(lang));

// The display language for plain formatting functions (fixed in format.ts), set by LanguageProvider.
let current: Lang = "en";
export const setDisplayLang = (l: Lang) => {
  current = l;
};
export const displayLang = () => current;
