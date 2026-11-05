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

export function NotSet() {
  return <span className={styles.note}>{NOT_SET}</span>;
}

// `resolve` checks an example value against the open Project (Doc 7 §2.3: a parameter_path that does
// not resolve is dropped with a console warning); return null to drop it. `onReset` resets parts of
// the screen that live outside this hook (an axis).
export function useExampleForm<T extends object>(
  screen: string,
  refill: T,
  opts: { resolve?: (field: string, value: unknown) => unknown; onReset?: () => void } = {},
) {
  const { example } = useProject();
  const s = example?.settings.screens[screen];
  const exampleValue = (k: string, v: unknown): unknown => {
    const r = opts.resolve ? opts.resolve(k, v) : v;
    if (r === null) console.warn(`Example settings: ${screen}.${k} dropped (does not resolve on this Project)`);
    return r;
  };
  const [form, setForm] = useState(() => {
    const values = { ...refill } as Record<string, unknown>;
    const sources: Record<string, string> = {};
    const dropped: string[] = [];
    for (const k of Object.keys(refill)) {
      const v = initialValue(example, screen, k, values[k]);
      values[k] = v.source ? exampleValue(k, v.value) : v.value;
      if (v.source && values[k] !== null) sources[k] = v.source;
      else if (v.source) dropped.push(k);
    }
    return { values: values as T, sources, dropped };
  });
  const set = (k: keyof T & string, v: T[typeof k]) =>
    setForm((f) => {
      const { [k]: _gone, ...sources } = f.sources; // a typed value is no longer the example's
      return { ...f, values: { ...f.values, [k]: v }, sources };
    });
  const reset = () => {
    opts.onReset?.();
    setForm((f) => {
      const values = { ...f.values } as Record<string, unknown>;
      const sources = { ...f.sources };
      for (const [k, e] of Object.entries(s?.fields ?? {}))
        if (k in values && !f.dropped.includes(k)) {
          values[k] = exampleValue(k, e.value);
          sources[k] = e.source;
        }
      return { ...f, values: values as T, sources };
    });
  };
  // the example leaves this field empty (D-92 K231), or its value did not resolve
  const needs = (k: string) => !!s && (s.needs_value.includes(k) || form.dropped.includes(k));
  const tag = (k: string, label: string): ReactNode =>
    example && form.sources[k] ? <ExampleTag label={label} source={form.sources[k]} /> : undefined;
  const note = (k: string): ReactNode =>
    needs(k) && (form.values as Record<string, unknown>)[k] == null ? <NotSet /> : undefined;
  const resetButton =
    s && (Object.keys(s.fields).length > 0 || s.presets.length > 0) ? (
      <button type="button" className={styles.reset} onClick={reset}>
        Reset to example values
      </button>
    ) : null;
  return { values: form.values, set, tag, note, needs, resetButton, inExample: !!s };
}
