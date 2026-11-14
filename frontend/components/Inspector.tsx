"use client";
// Inspector side panel for a Bus, Line, Inverter or Load (Doc 12 X5, FR-90): not a modal. It shows the
// same element rows as the diagram tooltip, from `buildSldModel` (X8, guideline §A7): inputs from the
// Project, the latest M1 and M2 on the current design (FR-93; hidden when none matches), the sizing
// check, and "Edit in table" through `?focus=`. Focus moves in on open and back to the trigger on
// close; Escape closes. It only displays stored values (guideline §1 rule 1).
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./Inspector.module.css";
import type { SldRow, SldSection } from "./sld/buildSldModel";
import { useSldModel } from "./sld/useSldModel";

export type ElementRef = { kind: "bus" | "line" | "inverter" | "load"; id: string };

const KIND = { bus: ["Bus", "buses"], line: ["Line", "lines"], inverter: ["Inverter", "inverters"], load: ["Load", "loads"] } as const;

export const rowText = (r: SldRow) => `${r.value}${r.unit && r.value !== "—" ? ` ${r.unit}` : ""}`;

function Pairs({ label, rows }: { label: string; rows: SldRow[] }) {
  return (
    <dl aria-label={label} className={styles.pairs}>
      {rows.map((r, k) => (
        <div key={k}>
          <dt>{r.label}</dt>
          <dd>
            {rowText(r)}
            {r.note && <span className={styles.note}> ({r.note})</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// headings and empty sentences of FR-90; the rows themselves are the model's
const SECTIONS: Record<SldSection["title"], { head?: string; label: string; none?: string; nothing?: string }> = {
  "Design data": { label: "Inputs" },
  Results: { head: "Latest power flow (M1)", label: "Power flow values", none: "No current power flow for this design." },
  Checks: { head: "Constraint check (M2)", label: "Constraint check values", none: "No current constraint check for this design.", nothing: "No evaluated constraint on this element." },
  "Sizing check": { head: "Sizing check (advisory)", label: "Sizing check values" },
  Issues: { head: "Issues", label: "Validation issues" },
};

export function Inspector({
  target,
  onClose,
  docked = false,
  edit,
  focusKey = `${target.kind}:${target.id}`,
}: {
  target: ElementRef;
  onClose: () => void;
  /** W4 workspace: a column of the page instead of a panel over it. */
  docked?: boolean;
  /** W4 Model area: an edit form in place of the read-only inputs and the "Edit in table" link. */
  edit?: ReactNode;
  /** Focus moves in when this changes; the workspace keeps it when a Bus is renamed. */
  focusKey?: string | number;
}) {
  const { full, fake } = useSldModel();
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    head.current?.focus();
    return () => trigger?.focus();
  }, [focusKey]);

  const [word, list] = KIND[target.kind];
  const el = full[list].find((e) => e.id === target.id);
  const editHref = target.kind === "load" ? "/loads/" : `/network/?focus=${encodeURIComponent(target.id)}`;

  return (
    <aside
      aria-label={`Inspector: ${word} ${target.id}`}
      className={`no-print ${docked ? styles.docked : styles.panel}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className={styles.top}>
        <h2 ref={head} tabIndex={-1}>
          {word} {target.id}
        </h2>
        <button type="button" onClick={onClose}>
          Close inspector
        </button>
      </div>
      {edit}
      {!el ? (
        !edit && <p>Not in the current design.</p>
      ) : (
        el.sections.filter((s) => !(edit && s.title === "Design data") && !(edit && s.title === "Issues")).map((s) => {
          const t = SECTIONS[s.title];
          const empty = s.empty ? (s.empty.startsWith("No current") ? t.none : `${s.empty}.`) : !s.rows.length ? t.nothing : null;
          return (
            <section key={s.title} aria-label={s.title}>
              {t.head && <h3>{t.head}</h3>}
              {empty ? <p>{empty}</p> : <Pairs label={t.label} rows={s.rows} />}
            </section>
          );
        })
      )}
      {fake && (
        <p className={styles.fake}>
          <strong>FAKE engine:</strong> placeholder values, not engine results.
        </p>
      )}
      {!edit && (
        <p>
          <Link href={editHref}>{target.kind === "load" ? "Edit in Loads" : "Edit in table"}</Link>
        </p>
      )}
    </aside>
  );
}
