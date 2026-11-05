// Participation grid rows for S-13 (Doc 12 §8 P8; Doc 3 §6.8): `factors[mode][state]` turned into one
// row per state, grouped per inverter in the order δ, P_f, Q_f. The engine names states
// "delta/<id>", "p_f/<id>", "q_f/<id>"; any other name is kept as given, in its own group.
import type { M4aPayload } from "../api-types";
import type { GridRow } from "./charts/GridChart";

const KIND: Record<string, [number, string]> = { delta: [0, "δ"], p_f: [1, "P_f"], q_f: [2, "Q_f"] };

export function participationRows(p: NonNullable<M4aPayload["participation"]>): GridRow[] {
  const owners: string[] = [];
  const rows = p.state_names.map((name, i) => {
    const [kind, owner] = name.split("/");
    const k = owner !== undefined ? KIND[kind] : undefined;
    const group = k ? owner : "other";
    if (!owners.includes(group)) owners.push(group);
    return { order: k?.[0] ?? 9, row: { label: k ? `${k[1]} ${owner}` : name, group, values: p.factors.map((f) => f[i] ?? null) } };
  });
  // sorting only: by inverter (first appearance), then δ, P_f, Q_f
  return rows.sort((a, b) => owners.indexOf(a.row.group) - owners.indexOf(b.row.group) || a.order - b.order).map((r) => r.row);
}
