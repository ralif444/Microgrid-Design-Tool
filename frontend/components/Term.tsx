"use client";
// Glossary toggletip (Doc 12 X6, FR-91; Carbon Toggletip pattern): an icon button beside a label opens
// the Indonesian definition and its source on click or Enter, closes on Escape, outside click or
// scroll; never on hover. Own component, not Carbon's: its content stays in the DOM while closed and
// would add text to every header. Fixed position, so a sideways-scrolling table does not clip it.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "./glossary";
import { Icon } from "./Icon";
import styles from "./Term.module.css";

export function Term({ k }: { k: GlossaryKey }) {
  const e = GLOSSARY[k];
  return (
    <Toggletip label={`Glossary: ${e.term}`} lang="id">
      <strong>{e.term}</strong> {e.short} <span className={styles.source}>Sumber: {e.source}</span>
    </Toggletip>
  );
}

// The same toggletip with any content (example mode, Doc 12 X9); `label` is the button's name.
export function Toggletip({ label, lang, className, children }: { label: string; lang?: string; className?: string; children: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!at) return;
    const close = (ev: Event) => !ref.current?.contains(ev.target as Node) && setAt(null);
    const scrolled = () => setAt(null);
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [at]);
  return (
    <span
      ref={ref}
      className={`no-print ${styles.term} ${className ?? ""}`}
      onKeyDown={(ev) => {
        if (at && ev.key === "Escape") {
          ev.stopPropagation();
          setAt(null);
          ref.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-expanded={at !== null}
        aria-controls={at ? id : undefined}
        onClick={(ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          setAt(at ? null : { left: Math.min(r.left, window.innerWidth - 304), top: r.bottom + 4 });
        }}
      >
        <Icon name="info" size={16} />
      </button>
      {at && (
        <span id={id} role="note" lang={lang} className={styles.content} style={at}>
          {children}
        </span>
      )}
    </span>
  );
}
