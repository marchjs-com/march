// animate(): compatibility entry over the motion engine (engine/playback.ts). One engine for every animation:
// WAAPI first (compositor-friendly transform/opacity), the shared clock where WAAPI cannot run it, global speed /
// pause / reduced motion everywhere. The returned Playback is a superset of the old Controls.
import { animate as engineAnimate, stagger as engineStagger, type AnimateOptions as EngineOptions, type Playback } from "./engine/playback.ts";
import type { Easing } from "./easing.ts";

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

/** Animate an element (or any engine target). Returns a Playback; `finished` resolves when done or cancelled. */
export function animate(el: Element, frames: Frames | string, opts: AnimateOptions & EngineOptions = {}): Playback {
  const p = engineAnimate(el, frames as never, opts);
  // as before: an element without WAAPI (no renderer, e.g. tests) gets its final state at once
  if (typeof (el as HTMLElement).animate !== "function" && !opts.js) p.finish();
  return p;
}

/** Stagger helper: delay for item i (ms). `from`: "start" | "end" | "center" | "edges" | index. */
export function stagger(each = 40, o: Parameters<typeof engineStagger>[1] = {}): (i: number, total?: number) => number {
  const f = engineStagger(each, o);
  return (i: number, total = o.total ?? 0) => f(i, total);
}
