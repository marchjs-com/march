// Chart motion: the `animate` prop every chart takes, the tween a mark is drawn with, and presence (marks that leave
// stay until their exit has played). Everything runs on the motion engine (animateValue: one clock, global speed /
// pause, reduced motion); a chart never owns a frame loop.
import { signal, untrack, effect, onCleanup } from "../core/reactive.ts";
import { animateValue } from "../motion/engine/value.ts";
import { reducedMotion } from "../motion/env.ts";
import { later, clamp } from "../core/util.ts";
import { ease } from "../motion/engine/ease.ts";

/** Where a mark is in its life: drawn for the first time, moving to new data, or leaving. */
export type MotionPhase = "enter" | "update" | "exit";
/** What a chart passes to an `animate` function: the mark's place and phase. */
export interface MotionContext { index: number; key: string; phase: MotionPhase }
/** Fine control of a chart's change animations. */
export interface AnimateOptions {
  /** Length in ms (default: the easing's own; springs settle by themselves, 600 ms otherwise). */
  duration?: number;
  /** Easing name or token: "spring" (default), "out", "in-out", "bounce", "spring-wobbly", "--m-ease-expo"… */
  easing?: string;
  /** Delay between marks in ms (bar after bar, slice after slice; default 0). */
  stagger?: number;
  /** Delay before the first mark in ms (default 0). */
  delay?: number;
  /** Marks grow in when first drawn (default true). */
  enter?: boolean;
  /** Marks move to new data (default true). */
  update?: boolean;
  /** Marks that leave shrink away before they are removed (default true). */
  exit?: boolean;
}
/**
 * A chart's `animate` prop: `true` (default: a spring), `false` (still), an easing name, options, or a function
 * `({ index, key, phase }) => options | easing | boolean` deciding per mark.
 */
export type AnimateProp = boolean | string | AnimateOptions | ((ctx: MotionContext) => boolean | string | AnimateOptions | null | undefined) | null | undefined;

/** Read an `animate` prop: a function of no arguments is a reactive accessor (a signal, a compiled `{$x}`), one that
 * takes the mark context is the per-mark form and is kept as it is. */
export const animateOf = (p: AnimateProp | (() => AnimateProp)): AnimateProp => (typeof p === "function" && p.length === 0 ? (p as () => AnimateProp)() : (p as AnimateProp));

/** The timing one mark's change plays with, or null (jump). */
export interface MarkMotion { easing: string; duration?: number | undefined; delay: number }

const DUR = 600;
/** Resolve `animate` for one mark. `undefined` counts as on (charts animate by default); reduced motion → null. */
export function motionOf(prop: AnimateProp, ctx: MotionContext): MarkMotion | null {
  if (prop === false || prop === null) return null;
  let v = typeof prop === "function" ? prop(ctx) : prop;
  if (v === undefined) v = true;
  if (!v) return null;
  const o: AnimateOptions = v === true ? {} : typeof v === "string" ? { easing: v } : v;
  if (o[ctx.phase] === false) return null;
  const easing = o.easing ?? "spring";
  const timed = !/spring|bounce/.test(easing) || o.duration != null;
  return { easing, duration: timed ? (o.duration ?? DUR) : undefined, delay: (o.delay ?? 0) + (o.stagger ?? 0) * Math.max(0, ctx.index) };
}
/** Is the chart animated at all (for parts that only switch a CSS transition on or off)? */
export const animated = (prop: AnimateProp): boolean => prop !== false && prop !== null && !reducedMotion();

type Lerpable = number | readonly number[];
const lerp = (a: unknown, b: unknown, t: number): unknown => {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * t;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return b.map((x: number, i) => (a[i] as number) + (x - (a[i] as number)) * t);
  return b;
};
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

export interface TweenOptions {
  /** The mark's place among its siblings (stagger). */
  index?: () => number;
  /** The mark's key (passed to an `animate` function). */
  key?: string;
  /** True while the mark is leaving: plays the "exit" phase. */
  leaving?: () => boolean;
  /** Called when the mark has reached its target (after an exit: remove it now). */
  onSettle?: () => void;
}
/**
 * The shape a mark is drawn with: the target at once, or (animated) a tween of the numeric `keys` (numbers, or number
 * arrays of the same length) from what is drawn now. `first(to)` is where a new mark starts (its entrance; without it
 * a mark appears in place). Honours reduced motion; plays on the engine clock.
 */
export function tween<T extends object>(target: () => T, keys: readonly (keyof T)[], how: () => AnimateProp, first?: (to: T) => T, opts: TweenOptions = {}): () => T {
  let phase: MotionPhase = "enter";
  const initial = untrack(target);
  const m0 = first ? untrack(() => motionOf(how(), { index: opts.index?.() ?? 0, key: opts.key ?? "", phase: "enter" })) : null;
  const shown = signal(m0 && !reducedMotion() ? first!(initial) : initial);
  let run: { cancel(): void } | null = null;
  effect(() => {
    const to = target(), from = untrack(shown);
    const ph: MotionPhase = opts.leaving?.() ? "exit" : phase;
    phase = "update";
    const m = untrack(() => motionOf(how(), { index: opts.index?.() ?? 0, key: opts.key ?? "", phase: ph }));
    run?.cancel(); run = null;
    if (!m || reducedMotion() || keys.every((k) => same(from[k], to[k]))) { shown.set(to); return void (ph === "exit" && opts.onSettle?.()); }
    run = untrack(() => animateValue(0, 1, { easing: m.easing, ...(m.duration != null ? { duration: m.duration } : {}), delay: m.delay, onUpdate: (t: number) => {
      const o = { ...to } as Record<keyof T, unknown>;
      for (const k of keys) o[k] = lerp(from[k], to[k], t);
      shown.set(o as T);
    }, onComplete: () => { shown.set(to); opts.onSettle?.(); } }));
  });
  onCleanup(() => run?.cancel());
  return shown;
}

/** An item of a presence list: the data item and whether it is leaving. */
export type Present<T> = T & { leaving?: boolean };
/**
 * Keyed presence: the current items plus the ones that just left (marked `leaving`, in their old place) until
 * `done(key)` is called (a mark's tween calls it when its exit has played) or a fallback time passes. Without
 * animation, leaving items go at once.
 */
export function presence<T extends object>(list: () => readonly T[], key: (t: T) => string, how: () => AnimateProp): { items: () => readonly Present<T>[]; done: (k: string) => void } {
  const out = signal<readonly Present<T>[]>(untrack(list));
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const drop = (k: string): void => { clearTimeout(timers.get(k)); timers.delete(k); out.set(out.peek().filter((x) => !(x.leaving && key(x) === k))); };
  effect(() => {
    const next = list(), prev = untrack(out);
    const anim = untrack(() => animated(how()) && motionOf(how(), { index: 0, key: "", phase: "exit" }) != null);
    const keep = new Set(next.map(key));
    const merged: Present<T>[] = next.slice();
    if (anim) prev.forEach((p, i) => {
      const k = key(p);
      if (keep.has(k)) return;
      const left: Present<T> = p.leaving ? p : { ...p, leaving: true };
      merged.splice(Math.min(i, merged.length), 0, left);
      if (!timers.has(k)) timers.set(k, later(() => drop(k), 2500));
    });
    out.set(merged);
  });
  onCleanup(() => { for (const t of timers.values()) clearTimeout(t); });
  return { items: out, done: drop };
}

export type { Lerpable };

/**
 * One engine playback for many marks: each mark's eased progress (its own easing, duration and stagger delay from
 * `animate`), handed over once per frame as `progress(i)`. Returns null when nothing animates (then the caller jumps).
 */
export function playMarks(n: number, how: AnimateProp, phase: MotionPhase, keyOf: (i: number) => string, onUpdate: (progress: (i: number) => number) => void): { cancel(): void } | null {
  if (reducedMotion()) return null;
  const plan: ({ e: (t: number) => number; d: number; at: number } | null)[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const m = motionOf(how, { index: i, key: keyOf(i), phase });
    if (!m) { plan.push(null); continue; }
    const e = ease(m.easing), d = m.duration ?? e.duration ?? DUR;
    plan.push({ e, d, at: m.delay });
    total = Math.max(total, m.delay + d);
  }
  if (!total) return null;
  const progress = (ms: number) => (i: number): number => { const q = plan[i]; return q ? (ms <= q.at ? 0 : ms >= q.at + q.d ? 1 : q.e(clamp((ms - q.at) / q.d, 0, 1))) : 1; };
  onUpdate(progress(0));
  return animateValue(0, total, { easing: "linear", duration: total, onUpdate: (ms: number) => onUpdate(progress(ms)), onComplete: () => onUpdate(() => 1) });
}
