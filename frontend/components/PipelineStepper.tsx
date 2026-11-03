"use client";
// Pipeline stepper (Doc 7 P1, §3): eight steps with done / stale / blocked state and the current
// screen. Guidance only, never a wizard lock: every step stays a link. States are derived from the
// Project store and the snapshot hash already used for the stale-M1 check (D-46); nothing is stored.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ValidationReport } from "../api-types";
import type { ProjectState } from "../store";
import { m1Ref, useProject } from "../store";
import { Icon } from "./Icon";
import styles from "./PipelineStepper.module.css";
import { m1Freshness, useValidation } from "./useValidation";

export type StepState = "todo" | "done" | "stale" | "blocked";
type Step = { n: number | null; label: string; href: string | null };

export const STEPS: Step[] = [
  { n: null, label: "Project", href: "/project/" },
  { n: 1, label: "Loads", href: "/loads/" },
  { n: 2, label: "Sizing advice", href: "/sizing/" },
  { n: 3, label: "Network", href: "/network/" },
  { n: 4, label: "Constraints", href: "/constraints/" },
  { n: 5, label: "Power flow (M1)", href: "/power-flow/" },
  { n: 6, label: "Constraint check (M2)", href: "/constraint-check/" },
  { n: 7, label: "Further analyses", href: null },
  { n: 8, label: "Report", href: "/report/" },
];

export const FURTHER: [string, string][] = [
  ["/sensitivity/", "Sensitivity (M3a)"],
  ["/sweep/", "Sweep (M3b)"],
  ["/scenarios/", "Scenarios (M3c)"],
  ["/envelope/", "Envelope (M3d)"],
  ["/small-signal/", "Small-signal (M4a)"],
  ["/transient/", "Transient (M4b)"],
];

const FURTHER_TYPES = new Set(["M3a", "M3b", "M3c", "M3d", "M4a", "M4b"]);

// One state per STEPS entry; report is the live stage-1 check of the design now in the store.
export function stepStates(
  s: Pick<ProjectState, "project" | "design" | "sizingAdvice" | "runRecords">,
  report: ValidationReport | null,
): StepState[] {
  const d = s.design;
  const m1Hash = m1Ref(s.runRecords)?.snapshot_hash ?? null;
  const m1 = m1Freshness(m1Hash, report);
  const lastM2 = s.runRecords.filter((r) => r.analysis_type === "M2").at(-1);
  const further = s.runRecords.filter((r) => FURTHER_TYPES.has(r.analysis_type));
  const after = (done: boolean, stale: boolean): StepState => (m1 !== "current" ? "blocked" : done ? "done" : stale ? "stale" : "todo");
  return [
    s.project ? "done" : "todo",
    (d.loads ?? []).length ? "done" : "todo",
    s.sizingAdvice.some((a) => a.state === "ACCEPTED" || a.state === "SKIPPED") ? "done" : "todo",
    (d.buses ?? []).length && (d.inverters ?? []).length ? "done" : "todo",
    Object.values(d.design_constraints ?? {}).some((v) => v !== null && v !== undefined) ? "done" : "todo",
    m1 === "current" ? "done" : m1 === "stale" ? "stale" : "todo",
    after(lastM2?.snapshot_hash === m1Hash, !!lastM2),
    after(further.some((r) => r.snapshot_hash === m1Hash), further.length > 0),
    s.runRecords.length ? "done" : "todo",
  ];
}

export function PipelineStepperView({ states, path, m1Missing = false }: { states: StepState[]; path: string; m1Missing?: boolean }) {
  const inFurther = FURTHER.some(([h]) => path.startsWith(h));
  return (
    <nav aria-label="Pipeline" className={styles.nav}>
      <ol className={styles.steps}>
        {STEPS.map((st, k) => {
          const state = states[k] ?? "todo";
          const current = st.href ? path.startsWith(st.href) : inFurther;
          const body = (
            <>
              {st.n !== null && (
                <span className={styles.badge} aria-hidden="true">
                  {state === "done" ? <Icon name="check" size={12} /> : st.n}
                </span>
              )}
              <span className={styles.label}>
                {st.n !== null && <span className="sr-only">{st.n} </span>}
                {st.label}
              </span>
            </>
          );
          // State words sit beside the link, so the link name stays "<n> <label>".
          return (
            <li key={st.label} className={styles.step} data-state={state} data-current={current || undefined}>
              {st.href ? (
                <Link href={st.href} aria-current={current ? "page" : undefined} className={styles.link}>
                  {body}
                </Link>
              ) : (
                <span className={styles.link} aria-current={current ? "true" : undefined}>
                  {body}
                </span>
              )}
              {(state === "stale" || state === "blocked") && (
                <span className={styles.flag} data-testid={st.n === 6 && state === "blocked" ? "step-6-blocked" : undefined}>
                  <Icon name={state === "stale" ? "clock" : "ban"} size={12} />
                  {state}
                  {state === "blocked" && <span className="sr-only">: M1 {m1Missing ? "missing" : "stale"}</span>}
                </span>
              )}
              {state === "done" && st.n !== null && <span className="sr-only">done</span>}
            </li>
          );
        })}
      </ol>
      <ul className={styles.further} aria-label="Further analyses">
        {FURTHER.map(([h, label]) => (
          <li key={h}>
            <Link href={h} aria-current={path.startsWith(h) ? "page" : undefined}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PipelineStepper() {
  const state = useProject();
  const report = useValidation(state.design);
  const path = usePathname() ?? "/";
  const states = state.project ? stepStates(state, report) : STEPS.map(() => "todo" as StepState);
  const m1Missing = !m1Ref(state.runRecords);
  return <PipelineStepperView states={states} path={path} m1Missing={m1Missing} />;
}
