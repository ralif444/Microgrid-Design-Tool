"use client";
// S-04 Sizing advice (Doc 7 §6.2): six PS parameters without defaults (Doc 3 §6.1), advice in an
// advisory panel (P4), Accept or Skip (FR-08; Edit deferred, Doc 9 D-45 K5), stale notice.
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AnalysisResponse, PsPayload } from "../../api-types";
import { moduleHint } from "../../components/battery";
import { catalogHints, useCatalog } from "../../components/Catalog";
import { ExampleGuide, ExampleNext, nextReady, useExampleForm } from "../../components/ExampleForm";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import { SOLVER, useAnalysisCall } from "../../components/useAnalysisCall";
import {
  adviceInputHash,
  useProject,
  useProjectDispatch,
  type PsParameters,
  type SizingAdvice,
} from "../../store";


const EMPTY: PsParameters = {
  inverter_margin_ratio: null,
  unit_count: null,
  redundancy: null,
  autonomy_h: null,
  dc_efficiency_ratio: null,
  depth_of_discharge_ratio: null,
};

const FIELDS: [keyof PsParameters, string, string, string][] = [
  ["inverter_margin_ratio", "Inverter margin m_inv", "ratio", "any"],
  ["unit_count", "Number of inverter units n", "count", "1"],
  ["redundancy", "Redundancy r (0 or 1)", "count", "1"],
  ["autonomy_h", "Storage autonomy t_aut, optional", "h", "1"],
  ["dc_efficiency_ratio", "DC efficiency η_dc, optional", "ratio", "any"],
  ["depth_of_discharge_ratio", "Depth of discharge DoD, optional", "ratio", "any"],
];

function AdvicePanel({ a }: { a: SizingAdvice }) {
  const p = a.result;
  const plan = p.inverter_plan;
  return (
    <section className="advice" aria-label="Sizing advice">
      <p className="advice-tag">Advice (not design data)</p>
      <table aria-label="Advice values">
        <tbody>
          <tr>
            <th scope="row">Load apparent power</th>
            <td>{p.load_apparent_kva} kVA</td>
            <td />
          </tr>
          <tr>
            <th scope="row">Total inverter rating</th>
            <td>{p.required_inverter_kva.value_kva} kVA</td>
            <td>
              {p.required_inverter_kva.basis} {p.required_inverter_kva.assumptions.join(" ")}
            </td>
          </tr>
          <tr>
            <th scope="row">Inverters</th>
            <td>
              {plan.unit_count} × {plan.unit_rating_kva} kVA (installed {plan.installed_kva} kVA, redundancy {plan.redundancy})
            </td>
            <td>
              {plan.basis} {plan.assumptions.join(" ")}
            </td>
          </tr>
          <tr>
            <th scope="row">Storage energy</th>
            {p.storage_energy ? (
              <>
                <td>
                  AC {p.storage_energy.e_ac_kwh} kWh, DC {p.storage_energy.e_dc_kwh ?? "—"} kWh, nominal{" "}
                  {p.storage_energy.e_nom_kwh ?? "—"} kWh (stage {p.storage_energy.stage})
                </td>
                <td>
                  {p.storage_energy.basis} {p.storage_energy.assumptions.join(" ")}
                </td>
              </>
            ) : (
              <td colSpan={2}>Storage advice needs a LoadProfile and an autonomy time.</td>
            )}
          </tr>
        </tbody>
      </table>
      <p data-testid="advice-state">State: {a.state}</p>
      <CatalogHints unitKva={plan.unit_rating_kva} />
      <ModuleHint eNomKwh={p.storage_energy?.e_nom_kwh ?? null} />
    </section>
  );
}

// FR-09: accepted advice offers editable Inverter drafts (unit_count rows at the unit rating) for
// S-05; Accept itself changes no design entity (FR-08).
function InverterDrafts({ plan }: { plan: PsPayload["inverter_plan"] }) {
  const dispatch = useProjectDispatch();
  const [added, setAdded] = useState(false);
  if (added)
    return (
      <p role="status">
        {plan.unit_count} inverter drafts added. <Link href="/network/">Complete them in Network</Link>
      </p>
    );
  return (
    <p>
      <button
        type="button"
        onClick={() => {
          for (let k = 0; k < plan.unit_count; k++)
            dispatch({ type: "rowAdded", collection: "inverters", row: { rated_kva: plan.unit_rating_kva } });
          setAdded(true);
        }}
      >
        Add {plan.unit_count} inverter drafts of {plan.unit_rating_kva} kVA
      </button>
    </p>
  );
}

// Doc 12 FR-72: a hint only; the advice values above are never changed or rounded.
function CatalogHints({ unitKva }: { unitKva: number }) {
  const { catalog, checks } = useCatalog();
  const fits = catalogHints(catalog.entries, unitKva, checks);
  return (
    <section aria-label="Catalogue hints">
      <p>
        Usable catalogue inverter entries rated at least {unitKva} kVA (hint only):{" "}
        {fits.length === 0 ? "none" : fits.map((e) => `${e.id} (${e.inverter?.rated_kva} kVA)`).join(", ")}
      </p>
    </section>
  );
}

// Doc 12 FR-74 (Eq. 12.3 – 12.5, D-107): per chosen module entry and inverter DC window; a hint
// computed here and never stored, the advice values above are unchanged. Shown only when the
// Catalogue holds a usable battery module.
function ModuleHint({ eNomKwh }: { eNomKwh: number | null }) {
  const { catalog, checks } = useCatalog();
  const [modId, setModId] = useState("");
  const [invId, setInvId] = useState("");
  const [ns, setNs] = useState<number | null>(null);
  const usable = (id: string) => checks.some((c) => c.entry_id === id && c.usable);
  const modules = catalog.entries.filter((e) => e.kind === "BATTERY_MODULE" && usable(e.id));
  const inverters = catalog.entries.filter((e) => e.kind === "INVERTER");
  if (modules.length === 0) return null;
  const mod = modules.find((e) => e.id === modId) ?? modules[0];
  const inv = inverters.find((e) => e.id === invId)?.inverter;
  const h = moduleHint(eNomKwh, mod.battery_module ?? {}, { min: inv?.dc_voltage_min_v, max: inv?.dc_voltage_max_v }, ns);
  const kwh = (v: number) => `${Number(v.toFixed(4))} kWh`;
  return (
    <section aria-label="Battery module hint">
      <p>Battery module hint (hint only; the advice values above do not change):</p>
      <p>
        <label htmlFor="hint-module">Module entry</label>{" "}
        <select id="hint-module" value={mod.id} onChange={(x) => setModId(x.target.value)}>
          {modules.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} ({e.battery_module?.energy_kwh} kWh)
            </option>
          ))}
        </select>{" "}
        <label htmlFor="hint-inverter">DC window from inverter entry</label>{" "}
        <select id="hint-inverter" value={invId} onChange={(x) => setInvId(x.target.value)}>
          <option value="">(none)</option>
          {inverters.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id} ({e.inverter?.dc_voltage_min_v ?? "—"}–{e.inverter?.dc_voltage_max_v ?? "—"} V)
            </option>
          ))}
        </select>
      </p>
      {h.verdict === "not evaluated" ? (
        <p data-testid="module-hint">Not evaluated: {h.reason}.</p>
      ) : (
        <p data-testid="module-hint">
          Verdict: {h.verdict}
          {h.verdict === "unknown" && " (DC window or module voltage limits missing)"}. Modules needed {h.moduleCount}
          {h.verdict === "fit" && (
            <>
              ; admissible series counts {h.series[0]}–{h.series.at(-1)};{" "}
              <label htmlFor="hint-ns">series count</label>{" "}
              <select id="hint-ns" value={h.ns ?? ""} onChange={(x) => setNs(Number(x.target.value))}>
                {h.series.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>{" "}
              × {h.np} in parallel = {h.installedCount} modules, installed {kwh(h.installedKwh!)}, extra {kwh(h.extraKwh!)}
            </>
          )}
          .
        </p>
      )}
    </section>
  );
}

function Sizing() {
  const { design, sizingAdvice } = useProject();
  const dispatch = useProjectDispatch();
  // Last advice first, then the guided example (Doc 12 X9, D-92 K230), else empty.
  const ex = useExampleForm<PsParameters>("sizing", sizingAdvice.at(-1)?.ps_parameters ?? EMPTY);
  const ps = ex.values;
  const { busy, error, call } = useAnalysisCall();
  const [resp, setResp] = useState<AnalysisResponse | null>(null);
  const [stale, setStale] = useState(false);
  const latest = sizingAdvice.at(-1);
  const hasLoad = (design.loads?.length ?? 0) > 0;

  useEffect(() => {
    // Stale when Loads, LoadProfile or the PS settings differ from the advice input (FR-08).
    if (latest) void adviceInputHash(design, ps).then((h) => setStale(h !== latest.input_hash));
  }, [design, ps, latest]);

  async function run() {
    // Optional parameters are sent only when entered; required ones are sent as entered so
    // stage 1 can name what is missing (PS_PARAMETER_INVALID).
    const parameters = Object.fromEntries(Object.entries(ps).filter(([, v]) => v !== null));
    const data = await call("PS", { project_snapshot: design, parameters, solver_config: SOLVER }); // PS ignores the solver settings
    if (!data) return;
    setResp(data);
    dispatch({ type: "runRecordAdded", record: data.run_record });
    if (data.result.status === "FEASIBLE") {
      dispatch({
        type: "adviceAdded",
        advice: {
          id: data.run_record.record_id,
          created_at: data.run_record.created_at,
          input_hash: await adviceInputHash(design, ps),
          ps_parameters: ps,
          state: "PROPOSED",
          result: data.result.payload as unknown as PsPayload,
        },
      });
    }
  }

  const warnings = resp?.result.warnings?.filter((w) => w.code === "PROFILE_PEAK_ABOVE_LOADS") ?? [];
  return (
    <>
      <h1>Sizing advice (PS)</h1>
      <ExampleGuide screen="sizing" />
      <form
        aria-label="Sizing advice settings"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {FIELDS.map(([k, label, unit, step]) => (
          <p key={k}>
            <NumberField
              id={k}
              label={label}
              unit={unit}
              step={step}
              value={ps[k]}
              onChange={(v) => ex.set(k, v)}
              adornment={ex.tag(k, label)}
              note={ex.note(k)}
            />
          </p>
        ))}
        {ex.resetButton}{ex.resetButton && " "}
        <button type="submit" disabled={busy || !hasLoad}>
          {busy ? "Running..." : latest ? "Re-run advice" : "Run advice"}
        </button>
        {!hasLoad && (
          <span>
            {" "}
            Add at least one load first. <Link href="/loads/">Go to Loads</Link>
          </span>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {resp && <StatusBanner type="PS" result={resp.result} />}
      {warnings.map((w, k) => (
        <p key={k} role="alert">
          {w.message}
        </p>
      ))}
      {!latest ? (
        <p>No advice yet.</p>
      ) : (
        <>
          {stale && (
            <p role="alert" data-testid="advice-stale">
              The loads or settings changed after this advice was made. Run the advice again.
            </p>
          )}
          <AdvicePanel a={latest} />
          {latest.state === "PROPOSED" && (
            <p>
              <button type="button" onClick={() => dispatch({ type: "adviceDecided", id: latest.id, state: "ACCEPTED" })}>
                Accept
              </button>{" "}
              <button type="button" onClick={() => dispatch({ type: "adviceDecided", id: latest.id, state: "SKIPPED" })}>
                Skip
              </button>
            </p>
          )}
          {latest.state === "ACCEPTED" && <InverterDrafts plan={latest.result.inverter_plan} />}
        </>
      )}
      <ExampleNext screen="sizing" ready={nextReady(resp?.result.status)} />
    </>
  );
}

export default function SizingPage() {
  return (
    <RequireProject>
      <Sizing />
    </RequireProject>
  );
}
