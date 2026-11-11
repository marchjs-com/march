// Timelines: choreograph many animations, then control them as one (play, pause, reverse, seek, progress).
//   const tl = timeline({ defaults: { duration: 400, easing: "easeOutExpo" } })
//     .add(".title", [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }])
//     .add(".card", fadeUp, { stagger: 60, at: "-=200" })
//   tl.play()
import { signal } from "../core/reactive.js";
import { animate, stagger as staggerFn, type AnimateOptions, type Controls, type Frames } from "./animate.ts";
import { frame } from "./env.ts";

export type Target = Element | Element[] | NodeListOf<Element> | string;
export interface StepOptions extends AnimateOptions {
  /** Start time: ms, "+=ms" / "-=ms" relative to the previous end, "<" with the previous start. */
  at?: number | string;
  /** Delay between targets (ms) or a function of the index. */
  stagger?: number | ((i: number) => number);
}
interface Step { el: Element; frames: Frames; opts: AnimateOptions; start: number; end: number }
export interface Timeline {
  add(target: Target, frames: Frames, opts?: StepOptions): Timeline;
  play(): Promise<void>;
  pause(): void;
  reverse(): void;
  seek(ms: number): void;
  cancel(): void;
  readonly duration: number;
  /** 0..1 while playing (signal). */
  progress(): number;
}

const resolve = (t: Target, root: ParentNode): Element[] =>
  typeof t === "string" ? [...root.querySelectorAll(t)] : t instanceof Element ? [t] : [...t];

export function timeline({ defaults = {}, root }: { defaults?: AnimateOptions; root?: ParentNode } = {}): Timeline {
  const steps: Step[] = [];
  let lastStart = 0, lastEnd = 0;
  let running: Controls[] = [];
  const progress = signal(0) as unknown as { (): number; set(v: number): number };
  let stopTick = (): void => {};

  const tl: Timeline = {
    add(target, frames, opts = {}) {
      const els = resolve(target, root ?? globalThis.document);
      const o: AnimateOptions = { ...defaults, ...opts };
      const dur = o.duration ?? 400;
      const at = opts.at;
      let start = lastEnd;
      if (typeof at === "number") start = at;
      else if (at === "<") start = lastStart;
      else if (typeof at === "string" && /^[+-]=\d+$/.test(at)) start = lastEnd + (at[0] === "+" ? 1 : -1) * Number(at.slice(2));
      const st = typeof opts.stagger === "function" ? opts.stagger : staggerFn(opts.stagger ?? 0, { total: els.length });
      let end = start;
      els.forEach((el, i) => {
        const s = Math.max(0, start + st(i));
        steps.push({ el, frames, opts: o, start: s, end: s + dur });
        end = Math.max(end, s + dur);
      });
      lastStart = start; lastEnd = end;
      return tl;
    },
    async play() {
      if (running.length) { running.forEach((c) => c.play()); return Promise.all(running.map((c) => c.finished)).then(() => undefined); }
      running = steps.map((s) => animate(s.el, s.frames, { ...s.opts, delay: s.start, duration: s.end - s.start }));
      const t0 = globalThis.performance?.now?.() ?? Date.now();
      const total = tl.duration || 1;
      const tick = (t: number): void => { const p = Math.min(1, (t - t0) / total); progress.set(p); if (p < 1) stopTick = frame(tick); };
      stopTick = frame(tick);
      await Promise.all(running.map((c) => c.finished));
      progress.set(1);
    },
    pause() { stopTick(); running.forEach((c) => c.pause()); },
    reverse() { running.forEach((c) => c.reverse()); },
    seek(ms) {
      if (!running.length) { running = steps.map((s) => animate(s.el, s.frames, { ...s.opts, delay: s.start, duration: s.end - s.start })); running.forEach((c) => c.pause()); }
      running.forEach((c) => c.seek(ms));
      progress.set(Math.min(1, ms / (tl.duration || 1)));
    },
    cancel() { stopTick(); running.forEach((c) => c.cancel()); running = []; progress.set(0); },
    get duration() { return steps.reduce((m, s) => Math.max(m, s.end), 0); },
    progress: () => progress(),
  };
  return tl;
}
