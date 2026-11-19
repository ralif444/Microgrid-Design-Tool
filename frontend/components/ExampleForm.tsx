"use client";
// Example mode on a form screen (Doc 12 X9 FR-100, Doc 7 §2.3, D-92): initial values by the
// precedence of `initialValue`, an "Example" tag with its source on each field that holds an example
// value, the "not set" note for fields the example leaves empty, and "Reset to example values".
// Outside example mode the hook only returns the refill values, and the screen looks as before.
import { useKept } from "./useKept";
import { Tag } from "@carbon/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getMeta } from "../api-client";
import type { Status } from "../api-types";
import { useProject } from "../store";
import { initialValue } from "../store/example";
import styles from "./ExampleForm.module.css";
import { Icon } from "./Icon";
import { useLanguage } from "./Language";
import { FURTHER, STEPS } from "./AreaNav";
import banner from "./StatusBanner.module.css";
import { Toggletip } from "./Term";

export const NOT_SET = "Not set in the example: enter a value.";

export function ExampleTag({ label, source }: { label: string; source: string }) {
  const { t } = useLanguage();
  return (
    <span className={styles.tag}>
      <Tag type="blue" size="sm">
        {t("Example")}
      </Tag>
      <Toggletip label={t("Example source: {label}", { label: t(label) })}>{t("Example value. Source: {source}.", { source })}</Toggletip>
    </span>
  );
}

export function NotSet() {
  const { t } = useLanguage();
  return <span className={styles.note}>{t(NOT_SET)}</span>;
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
  const { t } = useLanguage();
  const s = example?.settings.screens[screen];
  const exampleValue = (k: string, v: unknown): unknown => {
    const r = opts.resolve ? opts.resolve(k, v) : v;
    if (r === null) console.warn(`Example settings: ${screen}.${k} dropped (does not resolve on this Project)`);
    return r;
  };
  const [form, setForm] = useKept(`form|${JSON.stringify(refill)}`, () => { // a new run (new refill) wins over kept typing (K149)
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
        {t("Reset to example values")}
      </button>
    ) : null;
  return { values: form.values, set, tag, note, needs, resetButton, inExample: !!s };
}

// Example banner (Doc 7 §2.3, FR-102): info role, not a status colour; the guidance text and its
// source in a "What this step shows" disclosure; the Fake Engine line of PRD §3 rule 3.
export function ExampleGuide({ screen, runnable = true }: { screen: string; runnable?: boolean }) {
  const { example } = useProject();
  const { t } = useLanguage();
  const [fake, setFake] = useState(false);
  useEffect(() => {
    if (example) void getMeta().then((r) => setFake(r.ok && r.data.engine.engine_kind === "FAKE"));
  }, [example]);
  if (!example) return null;
  const g = example.settings.screens[screen]?.guidance;
  return (
    <section aria-label={t("Example guidance")} data-testid="example-guide" data-role="info" className={`no-print ${banner.banner}`}>
      <p className={styles.lead}>
        <Icon name="info" size={20} />
        {runnable
          ? t("Example mode: this screen is pre-filled from the guided example. Press Run.")
          : t("Example mode: this screen shows the guided example.")}
      </p>
      {fake && (
        <p>
          {t("Results on the Fake Engine are placeholders. Start with {code} to see engine results.")
            .split("{code}")
            .flatMap((part, i) => (i === 0 ? [part] : [<code key="c">MGAPP_ENGINE=REAL</code>, part]))}
        </p>
      )}
      {g && (
        <details className={banner.details}>
          <summary>{t("What this step shows")}</summary>
          <p>{g.text}</p>
          <p className={styles.source}>{t("Source: {source}.", { source: g.source })}</p>
        </details>
      )}
    </section>
  );
}

// Pipeline order (Doc 7 §3, FR-102): the stepper steps, then M3a → M4b, then the Report.
const ORDER: [string, string][] = [
  ...STEPS.filter((s) => s.n !== null && s.href && s.href !== "/report/").map((s) => [s.href!, s.label] as [string, string]),
  ...FURTHER,
  ["/report/", "Report"],
];

export const nextReady = (status: Status | undefined) => status === "FEASIBLE" || status === "INFEASIBLE"; // FR-41

// "Next: <step>" under a result (D-97): after a FEASIBLE or INFEASIBLE run, or always on a screen
// without a Run button.
export function ExampleNext({ screen, ready }: { screen: string; ready: boolean }) {
  const { example } = useProject();
  const { t } = useLanguage();
  const i = ORDER.findIndex(([href]) => href === `/${screen}/` || href === screen); // screen: a key, or the workspace limits href
  const next = ORDER[i + 1];
  if (!example || !ready || i < 0 || !next) return null;
  return (
    <p className={`no-print ${styles.next}`} data-testid="example-next">
      <Link href={next[0]}>{t("Next: {step}", { step: t(next[1]) })}</Link>
    </p>
  );
}
