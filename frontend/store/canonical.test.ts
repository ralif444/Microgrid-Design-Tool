import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "./canonical";

// Same vectors as tests/reproducibility/test_canonical_vectors.py (Doc 9 D-45 K4).
const vectors = JSON.parse(
  readFileSync(new URL("../../tests/fixtures/canonical_vectors.json", import.meta.url), "utf-8"),
) as { value: unknown; canonical: string; sha256: string }[];

describe("browser canonicaliser", () => {
  it.each(vectors.map((v, i) => [i, v] as const))("matches the server on vector %i", async (_i, v) => {
    expect(canonicalJson(v.value)).toBe(v.canonical);
    expect(await sha256Hex(v.value)).toBe(v.sha256);
  });
});
