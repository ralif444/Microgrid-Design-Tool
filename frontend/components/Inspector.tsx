"use client";
// Inspector side panel for a Bus, Line or Inverter (Doc 12 X5, FR-90): not a modal. Inputs from the
// Project, the latest M1 and M2 on the current design (FR-93; hidden when none matches), the
// sizing-check row, and "Edit in table" through `?focus=`. Focus moves in on open and back to the
// trigger on close; Escape closes. It only displays stored values (guideline §1 rule 1).
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { M1Payload, M2Payload } from "../api-types";
import { latestRun, useProject } from "../store";
import { num } from "./format";
import styles from "./Inspector.module.css";
import { ConstraintTable } from "./M2Results";
import { useValidation } from "./useValidation";

export type ElementRef = { kind: "bus" | "line" | "inverter"; id: string };

const KIND = { bus: ["Bus", "buses"], line: ["Line", "lines"], inverter: ["Inverter", "inverters"] } as const;
const PAYLOAD_OK = ["FEASIBLE", "INFEASIBLE"];

type Pair = [string, string];
const val = (v: unknown): string | null =>
  typeof v === "number" ? String(num(v)) : typeof v === "string" ? v : typeof v === "boolean" ? (v ? "yes" : "no") : null;

function Pairs({ label, rows }: { label: string; rows: Pair[] }) {
  return (
    <dl aria-label={label} className={styles.pairs}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function m1Rows(p: M1Payload, t: ElementRef): Pair[] | undefined {
  const f = (v: number, unit: string) => `${num(v)} ${unit}`;
  if (t.kind === "bus") {
    const b = p.bus_results.find((x) => x.bus_id === t.id);
    return b && [["Voltage", f(b.voltage_kv, "kV")], ["Voltage", f(b.voltage_pu, "p.u.")], ["Angle", f(b.angle_deg, "deg")]];
  }
  if (t.kind === "inverter") {
    const i = p.inverter_results.find((x) => x.inverter_id === t.id);
    return i && [["P", f(i.p_kw, "kW")], ["Q", f(i.q_kvar, "kvar")], ["S", f(i.s_kva, "kVA")], ["Loading", f(i.loading_ratio, "ratio")]];
  }
  const l = p.line_results.find((x) => x.line_id === t.id);
  return l && [["P from", f(l.p_from_kw, "kW")], ["Q from", f(l.q_from_kvar, "kvar")], ["Current", f(l.current_a, "A")], ["Losses", f(l.losses_kw, "kW")]];
}

export function Inspector({ target, onClose }: { target: ElementRef; onClose: () => void }) {
  const { design, runRecords } = useProject();
  const current = useValidation(design)?.snapshot_hash ?? null;
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    head.current?.focus();
    return () => trigger?.focus();
  }, [target.kind, target.id]);

  const [word, list] = KIND[target.kind];
  const entity = (design[list] as { id: string }[] | undefined)?.find((e) => e.id === target.id) as Record<string, unknown> | undefined;
  const inputs: Pair[] = Object.entries(entity ?? {}).flatMap(([k, v]): Pair[] => {
    if (k === "id") return [];
    if (k === "catalog_ref" && v && typeof v === "object") return [["catalogue entry", String((v as { entry_id: string }).entry_id)]];
    const s = val(v);
    return s === null ? [] : [[k, s]];
  });
  const m1 = latestRun(runRecords, "M1", current);
  const m1p = m1 && m1.result.status === "FEASIBLE" ? (m1.result.payload as unknown as M1Payload) : null;
  const m1v = m1p && m1Rows(m1p, target);
  const m2 = latestRun(runRecords, "M2", current);
  const m2p = m2 && PAYLOAD_OK.includes(m2.result.status) ? (m2.result.payload as unknown as M2Payload) : null;
  const margins = m2p?.constraint_margins.filter((c) => c.element_id === target.id) ?? [];
  const inv = target.kind === "inverter" ? m2p?.sizing_check.per_inverter.find((x) => x.inverter_id === target.id) : undefined;
  const line = target.kind === "line" ? m2p?.sizing_check.per_line.find((x) => x.line_id === target.id) : undefined;
  const sizing: Pair[] | null = inv
    ? [["Required rating", `${num(inv.required_rating_kva)} kVA`], ["Headroom", `${num(inv.headroom_kva)} kVA`], ["Rating margin short", inv.rating_margin_short ? "yes" : "no"]]
    : line
      ? [["Required current", `${num(line.required_current_a)} A`]]
      : null;
  const fake = [m1, m2].some((r) => r?.engine_kind === "FAKE");

  return (
    <aside
      aria-label={`Inspector: ${word} ${target.id}`}
      className={`no-print ${styles.panel}`}
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
      {entity ? <Pairs label="Inputs" rows={inputs} /> : <p>Not in the current design.</p>}
      <h3>Latest power flow (M1)</h3>
      {m1v ? <Pairs label="Power flow values" rows={m1v} /> : <p>No current power flow for this design.</p>}
      <h3>Constraint check (M2)</h3>
      {!m2p ? (
        <p>No current constraint check for this design.</p>
      ) : margins.length ? (
        <ConstraintTable label={`Constraints on ${target.id}`} rows={margins} />
      ) : (
        <p>No evaluated constraint on this element.</p>
      )}
      {sizing && (
        <>
          <h3>Sizing check (advisory)</h3>
          <Pairs label="Sizing check values" rows={sizing} />
        </>
      )}
      {fake && (
        <p className={styles.fake}>
          <strong>FAKE engine:</strong> placeholder values, not engine results.
        </p>
      )}
      <p>
        <Link href={`/network/?focus=${encodeURIComponent(target.id)}`}>Edit in table</Link>
      </p>
    </aside>
  );
}
