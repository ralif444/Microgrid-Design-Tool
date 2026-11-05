"use client";
// Example mode on a form screen (Doc 12 X9 FR-100, Doc 7 §2.3, D-92): initial values by the
// precedence of `initialValue`, an "Example" tag with its source on each field that holds an example
// value, the "not set" note for fields the example leaves empty, and "Reset to example values".
// Outside example mode the hook only returns the refill values, and the screen looks as before.
import { Tag } from "@carbon/react";
import { useState, type ReactNode } from "react";
import { useProject } from "../store";
import { initialValue } from "../store/example";
import styles from "./ExampleForm.module.css";
import { Toggletip } from "./Term";

export const NOT_SET = "Not set in the example: enter a value.";

export function ExampleTag({ label, source }: { label: string; source: string }) {
  return (
    <span className={styles.tag}>
      <Tag type="blue" size="sm">
        Example
      </Tag>
      <Toggletip label={`Example source: ${label}`}>Example value. Source: {source}.</Toggletip>
    </span>
  );
}

export function useExampleForm<T extends object>(screen: string, refill: T) {
  const { example } = useProject();
  const [form, setForm] = useState(() => {
    const values = { ...refill };
    const sources: Record<string, string> = {};
    for (const k of Object.keys(refill)) {
      const v = initialValue(example, screen, k, (refill as Record<string, unknown>)[k]);
      (values as Record<string, unknown>)[k] = v.value;
      if (v.source) sources[k] = v.source;
    }
    return { values, sources };
  });
  const s = example?.settings.screens[screen];
  const set = (k: keyof T & string, v: T[typeof k]) =>
    setForm((f) => {
      const { [k]: _gone, ...sources } = f.sources; // a typed value is no longer the example's
      return { values: { ...f.values, [k]: v }, sources };
    });
  const reset = () =>
    setForm((f) => {
      const values = { ...f.values } as Record<string, unknown>;
      const sources = { ...f.sources };
      for (const [k, e] of Object.entries(s?.fields ?? {}))
        if (k in values) {
          values[k] = e.value;
          sources[k] = e.source;
        }
      return { values: values as T, sources };
    });
  const tag = (k: string, label: string): ReactNode =>
    example && form.sources[k] ? <ExampleTag label={label} source={form.sources[k]} /> : undefined;
  const note = (k: string): ReactNode =>
    s?.needs_value.includes(k) && (form.values as Record<string, unknown>)[k] == null ? <span className={styles.note}>{NOT_SET}</span> : undefined;
  const resetButton =
    s && Object.keys(s.fields).length > 0 ? (
      <button type="button" className={styles.reset} onClick={reset}>
        Reset to example values
      </button>
    ) : null;
  return { values: form.values, set, tag, note, resetButton, inExample: !!s };
}
