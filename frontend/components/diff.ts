// RunRecord comparison for S-15 (Doc 12 P3, FR-83): computed in the client, no endpoint (ADR-010).
// Arrays of objects with an id field are keyed by that id, so paths read like lines[LN1].r_ohm_per_km.
export interface Difference {
  path: string;
  a: unknown;
  b: unknown;
}

const ID_KEYS = ["id", "bus_id", "inverter_id", "line_id", "scenario_id"];
const keyOf = (x: unknown, k: number) => {
  const o = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
  const id = ID_KEYS.map((f) => o[f]).find((v) => typeof v === "string");
  return (id as string | undefined) ?? String(k);
};

export function jsonDiff(a: unknown, b: unknown, path = ""): Difference[] {
  if (Array.isArray(a) && Array.isArray(b)) {
    const ma = new Map(a.map((x, k) => [keyOf(x, k), x]));
    const mb = new Map(b.map((x, k) => [keyOf(x, k), x]));
    return [...new Set([...ma.keys(), ...mb.keys()])].flatMap((k) => jsonDiff(ma.get(k), mb.get(k), `${path}[${k}]`));
  }
  const obj = (v: unknown) => v !== null && typeof v === "object" && !Array.isArray(v);
  if (obj(a) && obj(b)) {
    const oa = a as Record<string, unknown>;
    const ob = b as Record<string, unknown>;
    return [...new Set([...Object.keys(oa), ...Object.keys(ob)])].flatMap((k) => jsonDiff(oa[k], ob[k], path ? `${path}.${k}` : k));
  }
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null) ? [] : [{ path, a, b }];
}
