// Continuous color for values (treemap, choropleth, calendar, correlation): a share of the way between two theme
// colors, mixed in OKLab by the browser (color-mix). Written through the style object (CSP safe), never as a string.
import { clamp } from "../core/util.ts";

/** "sequential" (low → accent, default), "diverging" (negative ↔ positive around `mid`), or two/three CSS colors / tokens. */
export type ColorScale = "sequential" | "diverging" | readonly [string, string] | readonly [string, string, string];

const tok = (c: string): string => (c.startsWith("--") ? `var(${c})` : /^[a-z]+(-[a-z0-9]+)*$/.test(c) && !CSS_NAMES.has(c) ? `var(--m-${c})` : c);
const CSS_NAMES = new Set(["white", "black", "red", "green", "blue", "orange", "purple", "gray", "grey", "transparent", "gold", "pink", "teal", "navy"]);
const mix = (a: string, b: string, t: number): string => `color-mix(in oklab, ${b} ${Math.round(clamp(t, 0, 1) * 1000) / 10}%, ${a})`;

/**
 * `(value) => CSS color` for values in [lo, hi]. Sequential: from a faint tint to the chart accent (`--m-chart-hi`);
 * diverging: `--m-chart-neg` below `mid` (default the middle), the accent above, a neutral surface at it.
 */
export function colorScale(scale: ColorScale | null | undefined, lo: number, hi: number, mid?: number): (v: number | null | undefined) => string {
  const s = scale ?? "sequential";
  const span = hi - lo || 1;
  if (s === "diverging" || (Array.isArray(s) && s.length === 3)) {
    const [a, m, b] = s === "diverging" ? ["var(--m-chart-neg, var(--m-danger))", "var(--m-chart-mid, var(--m-surface-2, #eee))", "var(--m-chart-hi, var(--m-accent, var(--m-primary)))"] : (s as readonly string[]).map(tok);
    const c = mid ?? (lo + hi) / 2;
    return (v) => (v == null || !isFinite(v) ? "var(--m-chart-none, transparent)" : v < c ? mix(m as string, a as string, (c - v) / ((c - lo) || 1)) : mix(m as string, b as string, (v - c) / ((hi - c) || 1)));
  }
  const [a, b] = s === "sequential" ? ["var(--m-chart-lo, color-mix(in oklab, var(--m-chart-hi, var(--m-accent, var(--m-primary))) 10%, var(--m-surface, #fff)))", "var(--m-chart-hi, var(--m-accent, var(--m-primary)))"] : (s as readonly string[]).map(tok);
  return (v) => (v == null || !isFinite(v) ? "var(--m-chart-none, transparent)" : mix(a as string, b as string, (v - lo) / span));
}
