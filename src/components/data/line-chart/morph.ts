// LineChart's motion model: a chart state in data space (the x and value domains, each series' points keyed by x), and
// the state drawn at a progress between two of them. Points are matched by key; a point that only one side has takes
// the other side's line at its x (an appended point slides in, a dropped one slides out, a resampled line stays put).
import { clamp } from "../../../core/util.ts";

/** One point in data space: its key (x value or category), x position (a number), value top and stack base. */
export interface MPoint { k: string | number; x: number; y: number | null; lo: number | null }
/** One series: its points sorted by x and its axis. */
export interface MSeries { key: string; axis: "left" | "right"; pts: MPoint[] }
/** The whole chart in data space. */
export interface Snap { xd: [number, number]; yd: [number, number]; y2d: [number, number]; series: Map<string, MSeries>; base: number; base2: number }

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpPair = (a: [number, number], b: [number, number], t: number): [number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** The value of a series at x: linear between its neighbours, the end value beyond its ends; null in a gap / empty. */
export function valueAt(pts: readonly MPoint[], x: number, field: "y" | "lo"): number | null {
  let lo = 0, hi = pts.length - 1;
  if (hi < 0) return null;
  if (x <= (pts[0] as MPoint).x) return (pts[0] as MPoint)[field];
  if (x >= (pts[hi] as MPoint).x) return (pts[hi] as MPoint)[field];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if ((pts[m] as MPoint).x <= x) lo = m; else hi = m; }
  const a = pts[lo] as MPoint, b = pts[hi] as MPoint, va = a[field], vb = b[field];
  if (va == null || vb == null) return null;
  return b.x === a.x ? vb : va + ((vb - va) * (x - a.x)) / (b.x - a.x);
}

/**
 * The state drawn at progress `p` (domain) and `ps(key)` (per series, with stagger) between `from` and `to`. `wave` > 0
 * delays points from left to right (the entrance); a series only one side has grows from / shrinks to its base.
 */
export function between(from: Snap, to: Snap, p: number, ps: (key: string) => number, wave = 0): Snap {
  const xd = lerpPair(from.xd, to.xd, p), yd = lerpPair(from.yd, to.yd, p), y2d = lerpPair(from.y2d, to.y2d, p);
  const series = new Map<string, MSeries>();
  const keys = new Set([...to.series.keys(), ...from.series.keys()]);
  for (const key of keys) {
    const f = from.series.get(key), t = to.series.get(key), sp = ps(key);
    const ref = (t ?? f) as MSeries;
    const base = ref.axis === "right" ? to.base2 : to.base;
    if (sp >= 1 && t) { series.set(key, t); continue; }
    if (sp >= 1 && !t) continue;
    const span = (xd[1] - xd[0]) || 1;
    const byKey = new Map<string | number, { f?: MPoint; t?: MPoint }>();
    for (const q of f?.pts ?? []) byKey.set(q.k, { f: q });
    for (const q of t?.pts ?? []) { const e = byKey.get(q.k); if (e) e.t = q; else byKey.set(q.k, { t: q }); }
    const pts: MPoint[] = [];
    for (const [k, e] of byKey) {
      const x0 = e.f?.x ?? (e.t as MPoint).x, x1 = e.t?.x ?? x0;
      const pp = wave > 0 ? clamp((sp * (1 + wave) - wave * clamp((x1 - xd[0]) / span, 0, 1)), 0, 1) : sp;
      const x = lerp(x0, x1, pp);
      const fy = e.f ? e.f.y : f ? valueAt(f.pts, x0, "y") : (e.t?.lo ?? base);
      const ty = e.t ? e.t.y : t ? valueAt(t.pts, x1, "y") : (e.f?.lo ?? base);
      const flo = e.f ? e.f.lo : f ? valueAt(f.pts, x0, "lo") : (e.t?.lo ?? null);
      const tlo = e.t ? e.t.lo : t ? valueAt(t.pts, x1, "lo") : (e.f?.lo ?? null);
      const y = fy == null || ty == null ? ty : lerp(fy, ty, pp);
      const lo = flo == null || tlo == null ? tlo : lerp(flo, tlo, pp);
      pts.push({ k, x, y, lo });
    }
    pts.sort((a, b) => a.x - b.x);
    series.set(key, { key, axis: ref.axis, pts });
  }
  return { xd, yd, y2d, series, base: to.base, base2: to.base2 };
}

/** An empty state (nothing drawn yet). */
export const emptySnap = (): Snap => ({ xd: [0, 1], yd: [0, 1], y2d: [0, 1], series: new Map(), base: 0, base2: 0 });
