// Chart geometry for the inline-SVG charts (Doc 12 X1, FR-86). Pixel mapping only: no engine
// number is computed here (guideline §1 rule 1). Logic ported from the prototype's svgScale.ts.

export function linearScale([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  const span = d1 - d0;
  return (v: number) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

// Data range padded by `pad` of its span; nulls are skipped; a single value gets ±1.
export function niceDomain(values: (number | null)[], pad = 0.08): [number, number] {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!finite.length) return [0, 1];
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

// About `count` ticks on 1, 2 or 5 × 10^n steps inside the domain.
export function niceTicks([lo, hi]: [number, number], count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return [lo];
  const raw = (hi - lo) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const step = (r >= 7.5 ? 10 : r >= 3.5 ? 5 : r >= 1.5 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let k = Math.ceil(lo / step); k * step <= hi + step * 1e-6; k++) ticks.push(Number((k * step).toPrecision(10)));
  return ticks;
}

// Index of the real sample nearest to `target` (the crosshair snaps to it, never between samples).
export function nearestIndex(xs: number[], target: number): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - target) < Math.abs(xs[best] - target)) best = i;
  return best;
}

// Runs of consecutive indices with a value: a line is drawn per run, so a null is a gap (rule 5).
export function splitAtNulls(ys: (number | null)[]): number[][] {
  const runs: number[][] = [];
  let run: number[] = [];
  ys.forEach((y, i) => {
    if (y === null || !Number.isFinite(y)) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(i);
  });
  if (run.length) runs.push(run);
  return runs;
}
