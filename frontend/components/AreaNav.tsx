"use client";
// Area navigation (ADR-016 option B; Doc 14 D15, user-decided): the four workspace areas replace the
// eight-step stepper. Header tabs pick the area; the row below lists the area's screens, each with the
// state the stepper drew (done / stale / blocked, Doc 7 §3.1). Guidance only, never a lock: every screen
// stays a link. States come from the store and the stale-M1 snapshot check (D-46); nothing is stored.
import { Tag } from "@carbon/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ValidationReport } from "../api-types";
import type { ProjectState } from "../store";
import { m1Ref, useProject } from "../store";
import { useCableSizingFlag } from "./cable";
import { Icon } from "./Icon";
import styles from "./AreaNav.module.css";
import { m1Freshness, useValidation } from "./useValidation";
import { useLanguage } from "./Language";

// ADR-016 decision 1: the workspace is the page frame; opening or creating a Project lands there.
export const HOME = "/workspace/";

export type StepState = "todo" | "done" | "stale" | "blocked";
type Step = { n: number | null; label: string; href: string | null };

// The pipeline order (Doc 7 P1), kept for the step states and the example's "Next" order (FR-102).

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

// S-19 (Doc 12 X10) joins the list only when /api/meta reports the flag (FR-105, D-103 K286).
export const CABLE_SIZING: [string, string] = ["/cable-sizing/", "Cable and breaker sizing"];
// S-20 (Doc 12 B2, B3) joins the list only when the Project has a BatteryBank (FR-119, D-106).
export const BATTERY: [string, string] = ["/battery/", "Battery adequacy"];

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

export type AreaKey = "model" | "check" | "studies" | "report";
/** href, label, index into STEPS for its state (null: no state) */
type Screen = [href: string, label: string, step: number | null];
type Area = { key: AreaKey; label: string; href: string; screens: Screen[] };

export function areas(cableSizing = false, battery = false): Area[] {
  const studies: Screen[] = [...FURTHER, ...(cableSizing ? [CABLE_SIZING] : []), ...(battery ? [BATTERY] : [])].map(([h, l]) => [h, l, null]);
  return [
    {
      key: "model",
      label: "Model",
      href: HOME,
      screens: [
        [HOME, "Diagram", null],
        ["/project/", "Project", 0],
        ["/loads/", "Loads", 1],
        ["/sizing/", "Sizing advice", 2],
        ["/network/", "Network", 3],
        ["/constraints/", "Constraints", 4],
      ],
    },
    {
      key: "check",
      label: "Check",
      href: `${HOME}?area=check`,
      screens: [
        [`${HOME}?area=check`, "Diagram", null],
        ["/power-flow/", "Power flow (M1)", 5],
        ["/constraint-check/", "Constraint check (M2)", 6],
      ],
    },
    { key: "studies", label: "Studies", href: FURTHER[0][0], screens: studies },
    {
      key: "report",
      label: "Report",
      href: "/report/",
      screens: [
        ["/report/", "Report", 8],
        ["/runs/", "Run history", null],
      ],
    },
  ];
}

/** The screen being shown: the route, plus the workspace area from `?area=`. */
export const here = (path: string, area: string | null) => (path.startsWith(HOME) ? (area === "check" ? `${HOME}?area=check` : HOME) : path);
export const areaOf = (list: Area[], at: string) => list.find((a) => a.screens.some(([h]) => h === at || (!h.startsWith(HOME) && at.startsWith(h)))) ?? null;

export function AreaTabsView({ list, current }: { list: Area[]; current: AreaKey | null }) {
  return (
    <nav aria-label="Areas" className={styles.tabs}>
      {list.map((a) => (
        <Link key={a.key} href={a.href} aria-current={a.key === current ? "page" : undefined}>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}

export function AreaScreensView({ area, at, states, m1Missing = false }: { area: Area; at: string; states: StepState[]; m1Missing?: boolean }) {
  // the studies share one state, the stepper's step 7: shown once after the list
  const studies = area.key === "studies" ? (states[7] ?? "todo") : null;
  const flag = (state: StepState, testId?: string) =>
    (state === "stale" || state === "blocked") && (
      <Tag type={state === "stale" ? "warm-gray" : "cool-gray"} size="sm" renderIcon={() => <Icon name={state === "stale" ? "clock" : "ban"} />} className={styles.flag} data-testid={testId}>
        {state === "stale" ? "Stale" : "Blocked"}
        {state === "blocked" && <span className="sr-only">: M1 {m1Missing ? "missing" : "stale"}</span>}
      </Tag>
    );
  return (
    <nav aria-label="Screens" className={styles.screens}>
      <ul aria-label={area.label}>
        {area.screens.map(([h, label, step]) => {
          const state = step === null ? null : (states[step] ?? "todo");
          return (
            <li key={h} data-state={state ?? undefined}>
              <Link href={h} aria-current={h === at || (!h.startsWith(HOME) && at.startsWith(h)) ? "page" : undefined}>
                {state === "done" && <Icon name="check" size={12} />}
                {label}
              </Link>
              {/* state words sit beside the link, so its name stays the screen name */}
              {state === "done" && <span className="sr-only">done</span>}
              {state && flag(state, step === 6 && state === "blocked" ? "step-6-blocked" : undefined)}
            </li>
          );
        })}
        {studies && (studies === "stale" || studies === "blocked") && <li className={styles.note}>{flag(studies)}</li>}
      </ul>
    </nav>
  );
}

function useArea() {
  const state = useProject();
  const at = here(usePathname() ?? "/", useSearchParams().get("area"));
  const list = areas(useCableSizingFlag() === true, state.batteryBanks.length > 0);
  return { state, list, at, area: areaOf(list, at) };
}

export function AreaTabs() {
  const { list, area } = useArea(); // tabs need no step states, so no validation request
  const { t } = useLanguage();
  return <AreaTabsView list={list.map((a) => ({ ...a, label: t(`area.${a.key}`) }))} current={area?.key ?? null} />;
}

export function AreaScreens() {
  const { state, area, at } = useArea();
  const report = useValidation(state.design);
  const states = state.project ? stepStates(state, report) : STEPS.map(() => "todo" as StepState);
  return area ? <AreaScreensView area={area} at={at} states={states} m1Missing={!m1Ref(state.runRecords)} /> : null;
}
