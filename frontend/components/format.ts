// K147: 6 significant digits hide unit round-trip noise (49.75000000000001 Hz); display only.
export const num = (v: number) => Number(v.toPrecision(6));

// Results only (ADR-016, plan W1): fixed decimals per unit so result columns line up. Inputs keep `num`.
const DP: Record<string, number> = { kW: 2, kvar: 2, kVA: 2, "p.u.": 4, deg: 2, Hz: 3, A: 1, ratio: 3, "pu of rating": 3 };
// A non-zero value that would keep fewer than 2 significant digits (0.043 kW at 2 decimals) falls back to `num`.
export const fixed = (v: number, unit: string) => {
  const d = DP[unit];
  return d === undefined || (v !== 0 && Math.abs(v) < 10 ** (1 - d)) ? String(num(v)) : v.toFixed(d);
};
