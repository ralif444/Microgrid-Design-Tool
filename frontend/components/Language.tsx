"use client";
// Language context (W5): a per-viewer convenience in localStorage like the theme, never
// project data. <html lang> follows it. 
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { LANGS, localize, setDisplayLang, translate, type Key, type Lang, type Vars } from "./i18n";

const LANG_KEY = "mdt-lang";
// Shown since issue 01 was decided (user 2026-11-19).
export const LANGUAGE_SWITCH_SHOWN = true;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key | string, vars?: Vars) => string; n: (s: string | number) => string };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => undefined, t: (k, v) => translate("en", k, v), n: String });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (LANGUAGE_SWITCH_SHOWN && LANGS.includes(saved as Lang)) {
        setDisplayLang(saved as Lang);
        setLangState(saved as Lang);
      }
    } catch {
      // storage blocked: English
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    setDisplayLang(lang);
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setDisplayLang(l);
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  }, []);
  const t = useCallback((k: Key | string, v?: Vars) => translate(lang, k, v), [lang]);
  const n = useCallback((s: string | number) => localize(String(s), lang), [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t, n }}>{children}</LangCtx.Provider>;
}

export const useLanguage = () => useContext(LangCtx);

export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();
  if (!LANGUAGE_SWITCH_SHOWN) return null;
  return (
    <span role="group" aria-label={t("lang.label")} className={className}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {t(`lang.${l}`)}
        </button>
      ))}
    </span>
  );
}
