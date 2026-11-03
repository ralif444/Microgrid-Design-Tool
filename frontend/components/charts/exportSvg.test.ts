import { describe, expect, it } from "vitest";
import type { RunRecord } from "../../api-types";
import { printParts } from "../sld/SldFigure";
import { captionLines, FAKE_CAPTION } from "./exportSvg";

const rec = (engine_kind: RunRecord["engine_kind"]) =>
  ({ analysis_type: "M1", record_id: "rr-1", snapshot_hash: "a".repeat(64), result_hash: "b".repeat(64), engine_kind, engine_version: "0.1", created_at: "2026-11-03T10:00:00Z" }) as RunRecord;

describe("exportSvg caption block of X7, used by FR-97", () => {
  it("names analysis, RunRecord, hashes, engine and date; FAKE adds its line", () => {
    const real = captionLines("Title", rec("REAL")).join("\n");
    for (const t of ["M1", "RunRecord rr-1", "snapshot aaaaaaaaaaaa", "result hash bbbbbbbbbbbb", "Engine REAL 0.1", "2026-11-03"]) expect(real).toContain(t);
    expect(real).not.toContain(FAKE_CAPTION);
    expect(captionLines("Title", rec("FAKE"))).toContain(FAKE_CAPTION);
  });
});

describe("printParts (guideline §7, 8 pt in print)", () => {
  it("keeps a narrow drawing whole and splits a wide one into overlapping parts no wider than 720", () => {
    expect(printParts(600)).toEqual([[0, 600]]);
    const parts = printParts(2000);
    expect(parts[0][0]).toBe(0);
    expect(parts.at(-1)![1]).toBe(2000);
    for (const [a, b] of parts) expect(b - a).toBe(720);
    for (let k = 1; k < parts.length; k++) expect(parts[k][0]).toBeLessThan(parts[k - 1][1]);
  });
});
