// Doc 3 §7 canonicalisation in the browser, used only for SizingAdvice.input_hash (Doc 9 D-45 K4).
// Snapshot and RunRecord hashes stay server-side. Cross-checked with the Python canonicaliser
// through tests/fixtures/canonical_vectors.json.
const ENTITY_ARRAYS = new Set(["buses", "lines", "loads", "inverters"]);

function encode(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("NaN and Infinity are not allowed");
    return JSON.stringify(v); // ECMAScript Number::toString; -0 becomes 0
  }
  if (typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(encode).join(",")}]`;
  if (typeof v === "object") {
    // shortcut: keys compared by UTF-16 code unit, equal to code point order for BMP keys (all contract keys)
    const keys = Object.keys(v as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${encode((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  throw new Error(`unsupported type ${typeof v}`);
}

function dropNull(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNull);
  if (v !== null && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== null && x !== undefined)
        .map(([k, x]) => [k, dropNull(x)]),
    );
  return v;
}

const byId = (a: unknown, b: unknown) => {
  const ia = String((a as { id?: unknown } | null)?.id ?? "");
  const ib = String((b as { id?: unknown } | null)?.id ?? "");
  return ia < ib ? -1 : ia > ib ? 1 : 0;
};

// Same as the server's normalise_raw: nulls dropped, top-level entity arrays sorted by id.
export function canonicalJson(value: unknown): string {
  const v = dropNull(value);
  if (v !== null && typeof v === "object" && !Array.isArray(v))
    for (const [k, x] of Object.entries(v)) if (ENTITY_ARRAYS.has(k) && Array.isArray(x)) x.sort(byId);
  return encode(v);
}

export async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
