"use client";
// Language context (W5 groundwork): a per-viewer convenience in localStorage like the theme, never
// project data. <html lang> follows it. The switch stays hidden until Indonesian strings exist.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { LANGS, localize, translate, type Key, type Lang } from "./i18n";

const LANG_KEY = "mdt-lang";
// shortcut: hidden while issue 01 (Indonesian vocabulary) is open; show it once ID holds the strings
export const LANGUAGE_SWITCH_SHOWN = false;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; n: (s: string | number) => string };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => undefined, t: (k) => translate("en", k), n: String });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (LANGUAGE_SWITCH_SHOWN && LANGS.includes(saved as Lang)) setLangState(saved as Lang);
    } catch {
      // storage blocked: English
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  }, []);
  const t = useCallback((k: Key) => translate(lang, k), [lang]);
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
