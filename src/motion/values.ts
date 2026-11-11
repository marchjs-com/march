// Animated values: tween() and spring() follow a source signal smoothly and are signals themselves (bind them in JSX).
//   const $x = spring(() => $target, { stiffness: 170, damping: 26 });   <div style={{ transform: `translateX(${$x}px)` }} />
import { signal, effect, untrack, onCleanup } from "../core/reactive.ts";
import { frame, now, reducedMotion } from "./env.ts";
import { resolveEasing, type Easing } from "./easing.ts";

export type Animatable = number | number[];
export interface Animated<T extends Animatable> { (): T; peek(): T; /** True while moving. */ moving(): boolean; /** Jump without animating. */ snap(v: T): void }

interface RawSignal<T> { (): T; peek(): T; set(v: T): T }
const mk = <T>(v: T): RawSignal<T> => signal(v) as unknown as RawSignal<T>;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix = <T extends Animatable>(a: T, b: T, t: number): T =>
  (Array.isArray(a) && Array.isArray(b) ? b.map((x, i) => lerp(a[i] ?? x, x, t)) : lerp(a as number, b as number, t)) as T;

export interface TweenOptions { duration?: number; delay?: number; easing?: string | Easing }

/** Smoothly animate toward `source()` whenever it changes (duration-based). */
export function tween<T extends Animatable>(source: () => T, opts: TweenOptions = {}): Animated<T> {
  const out = mk<T>(untrack(source));
  const moving = mk(false);
  const ease = resolveEasing(opts.easing);
  effect(() => {
    const target = source();
    const from = out.peek();
    const dur = reducedMotion() ? 0 : opts.duration ?? 300;
    if (dur <= 0) { out.set(target); return; }
    const start = now() + (opts.delay ?? 0);
    let cancel = (): void => {};
    moving.set(true);
    const step = (t: number): void => {
      const p = Math.min(1, Math.max(0, (t - start) / dur));
      out.set(mix(from, target, ease(p)));
      if (p < 1) cancel = frame(step); else moving.set(false);
    };
    cancel = frame(step);
    onCleanup(() => cancel());
  });
  const a = (() => out()) as Animated<T>;
  a.peek = () => out.peek();
  a.moving = () => moving();
  a.snap = (v) => { out.set(v); };
  return a;
}

export interface SpringOptions { stiffness?: number; damping?: number; mass?: number; precision?: number }

/** Physics spring toward `source()` (velocity carries across target changes — feels natural for drags). */
export function spring<T extends Animatable>(source: () => T, opts: SpringOptions = {}): Animated<T> {
  const k = opts.stiffness ?? 170, c = opts.damping ?? 26, m = opts.mass ?? 1, eps = opts.precision ?? 0.01;
  const init = untrack(source);
  const out = mk<T>(init);
  const moving = mk(false);
  let vel: number[] = (Array.isArray(init) ? init : [init]).map(() => 0);
  let cancel = (): void => {};
  let last = 0;
  effect(() => {
    const target = source();
    const tgt = Array.isArray(target) ? target : [target];
    if (reducedMotion()) { cancel(); out.set(target); vel = tgt.map(() => 0); return; }
    cancel();
    moving.set(true);
    last = now();
    const step = (t: number): void => {
      const dt = Math.min(0.064, Math.max(0.001, (t - last) / 1000));
      last = t;
      const curArr = (() => { const v = out.peek(); return Array.isArray(v) ? v : [v]; })();
      let done = true;
      const next = curArr.map((x, i) => {
        const goal = tgt[i] ?? x;
        const v = vel[i] ?? 0;
        const a = (-k * (x - goal) - c * v) / m;
        const nv = v + a * dt;
        const nx = x + nv * dt;
        vel[i] = nv;
        if (Math.abs(nv) > eps || Math.abs(nx - goal) > eps) done = false;
        return done ? nx : nx;
      });
      if (done) { out.set(target); vel = tgt.map(() => 0); moving.set(false); return; }
      out.set((Array.isArray(target) ? next : next[0]) as T);
      cancel = frame(step);
    };
    cancel = frame(step);
  });
  onCleanup(() => cancel());
  const a = (() => out()) as Animated<T>;
  a.peek = () => out.peek();
  a.moving = () => moving();
  a.snap = (v) => { cancel(); out.set(v); vel = (Array.isArray(v) ? v : [v]).map(() => 0); moving.set(false); };
  return a;
}
