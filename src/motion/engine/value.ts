// Values without a target: animateValue() plays one value (number, vector, color, CSS string) and reports it;
// track() follows a reactive source smoothly — duration-based or as a physical spring — and is a signal itself.
//   animateValue(0, 100, { duration: 600, onUpdate: (v) => (label.textContent = v.toFixed(0)) })
//   const $x = track(() => $target, { spring: { stiffness: 200, damping: 20 } })
import { signal, effect, untrack, onCleanup } from "../../core/reactive.ts";
import { onFrame } from "./clock.ts";
import { reducedMotion } from "./prefs.ts";
import { animate, type AnimateOptions, type Playback } from "./playback.ts";
import type { SpringOptions } from "./ease.ts";

export type Animatable = number | number[] | string;

/** Play one value from → to; `onUpdate(value)` every frame. Arrays are filled in place (no allocation). */
export function animateValue<T extends Animatable>(from: T, to: T, opts: AnimateOptions & { onUpdate?: (v: T) => void } = {}): Playback {
  const box: { v: unknown } = { v: Array.isArray(from) ? from.slice() : from };
  const { onUpdate, ...rest } = opts;
  return animate(box, { v: [Array.isArray(from) ? [...from] : from, Array.isArray(to) ? [...to] : to] }, { ...rest, js: true, onUpdate: () => onUpdate?.(box.v as T) });
}

export interface TrackOptions extends Omit<AnimateOptions, "onUpdate"> {
  /** Follow with a spring (velocity carries across target changes) instead of a timed tween. */
  spring?: SpringOptions & { precision?: number } | boolean;
}
export interface Tracked<T> { (): T; peek(): T; /** True while moving. */ moving(): boolean; /** Jump without animating. */ snap(v: T): void }

/** A signal that follows `source()` smoothly. Cleans up with the current owner. */
export function track<T extends number | number[]>(source: () => T, opts: TrackOptions = {}): Tracked<T> {
  const init = untrack(source);
  const vec = Array.isArray(init);
  const out = signal<T>(vec ? ([...(init as number[])] as T) : init, { equals: false });
  const moving = signal(false);
  const n = vec ? (init as number[]).length : 1;
  const pos = new Float64Array(n), vel = new Float64Array(n), goal = new Float64Array(n);
  const load = (v: T, into: Float64Array): void => { if (Array.isArray(v)) for (let i = 0; i < n; i++) into[i] = v[i] ?? 0; else into[0] = v as number; };
  load(init, pos);
  const publish = (): void => {
    if (vec) { const a = out.peek() as number[]; for (let i = 0; i < n; i++) a[i] = pos[i]!; out.set(a as T); }
    else out.set(pos[0]! as T);
  };
  let stop: (() => void) | null = null;
  let tween: Playback | null = null;
  const halt = (): void => { stop?.(); stop = null; tween?.cancel(); tween = null; };

  const sp = opts.spring ? (opts.spring === true ? {} : opts.spring) : null;
  const k = sp?.stiffness ?? 170, c = sp?.damping ?? 26, m = sp?.mass ?? 1, eps = sp?.precision ?? 0.01;
  const stepSpring = (_: number, dt: number): void => {
    let left = Math.min(dt / 1000, 1);
    let done = true;
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      for (let i = 0; i < n; i++) {
        const a = (-k * (pos[i]! - goal[i]!) - c * vel[i]!) / m;
        vel[i] = vel[i]! + a * h;
        pos[i] = pos[i]! + vel[i]! * h;
      }
    }
    for (let i = 0; i < n; i++) if (Math.abs(vel[i]!) > eps || Math.abs(pos[i]! - goal[i]!) > eps) done = false;
    if (done) { pos.set(goal); vel.fill(0); stop?.(); stop = null; moving.set(false); }
    publish();
  };

  effect(() => {
    const target = source();
    load(target, goal);
    if (reducedMotion()) { halt(); pos.set(goal); vel.fill(0); publish(); moving.set(false); return; }
    moving.set(true);
    if (sp) { if (!stop) stop = onFrame(stepSpring, { phase: "update" }); return; }
    tween?.cancel();
    const from = Array.from(pos), to = Array.from(goal);
    tween = animateValue(vec ? from : from[0]!, vec ? to : to[0]!, {
      ...opts, onUpdate: (v) => { if (typeof v === "number") pos[0] = v; else load(v as T, pos); publish(); },
    });
    const me = tween;
    void me.finished.then(() => { if (tween === me) { moving.set(false); tween = null; } });
  });
  onCleanup(halt);
  const a = (() => out()) as Tracked<T>;
  a.peek = () => out.peek();
  a.moving = () => moving();
  a.snap = (v) => { halt(); load(v, pos); load(v, goal); vel.fill(0); publish(); moving.set(false); };
  return a;
}
