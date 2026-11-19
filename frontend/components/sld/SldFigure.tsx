"use client";
// Report figure (Doc 12 FR-97; guideline §7): the analysed design of the reported M1 RunRecord (its own
// snapshot, not the current store design) with that run's overlay, static, with a traceability caption
// and "Download SVG" through the shared exporter. In print a wide drawing is split into parts so
// 12 px text stays at 8 pt or more at A4 text width.
import { useMemo, useRef } from "react";
import type { M1Payload, ProjectSnapshot, RunRecord } from "../../api-types";
import { captionLines, downloadSvg, FAKE_CAPTION } from "../charts/exportSvg";
import { useLanguage } from "../Language";
import { buildSldModel } from "./buildSldModel";
import styles from "./sld.module.css";
import { SldSvg } from "./SldSvg";
import { SldLegend } from "./symbols";
import { useSldLayout } from "./useSldLayout";

export const SLD_TITLE = "Single-line diagram of the analysed design";
// A4 text width 170 mm = 643 px; 12 px drawn at 643/720 is 10.7 px = 8 pt, the thesis minimum.
export const PART_W = 720;
const OVERLAP = 40;

/** x ranges of the print parts: one when it fits, else equal parts overlapping by 40 units. */
export function printParts(width: number, part = PART_W): [number, number][] {
  if (width <= part) return [[0, width]];
  const n = Math.ceil((width - OVERLAP) / (part - OVERLAP));
  const step = (width - part) / (n - 1);
  return Array.from({ length: n }, (_, k) => [k * step, k * step + part]);
}

export function SldFigure({ record }: { record: RunRecord }) {
  const { t } = useLanguage();
  const model = useMemo(() => {
    const m1 = record.result.status === "FEASIBLE" ? (record.result.payload as unknown as M1Payload) : null;
    return buildSldModel({ design: record.snapshot as ProjectSnapshot, m1 });
  }, [record]);
  const { layout, failed } = useSldLayout(model);
  const box = useRef<HTMLDivElement>(null);
  const fake = record.engine_kind === "FAKE";
  if (failed) return <p>{t("Diagram could not be drawn; the tables still work.")}</p>;
  const parts = layout ? printParts(layout.width) : [];
  return (
    <figure className={styles.report} aria-label={t(SLD_TITLE)}>
      <p className={styles.reportTitle}>{t(SLD_TITLE)}</p>
      {!layout ? (
        <p className={styles.wait}>{t("Laying out the diagram…")}</p>
      ) : (
        <>
          <div ref={box} className={parts.length > 1 ? styles.screenOnly : undefined}>
            <SldSvg model={model} layout={layout} label={t(SLD_TITLE)} />
          </div>
          {parts.length > 1 &&
            parts.map((c, k) => (
              <div key={k} className={styles.printOnly}>
                <SldSvg model={model} layout={layout} label={`${t(SLD_TITLE)}, ${t("part {k} of {n}", { k: k + 1, n: parts.length })}`} clip={c} />
                <p className={styles.partNote}>
                  {t("Part {k} of {n}", { k: k + 1, n: parts.length })}
                </p>
              </div>
            ))}
        </>
      )}
      <figcaption data-testid="sld-caption" className={styles.caption}>
        {record.analysis_type}, RunRecord {record.record_id}, snapshot {record.snapshot_hash.slice(0, 12)}, engine {record.engine_kind ?? t("not called")}
        {record.result.status !== "FEASIBLE" && `; ${t("{status}: no result labels", { status: record.result.status })}`}
        {fake && <strong>. {FAKE_CAPTION}</strong>}
      </figcaption>
      <SldLegend />
      <button
        type="button"
        className="no-print"
        disabled={!layout}
        onClick={() => {
          const svg = box.current?.querySelector("svg");
          if (svg) downloadSvg(`single-line-diagram-${record.record_id}.svg`, svg, captionLines(SLD_TITLE, record));
        }}
      >
        {t("Download SVG")}
      </button>
    </figure>
  );
}
