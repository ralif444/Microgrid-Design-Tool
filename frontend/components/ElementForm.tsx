"use client";
// Edit forms of the W4 workspace inspector (Model area): the same fields, labels and units as the
// S-03, S-05 and S-06 tables (elementFields.ts), the same stage-1 issues inline per field, and the
// same delete rules (useRowDelete: FR-11 Bus guard, F2 confirmation).
import { useState } from "react";
import type { Load, ValidationIssue } from "../api-types";
import { useProject, useProjectDispatch, type Collection } from "../store";
import { BUS_COLUMNS, CONSTRAINT_FIELDS, INVERTER_COLUMNS, LINE_COLUMNS, loadMode, modePatch, PF_DIRECTIONS, type LoadMode } from "./elementFields";
import styles from "./ElementForm.module.css";
import type { Column } from "./EntityTable";
import { useRowDelete } from "./EntityTable";
import { BankPick, CatalogPick } from "./ElementSource";
import type { ElementRef } from "./Inspector";
import { NumberField } from "./NumberField";
import { Toast } from "./Toast";
import { useValidation } from "./useValidation";

type Row = { id?: string | null; [field: string]: unknown };
const OF: Record<ElementRef["kind"], [Collection, string, Column[]]> = {
  bus: ["buses", "Bus", BUS_COLUMNS],
  line: ["lines", "Line", LINE_COLUMNS],
  inverter: ["inverters", "Inverter", INVERTER_COLUMNS],
  load: ["loads", "Load", []],
};

const messages = (issues: ValidationIssue[], field: string) =>
  issues
    .filter((i) => i.field === field)
    .map((i) => i.message)
    .join(" ") || null;

function Choice({
  id,
  label,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  options: [string, string][];
  value: unknown;
  onChange: (v: string | null) => void;
  error: string | null;
}) {
  return (
    <span className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={(value as string) ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">(choose)</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${id}-error`} className={styles.error}>
          {error}
        </span>
      )}
    </span>
  );
}

// A Bus id is committed on blur or Enter, so the selection follows the new id once, not per keystroke.
function BusId({ value, onCommit, error }: { value: string; onCommit: (v: string) => void; error: string | null }) {
  const [text, setText] = useState(value);
  const commit = () => text.trim() && text.trim() !== value && onCommit(text.trim());
  return (
    <span className={styles.field}>
      <label htmlFor="insp-id">Bus id</label>
      <input
        id="insp-id"
        value={text}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "insp-id-error" : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {error && (
        <span id="insp-id-error" className={styles.error}>
          {error}
        </span>
      )}
    </span>
  );
}

export function ElementForm({ target, onRename, onDeleted }: { target: ElementRef; onRename: (id: string) => void; onDeleted: () => void }) {
  const { design, batteryBanks } = useProject();
  const dispatch = useProjectDispatch();
  const [collection, entity, columns] = OF[target.kind];
  // the Loads screen checks against PS (S-03); the network screen with the battery banks (S-05)
  const report = useValidation(design, target.kind === "load" ? "PS" : null, batteryBanks);
  const { dialog, refused, setRefused, remove } = useRowDelete(collection, onDeleted);
  const [modes, setModes] = useState<Record<string, LoadMode>>({});
  const row: Row | undefined = (design[collection] as Row[] | undefined)?.find((r) => r.id === target.id);
  if (!row) return null;
  const issues = (report?.issues ?? []).filter((i) => i.entity === entity && i.id === target.id);
  const busOptions: [string, string][] = (design.buses ?? []).map((b) => [b.id ?? "", b.id ?? ""]);
  const set = (patch: Row) => dispatch({ type: "rowUpdated", collection, id: target.id, patch });
  const general = issues.filter((i) => !i.field);

  const field = (c: Column) => {
    if (c.kind === "derived") {
      const v = c.value(row);
      return (
        <span key={c.label} className={styles.derived}>
          <span>{c.label}</span>{" "}
          <span>
            {v ?? "—"}
            {v != null && c.unit !== "entry" ? ` ${c.unit}` : ""}
          </span>
        </span>
      );
    }
    const f = c.field;
    if (c.kind === "text")
      return <BusId key={`${f}-${target.id}`} value={target.id} error={messages(issues, f)} onCommit={(v) => (set({ [f]: v }), onRename(v))} />;
    if (c.kind === "bus")
      return (
        <Choice key={f} id={`insp-${f}`} label={c.label} options={busOptions} value={row[f]} error={messages(issues, f)} onChange={(v) => set({ [f]: v })} />
      );
    return (
      <NumberField
        key={f}
        id={`insp-${f}`}
        label={c.label}
        unit={c.unit}
        value={row[f] as number | null}
        error={messages(issues, f)}
        onChange={(v) => set({ [f]: v })}
      />
    );
  };

  let body = columns.map(field);
  if (target.kind === "load") {
    const l = row as Load;
    const mode = loadMode(l, modes[target.id]);
    const choose = (m: LoadMode) => (setModes({ ...modes, [target.id]: m }), set(modePatch(m)));
    body = [
      <Choice
        key="bus"
        id="insp-bus_id"
        label="Bus"
        options={busOptions}
        value={l.bus_id}
        error={messages(issues, "bus_id")}
        onChange={(v) => set({ bus_id: v })}
      />,
      <NumberField key="p" id="insp-p_kw" label="P" unit="kW" value={l.p_kw} error={messages(issues, "p_kw")} onChange={(v) => set({ p_kw: v })} />,
      <div key="mode" role="radiogroup" aria-label="Reactive power given as" className={styles.mode}>
        <label>
          <input type="radio" name="insp-mode" checked={mode === "Q"} onChange={() => choose("Q")} /> Q
        </label>
        <label>
          <input type="radio" name="insp-mode" checked={mode === "PF"} onChange={() => choose("PF")} /> PF
        </label>
      </div>,
      mode === "Q" ? (
        <NumberField key="q" id="insp-q_kvar" label="Q" unit="kvar" value={l.q_kvar} error={messages(issues, "q_kvar")} onChange={(v) => set({ q_kvar: v })} />
      ) : (
        <NumberField
          key="pf"
          id="insp-power_factor"
          label="Power factor"
          unit="ratio"
          value={l.power_factor}
          error={messages(issues, "power_factor")}
          onChange={(v) => set({ power_factor: v })}
        />
      ),
      ...(mode === "PF"
        ? [
            <Choice
              key="dir"
              id="insp-pf_direction"
              label="PF direction"
              options={PF_DIRECTIONS}
              value={l.pf_direction}
              error={messages(issues, "pf_direction")}
              onChange={(v) => set({ pf_direction: v as Load["pf_direction"] })}
            />,
          ]
        : []),
    ];
  }

  // three forms side by side, not nested: the edit fields, the catalogue entry, the battery bank
  return (
    <>
      <form aria-label={`Edit ${entity} ${target.id}`} className={styles.form} onSubmit={(e) => e.preventDefault()}>
        {body}
        {general.length > 0 && (
          <ul aria-label="Issues of this element" className={styles.general}>
            {general.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        )}
        {refused && <Toast inline message={refused} onDismiss={() => setRefused(null)} />}
      </form>
      {(target.kind === "line" || target.kind === "inverter") && (
        <CatalogPick collection={collection as "lines" | "inverters"} element={target.id} heading="h3" />
      )}
      {target.kind === "inverter" && <BankPick inverter={target.id} />}
      <p className={styles.delete}>
        <button type="button" onClick={() => remove(target.id, target.id)}>
          Delete {target.id}
        </button>
      </p>
      {dialog}
    </>
  );
}

/** The design limits (S-06) in the inspector column. */
export function LimitsForm() {
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const c = design.design_constraints ?? {};
  const issues = (useValidation(design)?.issues ?? []).filter((i) => i.entity === "DesignConstraints");
  return (
    <form aria-label="Edit design limits" className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <p className={styles.hint}>Every limit starts empty. An empty limit is not evaluated and is never counted as satisfied.</p>
      {CONSTRAINT_FIELDS.map(([k, label, unit]) => (
        <NumberField
          key={k}
          id={`lim-${k}`}
          label={label}
          unit={unit}
          value={c[k]}
          error={messages(issues, k)}
          note={c[k] == null ? <span data-testid={`not-evaluated-${k}`}>not evaluated</span> : undefined}
          onChange={(v) => dispatch({ type: "constraintSet", field: k, value: v })}
        />
      ))}
    </form>
  );
}
