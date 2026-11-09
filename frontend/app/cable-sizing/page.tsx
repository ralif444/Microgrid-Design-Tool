"use client";
// S-19 Cable and breaker sizing (experimental, Doc 12 X10 FR-105, FR-112; Doc 7 §2.4; guideline §6;
// Doc 9 D-103): hidden unless /api/meta reports the flag; settings panel (Project defaults, held in
// the session), table file picker, Run gated on a current M2, status banner, the fixed caveat above
// the results table, rows that expand to the factors with their table and page. Advice only.
import { useState } from "react";
import { runAnalysis } from "../../api-client";
import { EmptyState } from "../../components/EmptyState";
import { SOLVER } from "../../components/Further";
import { Icon } from "../../components/Icon";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { Toggletip } from "../../components/Term";
import { Toast } from "../../components/Toast";
import { useValidation } from "../../components/useValidation";
import {
  arrangements,
  CONDUCTORS,
  CONSTRUCTIONS,
  factorSources,
  INSULATIONS,
  m2Ref,
  METHODS,
  OUTCOME,
  settingsBody,
  useCableSizingFlag,
  useCbSession,
  type CbElement,
  type CbPayload,
  type CbSettings,
} from "../../components/cable";
import { fmt } from "../../components/Further";
import { useProject } from "../../store";
import further from "../../components/Further.module.css";
import table from "../../components/DataTable.module.css";
import styles from "./cable-sizing.module.css";

const METHOD_ID = "IEC60364_OVERLOAD_PUIL2011";

// Glossary toggletips (FR-91 language rule: Indonesian); kept here so S-17 and the other screens
// show nothing of X10 while the flag is off (FR-105).
const TERMS = {
  iz: { term: "KHA (I_Z)", short: "Kemampuan hantar arus kontinu kabel (A): I_Z = I_tab · k_θ · k_ρ · k_g.", source: "Pedoman kabel §3.1, §3.2 (PUIL 2011 Ayat 433.1; Pers. CB.3)" },
  ib: { term: "I_B", short: "Arus desain elemen (A): untuk saluran arus perlu dari M2, untuk feeder inverter arus pengenal S_r/(√3 V_n).", source: "Pedoman kabel §3.1, D1, D2 (PUIL 2011 Ayat 433.1)" },
  in: { term: "I_n", short: "Arus pengenal gawai proteksi (A): nilai terkecil dalam deret arus pengenal yang ≥ I_B; syarat I_B ≤ I_n ≤ I_Z.", source: "Pedoman kabel §3.1, §3.3 (PUIL 2011 Ayat 433.1; Pers. CB.1)" },
  i2: { term: "I_2", short: "Arus operasi konvensional gawai (A): I_2 = k_2 · I_n; syarat I_2 ≤ 1,45 · I_Z.", source: "Pedoman kabel §3.1, D7 (PUIL 2011 Ayat 433.1; Pers. CB.2)" },
  kt: { term: "k_θ", short: "Faktor koreksi suhu sekitar: udara (acuan 30 °C) atau tanah untuk metode D (acuan 20 °C).", source: "Pedoman kabel §3.2 (PUIL 2011 Tabel A.52-14, A.52-15)" },
  kr: { term: "k_ρ", short: "Faktor koreksi resistivitas termal tanah, hanya untuk metode D; bernilai 1 untuk metode lain.", source: "Pedoman kabel §3.2 (PUIL 2011 Tabel A.52-16)" },
  kg: { term: "k_g", short: "Faktor koreksi pengelompokan sirkit atau kabel multicore.", source: "Pedoman kabel §3.2 (PUIL 2011 Tabel A.52-17, A.52-19)" },
} as const;

function Tip({ k }: { k: keyof typeof TERMS }) {
  const e = TERMS[k];
  return (
    <Toggletip label={`Glossary: ${e.term}`} lang="id">
      <strong>{e.term}</strong> {e.short} <span>Sumber: {e.source}</span>
    </Toggletip>
  );
}

function Select({ id, label, value, options, onChange }: { id: string; label: string; value: string | null; options: [string, string][]; onChange: (v: string | null) => void }) {
  return (
    <p>
      <label htmlFor={id}>{label}</label>{" "}
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">(choose)</option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </p>
  );
}

const Check = ({ ok }: { ok: boolean | undefined }) =>
  ok === undefined ? (
    <>—</>
  ) : (
    <span className={styles.tag} data-role={ok ? "success" : "negative"}>
      <Icon name={ok ? "check" : "cross"} />
      {ok ? "Met" : "Not met"}
    </span>
  );

function Row({ e, open, toggle, tables, construction }: { e: CbElement; open: boolean; toggle: () => void; tables: unknown; construction: string | null }) {
  const o = OUTCOME[e.outcome];
  const c = e.cable;
  const src = c ? factorSources(tables, c, construction) : null;
  const id = `cb-factors-${e.element_id}`;
  return (
    <tbody className={table.row} data-testid={`cb-row-${e.element_id}`}>
      <tr>
        <td>
          <button type="button" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`Factors of ${e.element_id}`} onClick={toggle}>
            {open ? "▾" : "▸"}
          </button>{" "}
          {e.element_id}
        </td>
        <td className={styles.th}>{e.element_kind === "LINE" ? "Line" : "Inverter feeder"}</td>
        <td className="num">{fmt(e.ib_a)}</td>
        <td>{e.device.class}</td>
        <td className="num">{fmt(e.device.in_a)}</td>
        <td className="num">{fmt(c?.size_mm2)}</td>
        <td className="num">{fmt(c?.iz_a)}</td>
        <td>
          <Check ok={e.checks?.cond1_ok} />
        </td>
        <td>
          <Check ok={e.checks?.cond2_ok} />
        </td>
        <td>
          <span className={styles.tag} data-role={o.role}>
            <Icon name={o.icon} />
            {o.word}
          </span>
        </td>
        <td>
          {e.r_check?.flagged ? (
            <span className={styles.tag} data-role="caution">
              <Icon name="warn" />R differs
            </span>
          ) : e.r_check ? (
            "Within 10 %"
          ) : (
            "—"
          )}
        </td>
      </tr>
      {open && (
        <tr className={styles.factors} id={id} data-testid={id}>
          <td colSpan={11}>
            <dl>
              <dt>I_B source</dt>
              <dd>{e.ib_source === "inverter_rated_current" ? "Inverter rated current S_r / (√3 V_n)" : "M2 required line current"}</dd>
              <dt>Device</dt>
              <dd>
                {e.device.class}, {e.device.standard}; k_2 = {fmt(e.device.k2)} ({e.device.k2_source}); I_2 = {fmt(e.device.i2_a)} A
              </dd>
              {c && src && (
                <>
                  <dt>I_tab</dt>
                  <dd>
                    {fmt(c.i_tab_a)} A ({c.conductor}, {c.insulation}, method {c.method}, {fmt(c.size_mm2)} mm²); source {src.i_tab}
                  </dd>
                  <dt>k_θ</dt>
                  <dd>
                    {fmt(c.k_theta)} at {fmt(c.lookup_values.temp_c_used)} °C; source {src.k_theta}
                  </dd>
                  <dt>k_ρ</dt>
                  <dd>
                    {fmt(c.k_rho)}
                    {c.lookup_values.rho_used !== null ? ` at ${fmt(c.lookup_values.rho_used)} K·m/W` : ""}; source {src.k_rho}
                  </dd>
                  <dt>k_g</dt>
                  <dd>
                    {fmt(c.k_g)} for {c.lookup_values.group_used} circuit(s); source {src.k_g}
                  </dd>
                </>
              )}
              {e.checks && (
                <>
                  <dt>Margins</dt>
                  <dd>
                    I_n − I_B = {fmt(e.checks.margin_in_ib_a)} A; I_Z − I_n = {fmt(e.checks.margin_iz_in_a)} A; 1.45 I_Z − I_2 = {fmt(e.checks.margin_145iz_i2_a)} A
                  </dd>
                </>
              )}
              {e.r_check && (
                <>
                  <dt>R check</dt>
                  <dd>
                    entered {fmt(e.r_check.r_line_ohm_per_km)} Ω/km, cable {fmt(e.r_check.r_cable_ohm_per_km)} Ω/km at {fmt(e.r_check.temp_c)} °C, deviation{" "}
                    {fmt(e.r_check.deviation_ratio * 100)} %
                  </dd>
                </>
              )}
              <dt>Catalogue match</dt>
              <dd>Not checked yet: the Catalogue kind BREAKER and the cable match come in a later step (FR-115).</dd>
              {e.notes.length > 0 && (
                <>
                  <dt>Notes</dt>
                  <dd>{e.notes.join(" ")}</dd>
                </>
              )}
            </dl>
          </td>
        </tr>
      )}
    </tbody>
  );
}

function CableSizing() {
  const { design, runRecords } = useProject();
  const report = useValidation(design);
  const current = report?.snapshot_hash ?? null;
  const ref = m2Ref(runRecords, current);
  const lastM2 = runRecords.findLast((r) => r.analysis_type === "M2");
  const [s, update] = useCbSession();
  const set = (patch: Partial<CbSettings>) => update({ settings: { ...s.settings, ...patch } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const rec = s.record && current !== null && s.record.snapshot_hash === current ? s.record : null;
  const r = rec?.result;
  const p = r?.status === "FEASIBLE" ? (r.payload as unknown as CbPayload) : null;
  const sentTables = (rec?.parameters as { tables?: unknown } | undefined)?.tables;
  const sentConstruction = ((rec?.parameters as { settings?: { cable_construction?: string } } | undefined)?.settings?.cable_construction) ?? null;
  const tablesInfo = s.tables as { table_set_id?: string; source?: { document?: string } } | null;
  const fake = /FAKE|FICTITIOUS/i.test(`${tablesInfo?.table_set_id ?? ""} ${tablesInfo?.source?.document ?? ""}`);

  async function load(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      update({ tables: JSON.parse(await file.text()) as unknown, tablesName: file.name });
    } catch {
      update({ tables: null, tablesName: null });
      setError(`${file.name} is not a JSON file.`);
    }
  }

  async function run() {
    if (!ref || s.tables === null) return;
    setError(null);
    setBusy(true);
    const out = await runAnalysis("CB", {
      project_snapshot: design,
      solver_config: SOLVER,
      depends_on: ref,
      parameters: { method_id: METHOD_ID, settings: settingsBody(s.settings), tables: s.tables },
    });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setOpen(new Set());
    update({ record: out.data.run_record });
  }

  const gate = !ref
    ? lastM2 && current !== null && lastM2.snapshot_hash !== current
      ? "The constraint check (M2) result is out of date because the design changed. Re-run M1 and M2 first."
      : "Run the constraint check (M2) first."
    : s.tables === null
      ? "Load a table file first."
      : null;
  const st = s.settings;
  return (
    <>
      <div className={further.head}>
        <h1>Cable and breaker sizing</h1>
      </div>
      <p data-testid="cb-experimental" className={styles.experimental}>
        <strong>Experimental.</strong> Advice on the overload rating of the breaker and the conductor size only, awaiting the supervisor&apos;s approval.
        Nothing is written back into the design.
      </p>
      <form
        aria-label="Cable sizing settings"
        className={further.form}
        onSubmit={(ev) => {
          ev.preventDefault();
          void run();
        }}
      >
        <p className={styles.file}>
          <label htmlFor="cb-tables">Load table file (JSON)</label>
          <input id="cb-tables" type="file" accept=".json,application/json" onChange={(ev) => void load(ev.target.files?.[0])} />
        </p>
        <p data-testid="table-file" className={further.source}>
          {tablesInfo ? (
            <>
              Table file {s.tablesName}: set <code>{tablesInfo.table_set_id ?? "unnamed"}</code>
              {tablesInfo.source?.document ? `, ${tablesInfo.source.document}` : ""}.{" "}
              {fake && <span className={styles.fake}>FAKE test table: the results are not real sizing advice.</span>} Held in this session only; it is
              not saved in the Project file.
            </>
          ) : (
            "No table file loaded. The app ships no standard tables: load the file you transcribed (cable_tables.json)."
          )}
        </p>
        <Select id="cb-method" label="Method" value={st.method} options={METHODS} onChange={(v) => set({ method: v, grouping_arrangement: null })} />
        <Select id="cb-conductor" label="Conductor" value={st.conductor} options={CONDUCTORS} onChange={(v) => set({ conductor: v })} />
        <Select id="cb-insulation" label="Insulation" value={st.insulation} options={INSULATIONS} onChange={(v) => set({ insulation: v })} />
        <p>
          <NumberField id="cb-ambient" label="Ambient temperature" unit="°C" value={st.ambient_temp_c} onChange={(v) => set({ ambient_temp_c: v })} />
        </p>
        {st.method === "D_DUCT" && (
          <p>
            <NumberField id="cb-rho" label="Soil thermal resistivity" unit="K·m/W" value={st.soil_resistivity_k_m_per_w} onChange={(v) => set({ soil_resistivity_k_m_per_w: v })} />
          </p>
        )}
        <p>
          <NumberField id="cb-group" label="Grouping count" unit="count" step="1" value={st.grouping_count} onChange={(v) => set({ grouping_count: v })} />
        </p>
        <Select id="cb-arrangement" label="Grouping arrangement" value={st.grouping_arrangement} options={arrangements(st.method)} onChange={(v) => set({ grouping_arrangement: v })} />
        <Select id="cb-construction" label="Cable construction" value={st.cable_construction} options={CONSTRUCTIONS} onChange={(v) => set({ cable_construction: v })} />
        <p className={further.source}>These settings apply to every Line and Inverter feeder. Loaded conductors are always 3. Per-element overrides come later.</p>
        {gate && (
          <p data-testid="cable-m2-gate">
            <Icon name={ref ? "info" : "link"} /> {gate}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy || gate !== null} aria-busy={busy || undefined}>
          {busy ? "Running..." : "Run cable sizing"}
        </button>
      </form>
      {error && <Toast message={error} onDismiss={() => setError(null)} />}
      {r && <StatusBanner type="CB" result={r} />}
      {p && rec && (
        <>
          <p data-testid="cable-caveat" className={styles.caveat}>
            <Icon name="warn" />
            {p.caveat_text}
          </p>
          <div className={`table-scroll ${table.scroll}`} role="region" aria-label="Cable and breaker sizing results, scrolls sideways" tabIndex={0}>
            <table aria-label="Cable and breaker sizing results" className={table.table}>
              <caption>
                Method {p.method_id}, table set {p.table_set_id} (SHA-256 <code>{p.table_set_hash.slice(0, 12)}…</code>)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Element</th>
                  <th scope="col">Kind</th>
                  <th scope="col" className="num">
                    <span className={styles.th}>I_B (A)</span> <Tip k="ib" />
                  </th>
                  <th scope="col">Device</th>
                  <th scope="col" className="num">
                    <span className={styles.th}>I_n (A)</span> <Tip k="in" />
                  </th>
                  <th scope="col" className="num">
                    Size (mm²)
                  </th>
                  <th scope="col" className="num">
                    <span className={styles.th}>I_Z (A)</span> <Tip k="iz" />
                  </th>
                  <th scope="col">I_B ≤ I_n ≤ I_Z</th>
                  <th scope="col">
                    <span className={styles.th}>I_2 ≤ 1.45 I_Z</span> <Tip k="i2" />
                  </th>
                  <th scope="col">Outcome</th>
                  <th scope="col">R check</th>
                </tr>
              </thead>
              {p.elements.map((e) => (
                  <Row
                    key={e.element_id}
                    e={e}
                    open={open.has(e.element_id)}
                    tables={sentTables}
                    construction={sentConstruction}
                    toggle={() =>
                      setOpen((o) => {
                        const n = new Set(o);
                        if (!n.delete(e.element_id)) n.add(e.element_id);
                        return n;
                      })
                    }
                  />
              ))}
            </table>
          </div>
          <p className={further.source}>
            Correction factors: k_θ <Tip k="kt" /> k_ρ <Tip k="kr" /> k_g <Tip k="kg" /> Open a row to see each factor with its table and page.
          </p>
          <p className={further.record}>
            RunRecord <code>{rec.record_id}</code>, computed by the app (no engine call). It is kept in this session only, because it carries the table file.
          </p>
        </>
      )}
      {!rec && <EmptyState title="Not run yet.">Load a table file, choose the settings and run the sizing after a current M2.</EmptyState>}
    </>
  );
}

export default function CableSizingPage() {
  const on = useCableSizingFlag();
  if (on === null) return null;
  if (!on)
    return (
      <p data-testid="cable-sizing-off" role="alert">
        This screen is not available.
      </p>
    );
  return (
    <RequireProject>
      <CableSizing />
    </RequireProject>
  );
}
