// W5 groundwork (plan-workspace.md): the dictionary and number separators, no dependency. English only
// for now; the Indonesian strings wait on .scratch/ui-redesign/issues/01-indonesian-vocabulary.md.
export type Lang = "en" | "id";
export const LANGS: Lang[] = ["en", "id"];
export const LOCALE: Record<Lang, string> = { en: "en", id: "id-ID" };

export const EN = {
  "area.model": "Model",
  "area.check": "Check",
  "area.studies": "Studies",
  "area.report": "Report",
  "lang.label": "Language",
  "lang.en": "English",
  "lang.id": "Bahasa Indonesia",
} as const;
export type Key = keyof typeof EN;

// Filled once issue 01 is decided; a missing key shows the English string.
const ID: Partial<Record<Key, string>> = {};

export const translate = (lang: Lang, key: Key): string => (lang === "id" && ID[key]) || EN[key];

export const decimalSeparator = (lang: Lang): string => new Intl.NumberFormat(LOCALE[lang]).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";

// Takes a number already shaped by num/fixed (format.ts) and swaps the decimal separator only: no
// thousands grouping, since parseNumber refuses "1,500" as ambiguous.
export const localize = (s: string, lang: Lang): string => s.replace(".", decimalSeparator(lang));
