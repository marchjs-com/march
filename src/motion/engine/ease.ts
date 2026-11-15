// Easing: one registry of named easings that work both in JS (a function) and natively (a CSS easing string, so
// WAAPI and CSS animations run them off the main thread). Springs and bounces become CSS `linear()` curves.
//   ease("out")  ease("--m-ease-out")  ease("cubic-bezier(.2,.8,.2,1)")  ease("steps(4, end)")
//   ease("spring(170, 26)")  ease(springEase({ stiffness: 300, damping: 18 }))  ease((t) => t * t)

export interface Ease {
  (t: number): number;
  /** CSS easing for WAAPI / CSS (null when only JS can run it). */
  readonly css: string | null;
  /** Natural duration in ms (springs). */
  readonly duration?: number;
}
export type EaseInput = string | ((t: number) => number) | Ease;

const make = (fn: (t: number) => number, css: string | null, duration?: number): Ease => {
  const e = ((t: number) => fn(t)) as Ease & { css: string | null; duration?: number };
  e.css = css;
  if (duration !== undefined) e.duration = duration;
  return e;
};
const isEase = (v: unknown): v is Ease => typeof v === "function" && "css" in v;

export const linear: Ease = make((t) => t, "linear");

/** CSS-compatible cubic-bezier(x1, y1, x2, y2). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const dx = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  const fn = (x: number): number => {
    if (x <= 0 || x >= 1) return x <= 0 ? (x1 > 0 ? (y1 / x1) * x : 0) : 1 + (x2 < 1 ? ((y2 - 1) / (x2 - 1)) * (x - 1) : 0);
    let t = x;
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; const d = dx(t); if (Math.abs(e) < 1e-6) return ((ay * t + by) * t + cy) * t; if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    for (let i = 0; i < 30; i++) { const v = sx(t); if (Math.abs(v - x) < 1e-6) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return ((ay * t + by) * t + cy) * t;
  };
  return make(fn, `cubic-bezier(${r(x1)},${r(y1)},${r(x2)},${r(y2)})`);
}

/** CSS steps(n, position). */
export function steps(n: number, pos: "start" | "end" | "jump-start" | "jump-end" | "jump-none" | "jump-both" = "end"): Ease {
  const p = pos === "start" ? "jump-start" : pos === "end" ? "jump-end" : pos;
  const jumps = p === "jump-none" ? n - 1 : p === "jump-both" ? n + 1 : n;
  return make((t) => {
    if (t >= 1) return 1;
    let s = Math.floor(t * n);
    if (p === "jump-start" || p === "jump-both") s++;
    return Math.min(1, Math.max(0, s / jumps));
  }, `steps(${n}, ${p})`);
}

export interface SpringOptions { stiffness?: number; damping?: number; mass?: number; velocity?: number }
/** A damped spring as an easing: exact physics, a natural duration, and a CSS linear() curve for WAAPI. */
export function springEase(o: SpringOptions = {}): Ease {
  const k = o.stiffness ?? 170, c = o.damping ?? 26, m = o.mass ?? 1, v0 = -(o.velocity ?? 0);
  const w0 = Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(k * m));
  let x: (t: number) => number;
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    x = (t) => 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0 + v0) / wd) * Math.sin(wd * t));
  } else if (zeta === 1) {
    x = (t) => 1 - Math.exp(-w0 * t) * (1 + (w0 + v0) * t);
  } else {
    const s = w0 * Math.sqrt(zeta * zeta - 1), r1 = -zeta * w0 + s, r2 = -zeta * w0 - s;
    const A = (-v0 - r2) / (r1 - r2), B = 1 - A;
    x = (t) => 1 - (A * Math.exp(r1 * t) + B * Math.exp(r2 * t));
  }
  // settle time: the first moment after which it stays within 0.1 % of the target
  let settle = 0;
  for (let t = 0, calm = 0; t < 10; t += 1 / 120) {
    if (Math.abs(1 - x(t)) < 1e-3) { if (!calm) settle = t; calm += 1 / 120; if (calm > 0.25) break; } else calm = 0;
  }
  const dur = Math.max(0.05, settle || 10);
  const fn = (p: number): number => (p >= 1 ? 1 : x(p * dur));
  return make(fn, toLinear(fn, 64), Math.round(dur * 1000));
}

/** A bouncing landing (like a ball): `bounces` hops, each `decay` as high as the previous. */
export function bounceEase(bounces = 3, decay = 0.35): Ease {
  // segment widths shrink with sqrt(height) (ballistic)
  const hs: number[] = [1]; for (let i = 0; i < bounces; i++) hs.push(hs[hs.length - 1]! * decay);
  const ws = hs.map((h, i) => (i === 0 ? 1 : 2) * Math.sqrt(h));
  const total = ws.reduce((a, b) => a + b, 0);
  const fn = (t: number): number => {
    if (t >= 1) return 1;
    let x = t * total;
    if (x < ws[0]!) { const u = x / ws[0]!; return u * u; }
    x -= ws[0]!;
    for (let i = 1; i < ws.length; i++) {
      const w = ws[i]!;
      if (x < w) { const u = (x / w) * 2 - 1; return 1 - hs[i]! * (1 - u * u); }
      x -= w;
    }
    return 1;
  };
  return make(fn, toLinear(fn, 80));
}

const r = (n: number): number => Math.round(n * 1000) / 1000;
/** Sample `fn` into a CSS linear() easing (points that a straight line already covers are dropped). */
export function toLinear(fn: (t: number) => number, points = 48): string {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i <= points; i++) { xs.push(i / points); ys.push(r(fn(i / points))); }
  const keep: number[] = [0];
  for (let i = 1; i < points; i++) {
    const a = keep[keep.length - 1]!, b = i + 1;
    const y = ys[a]! + ((ys[b]! - ys[a]!) * (xs[i]! - xs[a]!)) / (xs[b]! - xs[a]!);
    if (Math.abs(y - ys[i]!) > 0.002) keep.push(i);
  }
  keep.push(points);
  return `linear(${keep.map((i, j) => (j === 0 || j === keep.length - 1 ? `${ys[i]}` : `${ys[i]} ${r(xs[i]! * 100)}%`)).join(", ")})`;
}

/** Missing offsets: the first is 0, the last 1 (a single frame is the end), the rest spread evenly between known ones. */
export function spread(o: (number | null)[]): number[] {
  const n = o.length;
  if (n === 1) return [o[0] ?? 1];
  const r = o.slice();
  if (r[0] == null) r[0] = 0;
  if (r[n - 1] == null) r[n - 1] = 1;
  for (let i = 1; i < n; i++) {
    if (r[i] != null) continue;
    let j = i; while (r[j] == null) j++;
    const a = r[i - 1]!, b = r[j]!;
    for (let k = i; k < j; k++) r[k] = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  return r as number[];
}

/** Parse a CSS linear() easing into a function (for JS targets). */
function parseLinear(s: string): Ease | null {
  const body = /^linear\((.*)\)$/.exec(s.trim())?.[1];
  if (!body) return null;
  const parts = body.split(",").map((p) => p.trim().split(/\s+/));
  const ys = parts.map((p) => parseFloat(p[0]!)), xs = spread(parts.map((p) => (p[1] ? parseFloat(p[1]) / 100 : null)));
  if (ys.length < 2 || ys.some((y) => !Number.isFinite(y))) return null;
  return make((t) => {
    let i = 1;
    while (i < xs.length - 1 && t > xs[i]!) i++;
    const x0 = xs[i - 1]!, x1 = xs[i]!, y0 = ys[i - 1]!, y1 = ys[i]!;
    return t <= x0 ? y0 : t >= x1 ? y1 : y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  }, s.trim());
}

// ---- registry: names match the CSS tokens (--m-ease-out → "out"); the older camelCase names keep working
type Def = Ease | (() => Ease);
const REG = new Map<string, Def>();
const cache = new Map<string, Ease>();
/** Register a named easing: a function, a CSS easing string, or an Ease. Themes and apps can add their own. */
export function defineEasing(name: string, def: EaseInput | (() => Ease)): void {
  cache.delete(name);
  if (typeof def === "string") { const s = def; REG.set(name, () => parse(s) ?? linear); }
  else if (isEase(def)) REG.set(name, def);
  else if (def.length === 0) REG.set(name, def as () => Ease);
  else { const f = def as (t: number) => number; REG.set(name, make(f, null)); }
}
const BASE: Record<string, string> = {
  in: "cubic-bezier(.32,0,.67,0)", out: "cubic-bezier(.33,1,.68,1)", "in-out": "cubic-bezier(.65,0,.35,1)",
  back: "cubic-bezier(.34,1.56,.64,1)", expo: "cubic-bezier(.16,1,.3,1)",
  ease: "cubic-bezier(.25,.1,.25,1)", "ease-in": "cubic-bezier(.42,0,1,1)", "ease-out": "cubic-bezier(0,0,.58,1)", "ease-in-out": "cubic-bezier(.42,0,.58,1)",
  easeOutQuart: "cubic-bezier(.25,1,.5,1)",
};
// older camelCase names (march/motion easing.ts) → token names
const ALIAS: Record<string, string> = { easeInCubic: "in", easeOutCubic: "out", easeInOutCubic: "in-out", easeOutExpo: "expo", easeOutBack: "back", easeOutBounce: "bounce", easeOutElastic: "elastic" };
for (const [k, v] of Object.entries(BASE)) defineEasing(k, v);
defineEasing("linear", linear);
defineEasing("spring", () => springEase());
defineEasing("spring-soft", () => springEase({ stiffness: 120, damping: 14 }));
defineEasing("spring-snappy", () => springEase({ stiffness: 380, damping: 30 }));
defineEasing("spring-wobbly", () => springEase({ stiffness: 180, damping: 9 }));
defineEasing("bounce", () => bounceEase());
defineEasing("elastic", () => springEase({ stiffness: 260, damping: 7 }));

/** Names of every registered easing (for pickers). */
export const easingNames = (): string[] => [...REG.keys()];

/** A number inside CSS text (shared with tracks.ts). */
export const NUM = /-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi;
const nums = (s: string): number[] => (s.match(NUM) ?? []).map(Number);
function parse(s: string): Ease | null {
  const t = s.trim();
  if (t.startsWith("cubic-bezier(")) { const [a, b, c, d] = nums(t); return a != null && b != null && c != null && d != null ? cubicBezier(a, b, c, d) : null; }
  if (t.startsWith("steps(")) { const n = nums(t)[0] ?? 1; const pos = /,\s*([a-z-]+)/.exec(t)?.[1] as Parameters<typeof steps>[1] | undefined; return steps(n, pos ?? "end"); }
  if (t === "step-start") return steps(1, "start");
  if (t === "step-end") return steps(1, "end");
  if (t.startsWith("spring(")) { const [k, c, m, v] = nums(t); return springEase({ stiffness: k ?? 170, damping: c ?? 26, mass: m ?? 1, velocity: v ?? 0 }); }
  if (t.startsWith("bounce(")) { const [n, d] = nums(t); return bounceEase(n ?? 3, d ?? 0.35); }
  if (t.startsWith("linear(")) return parseLinear(t);
  return null;
}

/** Resolve any easing input to an Ease (unknown names fall back to `fallback`). */
export function ease(input: EaseInput | null | undefined, fallback: EaseInput = "out"): Ease {
  if (input == null || input === "") return input === fallback ? linear : ease(fallback, "linear");
  if (isEase(input)) return input;
  if (typeof input === "function") return make(input, null);
  const raw = input.startsWith("--m-ease-") ? input.slice(9) : input.startsWith("var(--m-ease-") ? input.slice(13, -1) : input;
  const key = ALIAS[raw] ?? raw;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = REG.get(key);
  const e = def ? (isEase(def) ? def : def()) : parse(key);
  if (!e) return input === fallback ? linear : ease(fallback, "linear");
  cache.set(key, e);
  return e;
}

let linearOk: boolean | null = null;
/** True when the browser runs CSS linear() easings (springs and bounces then stay native). */
export function supportsLinear(): boolean {
  if (linearOk == null) linearOk = !!globalThis.CSS?.supports?.("animation-timing-function", "linear(0, 1)");
  return linearOk;
}
/** CSS easing for native playback, or null when the browser cannot run it natively. */
export function cssOf(e: Ease): string | null {
  if (!e.css) return null;
  // no linear(): keep it native with a close cubic-bezier
  if (e.css.startsWith("linear(") && !supportsLinear()) return cssFallback(e);
  return e.css;
}
/** A cubic-bezier close to the easing, for browsers without linear() (overshooting curves get the "back" shape). */
export function cssFallback(e: Ease): string {
  if (e.css && !e.css.startsWith("linear(")) return e.css;
  return e(0.5) > 0.9 || e(0.75) > 1 ? "cubic-bezier(.34,1.56,.64,1)" : "cubic-bezier(.33,1,.68,1)";
}
