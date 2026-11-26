// Distribution statistics for the distribution charts (Histogram, BoxPlot): mean, deviation, quantiles, kernel
// density (Gaussian, Silverman bandwidth) and the normal curve. Plain functions, no DOM.

/** Finite numbers of a list (nulls, NaN and strings that are not numbers left out). */
export const finite = (vals: readonly unknown[]): number[] => {
  const out: number[] = [];
  for (const v of vals) { if (v == null || v === "") continue; const n = Number(v); if (isFinite(n)) out.push(n); }
  return out;
};

/** Arithmetic mean (NaN for no values). */
export const mean = (v: readonly number[]): number => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

/** Sample standard deviation (n − 1; 0 for fewer than two values). */
export function deviation(v: readonly number[]): number {
  if (v.length < 2) return 0;
  const m = mean(v);
  let s = 0;
  for (const x of v) s += (x - m) * (x - m);
  return Math.sqrt(s / (v.length - 1));
}

/** Quantile `p` (0..1) of ascending values, linear between ranks (type 7, as spreadsheets do). */
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const h = (n - 1) * Math.min(1, Math.max(0, p)), lo = Math.floor(h), a = sorted[lo] as number;
  return lo + 1 < n ? a + (h - lo) * ((sorted[lo + 1] as number) - a) : a;
}

/** Silverman's rule of thumb for a Gaussian kernel's bandwidth. */
export function silverman(v: readonly number[]): number {
  const n = v.length;
  if (n < 2) return 1;
  const s = v.slice().sort((a, b) => a - b), sd = deviation(v), iqr = (quantile(s, 0.75) - quantile(s, 0.25)) / 1.34;
  const spread = Math.min(sd, iqr || sd) || sd || Math.abs(mean(v)) * 0.1 || 1;
  return 0.9 * spread * n ** -0.2;
}

const R2PI = 1 / Math.sqrt(2 * Math.PI);
/** Normal probability density at `x`. */
export const normalPdf = (x: number, m: number, sd: number): number => (sd > 0 ? (R2PI / sd) * Math.exp(-0.5 * ((x - m) / sd) ** 2) : 0);

/** Normal cumulative probability at `x` (Abramowitz–Stegun erf, error < 1.5e-7). */
export function normalCdf(x: number, m: number, sd: number): number {
  if (!(sd > 0)) return x < m ? 0 : 1;
  const z = (x - m) / (sd * Math.SQRT2), t = 1 / (1 + 0.3275911 * Math.abs(z));
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

/** Kernel density estimate (Gaussian kernel, bandwidth `bw`) of `v` at each of `at`; `cumulative` gives the KDE's CDF. */
export function kde(v: readonly number[], at: readonly number[], bw = silverman(v), cumulative = false): number[] {
  const n = v.length;
  if (!n) return at.map(() => 0);
  const b = bw > 0 ? bw : 1;
  return at.map((x) => {
    let s = 0;
    for (const xi of v) s += cumulative ? normalCdf(x, xi, b) : normalPdf(x, xi, b);
    return s / n;
  });
}

/** Evenly spaced samples from `a` to `b` (both included). */
export const samples = (a: number, b: number, k: number): number[] => Array.from({ length: k }, (_, i) => a + ((b - a) * i) / Math.max(1, k - 1));
