import { displayLang, localize } from "./i18n";
// K147: 6 significant digits hide unit round-trip noise (49.75000000000001 Hz); display only.
export const num = (v: number) => Number(v.toPrecision(6));
/** num() as display text: decimal separator of the display language. */
export const numText = (v: number) => localize(String(num(v)), displayLang());

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

// Results (plan W1; audit 2026-11-14 decision 2): fixed decimals per unit everywhere a result is shown.
// Inputs keep `num`; "Show data", exports and Run history keep full precision.
const DP: Record<string, number> = {
  kW: 2, kvar: 2, kVA: 2, kWh: 2, kV: 4, "p.u.": 4, pu: 4 /* margin rows spell it "pu" */, deg: 2, "°": 2, Hz: 3, "Hz/s": 3,
  A: 1, ratio: 3, factor: 3, "pu of rating": 3, s: 3, h: 2, "1/s": 2, "Ω": 4, count: 0, "%": 1,
};
// A non-zero value that would keep fewer than 2 significant digits (0.043 kW at 2 decimals) shows 2
// significant digits; one below 10^-(d+2) is shown as a bound ("< 0.000001" p.u.), never in e-notation.
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const fixed = (v: number, unit: string) => localize(fixedEn(v, unit), displayLang());
const fixedEn = (v: number, unit: string) => {
  const d = DP[unit];
  if (d === undefined) return String(num(v));
  const a = Math.abs(v);
  if (v === 0 || a >= 10 ** (1 - d)) return v.toFixed(d);
  const floor = 10 ** -(d + 2);
  if (a < floor) return `${v < 0 ? "> −" : "< "}${floor.toFixed(d + 2)}`;
  return String(Number(v.toPrecision(2)));
};
/** `fixed` for a value that may be missing. */
export const fixedOr = (v: number | null | undefined, unit: string, missing = "—") => (v === null || v === undefined ? missing : fixed(v, unit));
