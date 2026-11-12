// Animated values: tween() and spring() follow a source signal smoothly and are signals themselves (bind them in JSX).
//   const $x = spring(() => $target, { stiffness: 170, damping: 26 });   <div style={{ transform: `translateX(${$x}px)` }} />
// Compatibility layer over the engine's track() (engine/value.ts): same clock, global speed and pause.
import { track } from "./engine/value.ts";
import type { Easing } from "./easing.ts";

export type Animatable = number | number[];
export interface Animated<T extends Animatable> { (): T; peek(): T; /** True while moving. */ moving(): boolean; /** Jump without animating. */ snap(v: T): void }

export interface TweenOptions { duration?: number; delay?: number; easing?: string | Easing }

/** Smoothly animate toward `source()` whenever it changes (duration-based). */
export function tween<T extends Animatable>(source: () => T, opts: TweenOptions = {}): Animated<T> {
  return track(source, { duration: opts.duration ?? 300, ...(opts.delay != null ? { delay: opts.delay } : {}), easing: opts.easing ?? "easeOutCubic" });
}

export interface SpringOptions { stiffness?: number; damping?: number; mass?: number; precision?: number }

/** Physics spring toward `source()` (velocity carries across target changes — feels natural for drags). */
export function spring<T extends Animatable>(source: () => T, opts: SpringOptions = {}): Animated<T> {
  return track(source, { spring: opts });
}
