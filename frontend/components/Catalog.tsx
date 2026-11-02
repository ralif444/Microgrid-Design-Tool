"use client";
// Catalogue state and helpers (Doc 12 §3.3; FR-64 - FR-72; D-61). The Catalogue lives beside the
// Project, not in it, and survives opening another Project. The selection guard is the server's
// (/api/catalogs/import), re-checked whenever the Catalogue changes.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { importCatalog } from "../api-client";
import type { Catalog, CatalogEntry, CatalogRef, EntryCheck } from "../api-types";

type Use = "model" | "text" | "A2" | "A4";
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
  ],
};

export const block = (e: CatalogEntry): Record<string, unknown> =>
  ((e.kind === "INVERTER" ? e.inverter : e.conductor) ?? {}) as Record<string, unknown>;

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
