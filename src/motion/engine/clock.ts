// The one clock: a single requestAnimationFrame loop shared by every animation (JS tweens, timelines, springs,
// canvas / WebGL drawing). Each frame runs four phases in order — read (measure), update (compute), write (DOM),
// render (canvas / WebGL draw) — so reads never interleave with writes (no layout thrashing).
// Time is scaled by the global speed and stops while motion is paused; the loop sleeps when nothing needs it and
// the browser stops it in background tabs.
import { timeScale, onConfig } from "./config.ts";

export type Phase = "read" | "update" | "write" | "render";
export type FrameFn = (time: number, dt: number) => void;
const PHASE: Record<Phase, number> = { read: 0, update: 1, write: 2, render: 3 };

const loops: Set<FrameFn>[] = [new Set(), new Set(), new Set(), new Set()];
const always: Set<FrameFn>[] = [new Set(), new Set(), new Set(), new Set()];
const once: FrameFn[][] = [[], [], [], []];
let T = 0, last = -1, scheduled: unknown = 0, manual = false, frameNo = 0;

const perf = (): number => (globalThis.performance?.now?.() ?? Date.now());
/** Clock time in ms: advances with the global speed, frozen while paused. Every engine animation measures time with it. */
export const now = (): number => T;
/** Frames run since start (for tests and monitors). */
export const frameCount = (): number => frameNo;

function pending(): boolean {
  if (once[0]!.length || once[1]!.length || once[2]!.length || once[3]!.length) return true;
  for (let p = 0; p < 4; p++) if (always[p]!.size) return true;
  if (timeScale() > 0) for (let p = 0; p < 4; p++) if (loops[p]!.size) return true;
  return false;
}
function schedule(): void {
  if (scheduled || manual) return;
  if (last < 0) last = perf();
  const raf = globalThis.requestAnimationFrame;
  scheduled = typeof raf === "function" ? raf(() => tick()) : setTimeout(() => tick(), 16);
}
function call(fn: FrameFn, dt: number): void {
  try { fn(T, dt); } catch (e) { globalThis.console?.error?.(e); }
}
function tick(rawOverride?: number): void {
  scheduled = 0;
  const t = perf();
  const raw = rawOverride ?? (last < 0 ? 0 : Math.max(0, t - last));
  last = t;
  const scale = timeScale();
  const dt = raw * scale;
  T += dt;
  frameNo++;
  for (let p = 0; p < 4; p++) {
    // one-shot work queued during an earlier phase of this frame runs in this frame (write → render)
    const q = once[p]!;
    if (q.length) { once[p] = []; for (const fn of q) call(fn, dt); }
    for (const fn of always[p]!) call(fn, raw);
    if (scale > 0) for (const fn of loops[p]!) call(fn, dt);
  }
  if (pending()) schedule(); else last = -1;
}
// resuming after a pause or a speed change from 0: start again without counting the paused gap
onConfig(() => { if (!scheduled) last = -1; if (pending()) schedule(); });

export interface FrameOptions {
  phase?: Phase;
  /** Keeps running while motion is paused, with real (unscaled) time: monitors, scroll measuring. */
  essential?: boolean;
}
/** Run `fn(time, dt)` every frame until the returned function is called. */
export function onFrame(fn: FrameFn, o: FrameOptions = {}): () => void {
  const set = (o.essential ? always : loops)[PHASE[o.phase ?? "update"]]!;
  set.add(fn);
  schedule();
  return () => { set.delete(fn); };
}
/** Run `fn` once on the next frame (in the given phase). Returns a cancel function. */
export function nextFrame(fn: FrameFn, phase: Phase = "update"): () => void {
  let live = true;
  const wrap: FrameFn = (t, dt) => { if (live) fn(t, dt); };
  once[PHASE[phase]]!.push(wrap);
  schedule();
  return () => { live = false; };
}
/** Batch a DOM read into the next frame's read phase (before any write). */
export const measure = (fn: () => void): (() => void) => nextFrame(fn, "read");
/** Batch a DOM write into the next frame's write phase (after every read). */
export const mutate = (fn: () => void): (() => void) => nextFrame(fn, "write");

/** Give the main thread back (scheduler.yield where available): long setup work stays under the 50 ms long-task line. */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof s?.yield === "function") return s.yield();
  return new Promise((r) => setTimeout(r, 0));
}

/** Tests: drive the clock by hand. `manualClock(true)` stops the real loop; `step(ms)` runs one frame of `ms`. */
export function manualClock(on: boolean): void { manual = on; if (!on && pending()) schedule(); }
export function step(ms = 16): void { tick(ms); }
