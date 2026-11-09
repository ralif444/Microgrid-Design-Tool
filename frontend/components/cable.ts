// S-19 Cable and breaker sizing (Doc 12 X10, guideline §5.3, §6; Doc 9 D-103): payload shapes,
// outcome presentation, factor sources read from the loaded table file, the session store and the
// feature flag from /api/meta. The CB payload is a free object in the contract, so it is typed here.
import { useEffect, useState } from "react";
import { getMeta } from "../api-client";
import type { RunRecord, RunRecordRef } from "../api-types";
import type { IconName } from "./Icon";

export type Outcome = "SIZED" | "NO_DEVICE_FITS" | "NO_SIZE_FITS" | "OUT_OF_TABLE" | "TABLE_GAP";

export type CbElement = {
  element_id: string;
  element_kind: "LINE" | "INVERTER_FEEDER";
  ib_a: number;
  ib_source: string;
  device: { class: "MCB" | "MCCB"; standard: string; in_a: number | null; k2: number; k2_source: string; i2_a: number | null };
  cable: {
    conductor: string;
    insulation: string;
    method: string;
    size_mm2: number;
    i_tab_a: number;
    k_theta: number;
    k_rho: number;
    k_g: number;
    lookup_values: { temp_c_used: number; rho_used: number | null; group_used: number };
    iz_a: number;
  } | null;
  checks: { cond1_ok: boolean; cond2_ok: boolean; margin_in_ib_a: number; margin_iz_in_a: number; margin_145iz_i2_a: number } | null;
  r_check: { r_line_ohm_per_km: number; r_cable_ohm_per_km: number; temp_c: number; deviation_ratio: number; flagged: boolean } | null;
  outcome: Outcome;
  notes: string[];
};

export type CbPayload = { elements: CbElement[]; method_id: string; table_set_id: string; table_set_hash: string; caveat_text: string };

// Carbon support roles (tokens.css) with icon and word; never colour alone (guideline §6).
export const OUTCOME: Record<Outcome, { word: string; role: "success" | "negative" | "caution"; icon: IconName }> = {
  SIZED: { word: "Sized", role: "success", icon: "feasible" },
  NO_DEVICE_FITS: { word: "No device fits", role: "negative", icon: "misuse" },
  NO_SIZE_FITS: { word: "No cable size fits", role: "negative", icon: "misuse" },
  OUT_OF_TABLE: { word: "Outside the table", role: "caution", icon: "warn" },
  TABLE_GAP: { word: "Gap in the table", role: "caution", icon: "warn" },
};

export const METHODS: [string, string][] = [["A1", "A1"], ["B1", "B1"], ["C", "C"], ["D_DUCT", "D (buried duct)"]];
export const CONDUCTORS: [string, string][] = [["CU", "Copper (Cu)"], ["AL", "Aluminium (Al)"]];
export const INSULATIONS: [string, string][] = [["PVC", "PVC (70 °C)"], ["XLPE", "XLPE (90 °C)"]];
export const CONSTRUCTIONS: [string, string][] = [["MULTICORE", "Multicore"], ["SINGLE_CORE", "Single-core"]];
const AIR: [string, string][] = [["BUNCHED", "Bunched"], ["SINGLE_LAYER_WALL", "Single layer on a wall"], ["UNDER_CEILING", "Under a ceiling"]];
const DUCT: [string, string][] = [["DUCT_TOUCHING", "Ducts touching"], ["DUCT_0_25M", "Ducts 0.25 m apart"], ["DUCT_0_5M", "Ducts 0.5 m apart"], ["DUCT_1M", "Ducts 1 m apart"]];
export const arrangements = (method: string | null) => (method === "D_DUCT" ? DUCT : AIR);

export type CbSettings = {
  method: string | null;
  conductor: string | null;
  insulation: string | null;
  ambient_temp_c: number | null;
  soil_resistivity_k_m_per_w: number | null;
  grouping_count: number | null;
  grouping_arrangement: string | null;
  cable_construction: string | null;
};

export const EMPTY_SETTINGS: CbSettings = {
  method: null,
  conductor: null,
  insulation: null,
  ambient_temp_c: null,
  soil_resistivity_k_m_per_w: null,
  grouping_count: null,
  grouping_arrangement: null,
  cable_construction: null,
};

// Fields left empty are not sent, so stage 1 names them (CABLE_SETTINGS_INVALID, D-102 K281);
// soil resistivity only for D (guideline §2.2). Project defaults only: overrides deferred (D-103 K290).
export function settingsBody(s: CbSettings): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(s)) if (v !== null && (k !== "soil_resistivity_k_m_per_w" || s.method === "D_DUCT")) out[k] = v;
  return out;
}

type Src = { table?: string; page?: string };
type Tables = {
  table_set_id?: string;
  source?: { document?: string };
  ampacity?: (Src & { insulation: string; conductor: string; method: string; loaded_conductors: number })[];
  k_theta_air?: Src;
  k_theta_ground?: Src;
  k_rho?: Src;
  k_group?: Record<string, Src>;
};

const cite = (table: string | undefined, page: string | undefined) => (table ? `${table}${page ? `, p. ${page}` : ""}` : "not named in the table file");

// The table and page behind each factor of a sized cable, read from the table file that was sent
// (guideline §3.2: the same choices the method makes).
export function factorSources(tables: unknown, c: NonNullable<CbElement["cable"]>, construction: string | null) {
  const t = (tables ?? {}) as Tables;
  const amp = t.ampacity?.find((a) => a.insulation === c.insulation && a.conductor === c.conductor && a.method === c.method && a.loaded_conductors === 3);
  const d = c.method === "D_DUCT";
  const theta = d ? t.k_theta_ground : t.k_theta_air;
  const gKey = d ? (construction === "MULTICORE" ? "A.52-19A" : "A.52-19B") : "A.52-17";
  return {
    i_tab: cite(amp?.table, amp?.page),
    k_theta: cite(theta?.table, theta?.page),
    k_rho: d ? cite(t.k_rho?.table, t.k_rho?.page) : "none, k_ρ is 1 outside method D",
    k_g: cite(t.k_group?.[gKey] ? gKey : undefined, t.k_group?.[gKey]?.page),
  };
}

// Latest M2 on the design now in the store, usable as the CB dependency (FR-111, Doc 7 §3.1).
export function m2Ref(runRecords: RunRecord[], current: string | null): RunRecordRef | null {
  const rec = runRecords.findLast((r) => r.analysis_type === "M2");
  if (!rec || current === null || rec.snapshot_hash !== current) return null;
  if (rec.result.status !== "FEASIBLE" && rec.result.status !== "INFEASIBLE") return null;
  return {
    record_id: rec.record_id,
    analysis_type: "M2",
    snapshot_hash: rec.snapshot_hash,
    status: rec.result.status,
    result_hash: rec.result_hash,
    result_payload: rec.result.payload ?? null,
  };
}

// Session-only state (D-103 K287, K289): settings, the table file and the last CB RunRecord, which
// carries the table file in its parameters, so it stays out of the Project file and Run history.
// shortcut: one module-level copy shared by every Project opened in this tab; move into the
// Project store when the settings are saved in the Project (K264).
export type CbSession = { settings: CbSettings; tables: unknown; tablesName: string | null; record: RunRecord | null };
let session: CbSession = { settings: EMPTY_SETTINGS, tables: null, tablesName: null, record: null };

export function useCbSession(): [CbSession, (patch: Partial<CbSession>) => void] {
  const [s, setS] = useState(session);
  return [
    s,
    (patch) => {
      session = { ...session, ...patch };
      setS(session);
    },
  ];
}

// Feature flag from /api/meta (D-103 K286): null while unknown, so nothing flashes in or out.
let flag: Promise<boolean> | null = null;
export function useCableSizingFlag(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    flag ??= getMeta().then((m) => m.ok && m.data.features.cable_sizing);
    let live = true;
    void flag.then((v) => live && setOn(v));
    return () => {
      live = false;
    };
  }, []);
  return on;
}
