// animate(): Web Animations API first (compositor-friendly transform/opacity), CSSOM fallback where WAAPI is missing.
// Honors prefers-reduced-motion: animations become (almost) instant and end in the final state.
import { reducedMotion, setStyle } from "./env.ts";
import { cssEasing, type Easing } from "./easing.ts";

export type Frames = Keyframe[] | PropertyIndexedKeyframes;
export interface AnimateOptions {
  duration?: number;
  delay?: number;
  easing?: string | Easing;
  fill?: FillMode;
  iterations?: number;
  direction?: PlaybackDirection;
  /** Keep running even with reduced motion (e.g. a progress indicator). */
  essential?: boolean;
}
export interface Controls {
  readonly finished: Promise<void>;
  readonly animation: Animation | null;
  play(): void;
  pause(): void;
  reverse(): void;
  cancel(): void;
  seek(ms: number): void;
}

function lastFrame(frames: Frames): Record<string, string | number | null> {
  if (Array.isArray(frames)) {
    const f = frames[frames.length - 1] ?? {};
    const out: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(f)) if (k !== "offset" && k !== "easing" && k !== "composite" && (typeof v === "string" || typeof v === "number")) out[k] = v;
    return out;
  }
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(frames)) {
    if (k === "offset" || k === "easing" || k === "composite") continue;
    const val = Array.isArray(v) ? v[v.length - 1] : v;
    if (typeof val === "string" || typeof val === "number") out[k] = val;
  }
  return out;
}

/** Animate an element. Returns controls; `finished` resolves when done (or immediately when not animatable). */
export function animate(el: Element, frames: Frames, opts: AnimateOptions = {}): Controls {
  const reduce = reducedMotion() && !opts.essential;
  const duration = reduce ? 1 : opts.duration ?? 240;
  const can = typeof (el as HTMLElement).animate === "function";
  if (!can) {
    setStyle(el, lastFrame(frames));
    const done = Promise.resolve();
    return { finished: done, animation: null, play() {}, pause() {}, reverse() {}, cancel() {}, seek() {} };
  }
  const a = (el as HTMLElement).animate(frames, {
    duration, delay: reduce ? 0 : opts.delay ?? 0, easing: cssEasing(opts.easing), fill: opts.fill ?? "both",
    iterations: reduce ? 1 : opts.iterations ?? 1, direction: opts.direction ?? "normal",
  });
  const finished = a.finished.then(() => undefined, () => undefined);
  return {
    finished, animation: a,
    play: () => a.play(), pause: () => a.pause(), reverse: () => a.reverse(), cancel: () => a.cancel(),
    seek: (ms: number) => { a.currentTime = ms; },
  };
}

/** Stagger helper: delay for item i (ms). `from`: "start" | "end" | "center" | index. */
export function stagger(each = 40, { from = "start", total }: { from?: "start" | "end" | "center" | number; total?: number } = {}): (i: number) => number {
  return (i: number) => {
    const n = total ?? 0;
    const origin = from === "start" ? 0 : from === "end" ? Math.max(0, n - 1) : from === "center" ? (n - 1) / 2 : from;
    return Math.abs(i - origin) * each;
  };
}
