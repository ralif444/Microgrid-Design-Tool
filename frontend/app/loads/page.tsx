"use client";
// S-03 Loads (Doc 7 §6.1): Load table with Q or power factor per row (FR-03), inline stage-1
// messages from /api/projects/validate (FR-17, FR-18). Buses are edited on S-05 (D-46 K8).
// LoadProfile (FR-04): the 24-hour table below the loads (audit O-2).
import Link from "next/link";
import { useState } from "react";
import type { Load, ProjectSnapshot, ValidationIssue } from "../../api-types";
import { ExampleGuide, ExampleNext } from "../../components/ExampleForm";
import { CANNOT_UNDO, useConfirmDelete } from "../../components/ConfirmDelete";
import { CellInput, CellSelect, DataTable, type DataColumn } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { useLanguage } from "../../components/Language";
import { RequireProject } from "../../components/RequireProject";
import { loadMode, modePatch, PF_DIRECTIONS, issueWhere, Q_SIGN_NOTE, type LoadMode } from "../../components/elementFields";
import { useValidation } from "../../components/useValidation";
import { useProject, useProjectDispatch } from "../../store";
import styles from "./loads.module.css";

type HourValue = NonNullable<NonNullable<ProjectSnapshot["load_profile"]>["values"]>[number];
// O-2: the one LoadProfile (Doc 3 §3.5), 24 hourly values of system active power; the server checks it.
function ProfileEditor({ issues, confirm }: { issues: ValidationIssue[]; confirm: (title: string, body: string, ok: () => void) => void }) {
  const { t } = useLanguage();
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const lp = design.load_profile;
  const setP = (hour: number | null | undefined, p_kw: number | null) =>
    lp && dispatch({ type: "profileSet", profile: { ...lp, values: (lp.values ?? []).map((v) => (v.hour === hour ? { ...v, p_kw } : v)) } });
  const columns: DataColumn<HourValue>[] = [
    { key: "hour", header: "Hour", unit: "h", numeric: true, cell: (v) => String(v.hour) },
    { key: "p_kw", header: "P", unit: "kW", numeric: true, fields: ["values.p_kw"], edit: { kind: "number", value: (v) => v.p_kw, onChange: (v, p) => setP(v.hour, p) } },
  ];
  return (
    <section aria-labelledby="profile-h" id="profile">
      <div className={styles.toolbar}>
        <h2 id="profile-h">{t("Daily load profile")}</h2>
        {lp ? (
          <button
            type="button"
            onClick={() => confirm(t("Remove the load profile?"), `${t("The 24 hourly values are removed from the design.")} ${t(CANNOT_UNDO)}`, () => dispatch({ type: "profileSet", profile: null }))}
          >
            {t("Remove profile")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: "profileSet", profile: { id: "LP1", values: Array.from({ length: 24 }, (_, hour) => ({ hour, p_kw: null })) } })}
          >
            {t("+ Add a 24-hour profile")}
          </button>
        )}
      </div>
      <p className={styles.note}>
        {t("System active power for each hour of a day. Storage advice, the hour sweep and Battery use it; power flow uses the Load table above.")}
      </p>
      {lp && <DataTable label={t("Load profile")} columns={columns} rows={lp.values ?? []} rowKey={(v, k) => v.hour ?? k} rowName={(v) => t("hour {hour}", { hour: v.hour ?? "" })} />}
      {issues.length > 0 && (
        <div className="problems">
          <Icon name="list" size={20} />
          <ul aria-label={t("Load profile problems")}>
            {/* one line per message: an empty new profile would otherwise list the same message 24 times */}
            {[...Map.groupBy(issues, (i) => i.message)].map(([m, all]) => (
              <li key={m}>
                {m}
                {all.length > 1 && ` (${t("{count} hourly values", { count: all.length })})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}


function Loads() {
  const { t } = useLanguage();
  const { dialog, confirm } = useConfirmDelete();
  const { design } = useProject();
  const dispatch = useProjectDispatch();
  const issues = useValidation(design, "PS")?.issues ?? [];
  const loads = design.loads ?? [];
  const buses: [string, string][] = (design.buses ?? []).map((b) => [b.id ?? "", b.id ?? ""]);
  // Q or PF per row is a screen choice, not data: both empty would otherwise read as Q.
  const [modes, setModes] = useState<Record<string, LoadMode>>({});
  const modeOf = (l: Load) => loadMode(l, modes[l.id ?? ""]);
  const set = (l: Load, patch: Partial<Load>) => dispatch({ type: "rowUpdated", collection: "loads", id: l.id ?? "", patch });
  const choose = (l: Load, m: LoadMode) => {
    setModes({ ...modes, [l.id ?? ""]: m });
    set(l, modePatch(m));
  };
  const rowIssues = (l: Load) => issues.filter((i) => i.entity === "Load" && i.id === l.id);
  const bad = (l: Load, f: string) => rowIssues(l).some((i) => i.field === f);

  const columns: DataColumn<Load>[] = [
    { key: "id", header: "Id", cell: (l) => <span className={styles.id}>{l.id}</span> },
    {
      key: "bus_id",
      header: "Bus",
      cell: (l) => <CellSelect label={t("Bus of {id}", { id: l.id ?? "" })} options={buses} value={l.bus_id} onChange={(v) => set(l, { bus_id: v })} invalid={bad(l, "bus_id")} />,
    },
    {
      key: "p_kw",
      header: "P",
      unit: "kW",
      numeric: true,
      cell: (l) => <CellInput label={t("P of {id} (kW)", { id: l.id ?? "" })} kind="number" value={l.p_kw} onChange={(v: number | null) => set(l, { p_kw: v })} invalid={bad(l, "p_kw")} />,
    },
    {
      key: "mode",
      header: "Reactive power as",
      fields: [],
      cell: (l) => (
        // a radiogroup instead of fieldset + legend: the legend box shifts the radios in a table cell
        <div role="radiogroup" aria-label={t("Reactive power of {id} given as", { id: l.id ?? "" })} className={styles.mode}>
          <label>
            <input type="radio" name={`mode-${l.id}`} checked={modeOf(l) === "Q"} onChange={() => choose(l, "Q")} /> Q
          </label>
          <label>
            <input type="radio" name={`mode-${l.id}`} checked={modeOf(l) === "PF"} onChange={() => choose(l, "PF")} /> PF
          </label>
        </div>
      ),
    },
    // D-14: one quantity and one unit per column; the column the mode does not use stays empty
    {
      key: "q_kvar",
      header: "Q",
      unit: "kvar",
      numeric: true,
      cell: (l) =>
        modeOf(l) === "Q" ? (
          <CellInput label={t("Q of {id} (kvar)", { id: l.id ?? "" })} kind="number" value={l.q_kvar} onChange={(v: number | null) => set(l, { q_kvar: v })} invalid={bad(l, "q_kvar")} />
        ) : null,
    },
    {
      key: "power_factor",
      header: "Power factor",
      unit: "ratio",
      numeric: true,
      cell: (l) =>
        modeOf(l) === "PF" ? (
          <CellInput
            label={t("Power factor of {id} (ratio)", { id: l.id ?? "" })}
            kind="number"
            value={l.power_factor}
            onChange={(v: number | null) => set(l, { power_factor: v })}
            invalid={bad(l, "power_factor")}
          />
        ) : null,
    },
    {
      key: "pf_direction",
      header: "PF direction",
      cell: (l) =>
        modeOf(l) === "PF" ? (
          <CellSelect
            label={t("PF direction of {id}", { id: l.id ?? "" })}
            options={PF_DIRECTIONS}
            value={l.pf_direction}
            onChange={(v) => set(l, { pf_direction: v as Load["pf_direction"] })}
            invalid={bad(l, "pf_direction")}
          />
        ) : null,
    },
  ];

  const other = issues.filter((i) => i.entity !== "Load" && i.entity !== "LoadProfile");
  return (
    <>
      <h1>{t("Loads")}</h1>
      <ExampleGuide screen="loads" runnable={false} />
      {(design.buses?.length ?? 0) === 0 && (
        <EmptyState title={t("No buses yet.")} icon="link" action={<Link href="/network/">{t("Add buses in the network editor")}</Link>}>
          {t("Loads are placed on buses.")}
        </EmptyState>
      )}
      <div className={styles.toolbar}>
        <h2>{t("Load table")}</h2>
        <button
          type="button"
          onClick={() => dispatch({ type: "rowAdded", collection: "loads", row: { bus_id: design.buses?.[0]?.id ?? null, p_kw: null, q_kvar: null } })}
        >
          {t("+ Add load")}
        </button>
      </div>
      {(loads.length > 0 || (design.buses?.length ?? 0) > 0) && (
        <DataTable
          label={t("Loads")}
          columns={columns}
          rows={loads}
          rowKey={(l) => l.id ?? ""}
          rowName={(l) => l.id ?? ""}
          rowTestId={(l) => `load-${l.id}`}
          rowErrors={(l) => rowIssues(l).map((i) => ({ field: i.field, message: i.message }))}
          actions={(l) => (
            <button
              type="button"
              onClick={() => confirm(t("Delete {id}?", { id: l.id ?? "" }), `${t("Load {id} is removed from the design.", { id: l.id ?? "" })} ${t(CANNOT_UNDO)}`, () => dispatch({ type: "rowRemoved", collection: "loads", id: l.id ?? "" }))}
            >
              {t("Delete {id}", { id: l.id ?? "" })}
            </button>
          )}
          empty={<EmptyState title={t("No loads yet.")}>{t("Add the first load.")}</EmptyState>}
        />
      )}
      <p className={styles.note}>{t(Q_SIGN_NOTE)}</p>
      <ProfileEditor issues={issues.filter((i) => i.entity === "LoadProfile")} confirm={confirm} />
      {other.length > 0 && (
        <div className="problems">
          <Icon name="list" size={20} />
          <ul aria-label={t("Other problems")}>
            {other.map((i, k) => (
              <li key={k}>
                {issueWhere(i)}: {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.next}>
        <Link href="/sizing/">{t("Go to sizing advice")}</Link>
        {loads.length === 0 && ` ${t("Needs at least one load.")}`}
      </p>
      <ExampleNext screen="loads" ready={true} />
      {dialog}
    </>
  );
}

export default function LoadsPage() {
  return (
    <RequireProject>
      <Loads />
    </RequireProject>
  );
}
