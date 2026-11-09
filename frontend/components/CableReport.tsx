"use client";
// S-16 section "Cable and overload sizing (experimental)" (Doc 12 FR-114, guideline §6 Report, D12):
// the session CB run on the current design (K291), only with the flag on; nothing otherwise.
// Method id, table set with its SHA-256, the caveat, the PUIL edition KONFLIK (Doc 9 K-08) and one
// results table with the catalogue match as a check only (D-104 K294).
import { useCatalog } from "./Catalog";
import { catalogueMatch, currentCb, matchText, OUTCOME, useCableSizingFlag, type CbElement } from "./cable";
import { DataTable, type DataColumn } from "./DataTable";
import { fmt } from "./Further";

const yes = (b: boolean | undefined) => (b === undefined ? "—" : b ? "met" : "not met");

export function CableReportSection({ current }: { current: string | null }) {
  const on = useCableSizingFlag() === true;
  const { catalog, checks } = useCatalog();
  const cb = on ? currentCb(current) : null;
  if (!cb) return null;
  const { payload: p, record } = cb;
  const construction = (record.parameters as { settings?: { cable_construction?: string } }).settings?.cable_construction ?? null;
  const usable = new Set(checks.filter((c) => c.usable).map((c) => c.entry_id));
  const columns: DataColumn<CbElement>[] = [
    { key: "id", header: "Element", cell: (e) => e.element_id },
    { key: "kind", header: "Kind", cell: (e) => (e.element_kind === "LINE" ? "Line" : "Inverter feeder") },
    { key: "ib", header: "I_B", unit: "A", numeric: true, cell: (e) => fmt(e.ib_a) },
    { key: "dev", header: "Device", cell: (e) => e.device.class },
    { key: "in", header: "I_n", unit: "A", numeric: true, cell: (e) => fmt(e.device.in_a) },
    { key: "size", header: "Size", unit: "mm²", numeric: true, cell: (e) => fmt(e.cable?.size_mm2) },
    { key: "iz", header: "I_Z", unit: "A", numeric: true, cell: (e) => fmt(e.cable?.iz_a) },
    { key: "c1", header: "I_B ≤ I_n ≤ I_Z", cell: (e) => yes(e.checks?.cond1_ok) },
    { key: "c2", header: "I_2 ≤ 1.45 I_Z", cell: (e) => yes(e.checks?.cond2_ok) },
    { key: "out", header: "Outcome", cell: (e) => OUTCOME[e.outcome].word },
    { key: "r", header: "R check", cell: (e) => (e.r_check ? (e.r_check.flagged ? "R differs by more than 10 %" : "within 10 %") : "—") },
    { key: "cat", header: "Catalogue match", cell: (e) => (e.outcome === "SIZED" ? matchText(catalogueMatch(e, construction, catalog.entries, usable)) : "—") },
  ];
  return (
    <section aria-label="Cable and overload sizing (experimental)">
      <h2>8 Cable and overload sizing (experimental)</h2>
      <p>
        Advice on the overload rating of the breaker and the conductor size only; not a protection or coordination study. Protection is outside the thesis
        scope, so this section awaits the supervisor&apos;s approval (Doc 9 K-07).
      </p>
      <p>
        <strong>Caveat.</strong> {p.caveat_text}
      </p>
      <p>
        Method <code>{p.method_id}</code>, table set <code>{p.table_set_id}</code>, SHA-256 <code>{p.table_set_hash}</code>. RunRecord{" "}
        <code>{record.record_id}</code>, computed by the app (no engine call), kept in this session only.
      </p>
      <p>
        <strong>KONFLIK, PUIL edition.</strong> The technical baseline is PUIL 2011 (SNI 0225:2011), the edition the author holds; Permen ESDM 7/2021 lists
        PUIL 2020 as the mandatory edition. Migrate when PUIL 2020 is obtained (Doc 9 K-08).
      </p>
      <DataTable label="Cable and overload sizing results" caption="Cable and overload sizing results" columns={columns} rows={p.elements} rowKey={(e) => e.element_id} rowName={(e) => e.element_id} />
    </section>
  );
}
