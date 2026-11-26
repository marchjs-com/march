// Shared state between charts: a synced crosshair (charts with the same `sync` name show the same x), and a sliding
// window over growing (live) data.
import { signal, type Signal } from "../core/reactive.ts";

/** Where the crosshair of a sync group is: the chart that moved it and the x value (ms for time, the number, or a category). */
export interface SyncAt { from: string; x: number | string }
const groups = new Map<string, Signal<SyncAt | null>>();

/** The crosshair signal of a sync group (made on first use). */
export function syncGroup(name: string): Signal<SyncAt | null> {
  let s = groups.get(name);
  if (!s) groups.set(name, (s = signal<SyncAt | null>(null)));
  return s;
}

/** The `window` prop of live charts: the last `n` rows, or `{ last: n }` / `{ ms: span }` (the latest span of a time axis). */
export type WindowProp = number | { last?: number; ms?: number } | null | undefined;

/** Index range [a, b] of the rows a window keeps (x values sorted ascending; `xs` ms or numbers). */
export function windowRange(n: number, xs: readonly number[], w: WindowProp): [number, number] {
  if (!n) return [0, -1];
  if (w == null) return [0, n - 1];
  const last = typeof w === "number" ? w : w.last;
  let a = last != null ? Math.max(0, n - Math.max(1, Math.floor(last))) : 0;
  if (typeof w === "object" && w.ms != null) {
    const end = xs[n - 1] as number;
    while (a < n - 1 && (xs[a] as number) < end - w.ms) a++;
  }
  return [a, n - 1];
}

/** Keep only the last `n` items of a growing array (for a live data signal: `$rows = windowed([...$rows, row], 200)`). */
export const windowed = <T>(rows: readonly T[], n: number): T[] => (rows.length > n ? rows.slice(rows.length - n) : rows.slice());
