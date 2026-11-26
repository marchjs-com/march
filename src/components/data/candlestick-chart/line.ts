// A keyed line tween: points are matched by their x (a key), so a line whose window slides keeps each point's value
// and only the new points move in. Plays on the motion engine (motionOf / animateValue); reduced motion jumps.
// (Candidate for src/charts/motion.ts: a same-length array tween misaligns a sliding window.)
import { signal, untrack, effect, onCleanup } from "../../../core/reactive.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { motionOf, type AnimateProp } from "../../../charts/motion.ts";

/** A line in data space: x keys (ms or numbers) and values (null = gap). */
export interface KeyedLine { x: readonly number[]; y: readonly (number | null)[] }

/**
 * Shown line for `target()`: a point that was drawn keeps its value and moves to the new one, a new point starts from
 * the nearest drawn value on its left (the line grows out of itself), and the first drawing rises from the flat mean.
 */
export function keyedLine(target: () => KeyedLine, how: () => AnimateProp, key: string): () => KeyedLine {
  const flat = (l: KeyedLine): KeyedLine => {
    const v = l.y.filter((y): y is number => y != null), m = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    return { x: l.x, y: l.y.map((y) => (y == null ? null : m)) };
  };
  const first = untrack(target);
  const enter = untrack(() => motionOf(how(), { index: 0, key, phase: "enter" }));
  const shown = signal<KeyedLine>(enter && !reducedMotion() ? flat(first) : first);
  let run: { cancel(): void } | null = null, entering = !!enter;
  effect(() => {
    const to = target(), cur = untrack(shown);
    const m = untrack(() => motionOf(how(), { index: 0, key, phase: entering ? "enter" : "update" }));
    entering = false;
    run?.cancel(); run = null;
    const at = new Map<number, number | null>();
    cur.x.forEach((x, i) => at.set(x, cur.y[i] ?? null));
    let last: number | null = null;
    const from = to.x.map((x, i) => {
      if (at.has(x)) { const v = at.get(x) ?? null; if (v != null) last = v; return v ?? to.y[i] ?? null; }
      return to.y[i] == null ? null : last ?? to.y[i] ?? null;
    });
    if (!m || reducedMotion() || from.every((v, i) => v === to.y[i])) return void shown.set(to);
    shown.set({ x: to.x, y: from });
    run = untrack(() => animateValue(0, 1, { easing: m.easing, ...(m.duration != null ? { duration: m.duration } : {}), delay: m.delay,
      onUpdate: (t: number) => shown.set({ x: to.x, y: to.y.map((v, i) => { const a = from[i]; return v == null || a == null ? v : a + (v - a) * t; }) }),
      onComplete: () => shown.set(to) }));
  });
  onCleanup(() => run?.cancel());
  return shown;
}

/** Simple moving average of `n` values (null until n values have been seen). */
export function sma(vals: readonly number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  vals.forEach((v, i) => { sum += v; if (i >= n) sum -= vals[i - n] as number; out.push(i >= n - 1 ? sum / n : null); });
  return out;
}
