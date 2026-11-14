// K147: 6 significant digits hide unit round-trip noise (49.75000000000001 Hz); display only.
export const num = (v: number) => Number(v.toPrecision(6));

// Locale-safe input (plan F1): a dot or a comma is the decimal separator. null = empty, undefined = not a number.
// shortcut: "1,500" is refused as ambiguous (1.5 or 1500); once the language switch exists, resolve it by locale.
const NUMBER = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
export const parseNumber = (s: string, integer = false): number | null | undefined => {
  const t = s.trim();
  if (t === "") return null;
  if (!NUMBER.test(t) || /^[+-]?[1-9]\d{0,2},\d{3}$/.test(t)) return undefined;
  const n = Number(t.replace(",", "."));
  return integer && !Number.isInteger(n) ? undefined : n;
};
export const NOT_A_NUMBER = "Enter a number, for example 0.44 or 0,44.";

// Results only (ADR-016, plan W1): fixed decimals per unit so result columns line up. Inputs keep `num`.
const DP: Record<string, number> = { kW: 2, kvar: 2, kVA: 2, "p.u.": 4, deg: 2, Hz: 3, A: 1, ratio: 3, "pu of rating": 3 };
// A non-zero value that would keep fewer than 2 significant digits (0.043 kW at 2 decimals) falls back to `num`.
export const fixed = (v: number, unit: string) => {
  const d = DP[unit];
  return d === undefined || (v !== 0 && Math.abs(v) < 10 ** (1 - d)) ? String(num(v)) : v.toFixed(d);
};
