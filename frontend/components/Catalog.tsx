"use client";
// Catalogue state and helpers (Doc 12 §3.3; FR-64 - FR-72; D-61). The Catalogue lives beside the
// Project, not in it, and survives opening another Project. The selection guard is the server's
// (/api/catalogs/import), re-checked whenever the Catalogue changes.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { importCatalog } from "../api-client";
import type { Catalog, CatalogEntry, CatalogRef, EntryCheck } from "../api-types";

// "x10": used only by the X10 cable sizing match (D-104 K293, K296), shown only with the flag on
type Use = "model" | "text" | "A2" | "A4" | "x10";
export type EntryField = [key: string, label: string, unit: string | null, use: Use];

// FR-67, FR-68: fields not used by the model carry the A2 / A4 label.
export const ENTRY_FIELDS: Record<CatalogEntry["kind"], EntryField[]> = {
  INVERTER: [
    ["rated_kva", "Rating", "kVA", "model"],
    ["nominal_voltage_kv", "Nominal voltage, line-to-line", "kV", "model"],
    ["nominal_frequency_hz", "Nominal frequency", "Hz", "model"],
    ["frequency_droop_min_hz_per_kw", "P–f droop range, from", "Hz/kW", "model"],
    ["frequency_droop_max_hz_per_kw", "P–f droop range, to", "Hz/kW", "model"],
    ["voltage_droop_min_kv_per_kvar", "Q–V droop range, from", "kV/kvar", "model"],
    ["voltage_droop_max_kv_per_kvar", "Q–V droop range, to", "kV/kvar", "model"],
    ["tau_in_s", "Inner-loop time constant τ_in, optional", "s", "model"],
    ["overload_ratio", "Overload capability", "ratio", "A2"],
    ["current_limit_a", "Current limit", "A", "A2"],
    ["output_filter", "Output filter data", null, "A2"],
    ["efficiency_ratio", "Efficiency", "ratio", "A2"],
    ["dc_voltage_min_v", "DC input window, from", "V", "A2"],
    ["dc_voltage_max_v", "DC input window, to", "V", "A2"],
  ],
  CONDUCTOR: [
    ["r_ohm_per_km", "Resistance R", "Ω/km", "model"],
    ["x_ohm_per_km", "Reactance X", "Ω/km", "model"],
    ["rx_conditions", "Conditions of R and X", null, "text"],
    ["ampacity_a", "Current-carrying capacity", "A", "model"],
    ["ampacity_conditions", "Reference installation conditions", null, "text"],
    ["shunt_capacitance_uf_per_km", "Shunt capacitance", "µF/km", "A4"],
    ["material", "Conductor material", null, "x10"],
    ["insulation", "Insulation", null, "x10"],
    ["cores", "Number of cores", "count", "x10"],
    ["size_mm2", "Cross-section", "mm²", "x10"],
  ],
  BREAKER: [
    ["standard", "Product standard", null, "x10"],
    ["class", "Device class", null, "x10"],
    ["in_a", "Rated current I_n", "A", "model"],
    ["curve", "Trip curve", null, "x10"],
    ["poles", "Poles", "count", "x10"],
  ],
};

// Fields chosen from a list (contract enums, D-104).
export const ENTRY_OPTIONS: Record<string, string[]> = { material: ["CU", "AL"], insulation: ["PVC", "XLPE"], class: ["MCB", "MCCB"] };
export const BLOCK_KEY = { INVERTER: "inverter", CONDUCTOR: "conductor", BREAKER: "breaker" } as const;

export const block = (e: CatalogEntry): Record<string, unknown> => (e[BLOCK_KEY[e.kind]] ?? {}) as Record<string, unknown>;

export const emptyCatalog = (): Catalog => ({ schema_version: 1, app_version: "", entries: [] });

// FR-69: copy the model values and a catalog_ref into the element; FR-70: the ampacity becomes
// the current limit only when confirmed.
export function fromEntry(e: CatalogEntry, schemaVersion: number, confirmLimit = false): Record<string, unknown> {
  const b = block(e);
  const copied = e.kind === "INVERTER" ? ["rated_kva"] : ["r_ohm_per_km", "x_ohm_per_km"];
  const limit = e.kind === "CONDUCTOR" && confirmLimit && typeof b.ampacity_a === "number";
  const used = [...copied, ...(limit ? ["ampacity_a"] : []), ...(e.kind === "INVERTER" && b.tau_in_s != null ? ["tau_in_s"] : [])];
  const ref: CatalogRef = {
    entry_id: e.id,
    provenance: e.provenance ?? {},
    sources: Object.fromEntries(used.filter((f) => e.sources?.[f]).map((f) => [f, e.sources![f]])),
    catalog_schema_version: schemaVersion,
    modified: false,
    current_limit_confirmed: limit,
    tau_in_s: e.kind === "INVERTER" ? ((b.tau_in_s as number | null | undefined) ?? null) : null,
  };
  return {
    ...Object.fromEntries(copied.map((f) => [f, b[f] ?? null])),
    ...(limit ? { current_limit_a: b.ampacity_a } : {}),
    catalog_ref: ref,
  };
}

// FR-71: one τ_in per M4a run, so it pre-fills only when every catalogue τ_in agrees (D-61 K116).
export function tauInSource(inverters: { catalog_ref?: CatalogRef | null }[]): { from: CatalogRef | null; conflict: boolean } {
  const refs = inverters.flatMap((i) => (i.catalog_ref?.tau_in_s != null ? [i.catalog_ref] : []));
  const n = new Set(refs.map((r) => r.tau_in_s)).size;
  return { from: n === 1 ? refs[0] : null, conflict: n > 1 };
}

// FR-72: usable inverter entries (FR-66 guard) rated at least the advised unit rating; a hint, never a change.
export const catalogHints = (entries: CatalogEntry[], unitKva: number, checks: EntryCheck[]) =>
  entries.filter(
    (e) =>
      e.kind === "INVERTER" &&
      checks.some((c) => c.entry_id === e.id && c.usable) &&
      typeof e.inverter?.rated_kva === "number" &&
      e.inverter.rated_kva >= unitKva,
  );

// D-61 K114: warnings, not refusals, when an inverter entry does not match the Project nominal
// values or the element's droop gains lie outside the entry's ranges.
export function entryWarnings(
  e: CatalogEntry,
  nominal: { nominal_voltage_kv?: number | null; nominal_frequency_hz?: number | null },
  row: Record<string, unknown>,
): string[] {
  const inv = e.inverter;
  if (e.kind !== "INVERTER" || !inv) return [];
  const out: string[] = [];
  const differs = (a: unknown, b: unknown) => typeof a === "number" && typeof b === "number" && a !== b;
  if (differs(inv.nominal_voltage_kv, nominal.nominal_voltage_kv))
    out.push(`entry nominal voltage ${inv.nominal_voltage_kv} kV differs from the Project ${nominal.nominal_voltage_kv} kV`);
  if (differs(inv.nominal_frequency_hz, nominal.nominal_frequency_hz))
    out.push(`entry nominal frequency ${inv.nominal_frequency_hz} Hz differs from the Project ${nominal.nominal_frequency_hz} Hz`);
  const outside = (v: unknown, lo: unknown, hi: unknown) =>
    typeof v === "number" && typeof lo === "number" && typeof hi === "number" && (v < lo || v > hi);
  if (outside(row.frequency_droop_hz_per_kw, inv.frequency_droop_min_hz_per_kw, inv.frequency_droop_max_hz_per_kw))
    out.push(`P–f droop ${row.frequency_droop_hz_per_kw} Hz/kW is outside the entry range ${inv.frequency_droop_min_hz_per_kw}–${inv.frequency_droop_max_hz_per_kw} Hz/kW`);
  if (outside(row.voltage_droop_kv_per_kvar, inv.voltage_droop_min_kv_per_kvar, inv.voltage_droop_max_kv_per_kvar))
    out.push(`Q–V droop ${row.voltage_droop_kv_per_kvar} kV/kvar is outside the entry range ${inv.voltage_droop_min_kv_per_kvar}–${inv.voltage_droop_max_kv_per_kvar} kV/kvar`);
  return out;
}

export function refText(ref: CatalogRef | null | undefined): string {
  if (!ref) return "—";
  return [
    ref.entry_id,
    ref.modified ? "modified from catalogue" : null,
    ref.current_limit_confirmed ? "current limit: datasheet reference conditions" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

interface CatalogState {
  catalog: Catalog;
  checks: EntryCheck[];
  setCatalog: (c: Catalog) => void;
}

const Ctx = createContext<CatalogState>({ catalog: emptyCatalog(), checks: [], setCatalog: () => undefined });

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [checks, setChecks] = useState<EntryCheck[]>([]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void importCatalog(catalog).then((r) => live && setChecks(r.ok ? r.data.entry_checks : []));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [catalog]);
  return <Ctx.Provider value={{ catalog, checks, setCatalog }}>{children}</Ctx.Provider>;
}

export const useCatalog = () => useContext(Ctx);
