"use client";
// S-04 Sizing advice (Doc 7 §6.2): six PS parameters without defaults (Doc 3 §6.1), advice in an
// advisory panel (P4), Accept or Skip (FR-08; Edit deferred, Doc 9 D-45 K5), stale notice.
import Link from "next/link";
import { useEffect, useState } from "react";
import { runAnalysis } from "../../api-client";
import type { AnalysisResponse, PsPayload } from "../../api-types";
import { catalogHints, useCatalog } from "../../components/Catalog";
import { useExampleForm } from "../../components/ExampleForm";
import { NumberField } from "../../components/NumberField";
import { RequireProject } from "../../components/RequireProject";
import { StatusBanner } from "../../components/StatusBanner";
import {
  adviceInputHash,
  useProject,
  useProjectDispatch,
  type PsParameters,
  type SizingAdvice,
} from "../../store";

const SOLVER = { mismatch_tolerance_w: 0.001, max_iterations: 50, initial_guess: "DEFAULT" as const }; // ignored by PS

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

function Sizing() {
  const { design, sizingAdvice } = useProject();
  const dispatch = useProjectDispatch();
  // Last advice first, then the guided example (Doc 12 X9, D-92 K230), else empty.
  const ex = useExampleForm<PsParameters>("sizing", sizingAdvice.at(-1)?.ps_parameters ?? EMPTY);
  const ps = ex.values;
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const latest = sizingAdvice.at(-1);
  const hasLoad = (design.loads?.length ?? 0) > 0;

  useEffect(() => {
    // Stale when Loads, LoadProfile or the PS settings differ from the advice input (FR-08).
    if (latest) void adviceInputHash(design, ps).then((h) => setStale(h !== latest.input_hash));
  }, [design, ps, latest]);

  async function run() {
    setError(null);
    setBusy(true);
    // Optional parameters are sent only when entered; required ones are sent as entered so
    // stage 1 can name what is missing (PS_PARAMETER_INVALID).
    const parameters = Object.fromEntries(Object.entries(ps).filter(([, v]) => v !== null));
    const out = await runAnalysis("PS", { project_snapshot: design, parameters, solver_config: SOLVER });
    setBusy(false);
    if (!out.ok) {
      setError(out.message);
      return;
    }
    setResp(out.data);
    dispatch({ type: "runRecordAdded", record: out.data.run_record });
    if (out.data.result.status === "FEASIBLE") {
      dispatch({
        type: "adviceAdded",
        advice: {
          id: out.data.run_record.record_id,
          created_at: out.data.run_record.created_at,
          input_hash: await adviceInputHash(design, ps),
          ps_parameters: ps,
          state: "PROPOSED",
          result: out.data.result.payload as unknown as PsPayload,
        },
      });
    }
  }

  const warnings = resp?.result.warnings?.filter((w) => w.code === "PROFILE_PEAK_ABOVE_LOADS") ?? [];
  return (
    <>
      <h1>Sizing advice (PS)</h1>
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
