// The small shared core of hadi-march/motion/text: options, stagger order and one runner. Every text animation is a
// thin function over it, so importing one animation costs a few hundred bytes on top of the engine.
// Everything plays on the motion engine (one timeline per call): global speed, "pause all", slow motion and reduced
// motion apply. With reduced motion an animation jumps to its end state (loops stay still at their start).
import { timeline, type Playback } from "../engine/playback.ts";
import type { EaseInput } from "../engine/ease.ts";
import { splitText, type SplitBy, type SplitText } from "./split.ts";

export type { SplitBy, SplitText };
/** Where the stagger starts. "random" shuffles the order. */
export type StaggerFrom = "start" | "end" | "center" | "edges" | "random";

export interface TextOptions {
  /** Split unit: "char" (graphemes), "word" or "line". Each animation has its own default. */
  by?: SplitBy;
  /** Duration of one part (ms). */
  duration?: number;
  /** Delay between parts (ms). */
  stagger?: number;
  /** Easing name, CSS easing or function. */
  easing?: EaseInput;
  /** Delay before the first part (ms). */
  delay?: number;
  /** Where the stagger starts. */
  from?: StaggerFrom;
  /** Play as an exit: backwards, ending hidden (the parts stay until stop()). */
  out?: boolean;
  /** Repeat count; Infinity loops. */
  iterations?: number;
  /** Keep the split parts at the end. Entrances default to false: the plain text comes back. */
  keep?: boolean;
  /** Keep moving with reduced motion (rarely right for text). */
  essential?: boolean;
}

export interface TextAnimation {
  /** The engine playback: pause(), seek(), reverse(), playbackRate… */
  readonly playback: Playback;
  readonly split: SplitText;
  /** Resolves when it ends or is stopped. */
  readonly finished: Promise<void>;
  /** Start again from the beginning with the same options. */
  replay(): TextAnimation;
  /** Stop and put the original text back. */
  stop(): void;
}

/** An animation's defaults and how it behaves. */
export interface Defaults extends TextOptions {
  direction?: PlaybackDirection;
  /** transform-origin for every part. */
  origin?: string;
  /** An exit: ends hidden, so the parts are kept. */
  exit?: boolean;
  /** Ticker effects: duration per part (ms) when no duration is given. */
  msPerPart?: number;
}
export interface Resolved {
  by: SplitBy; duration: number; easing: EaseInput; iterations: number; direction: PlaybackDirection; keep: boolean;
  /** Stagger rank of each part (0 = first). */
  rank: number[];
  /** Start delay of part i (ms). */
  at(i: number): number;
}
export type Build = (s: SplitText, tl: Playback, r: Resolved) => void | (() => void);

const STAGGER: Record<SplitBy, number> = { char: 30, word: 90, line: 160 };
const running = new WeakMap<Element, TextAnimation>();

/** Stagger ranks for n parts. */
export function order(n: number, from: StaggerFrom = "start"): number[] {
  const r = Array.from({ length: n }, (_, i) => i);
  if (from === "end") return r.map((i) => n - 1 - i);
  if (from === "center") return r.map((i) => Math.abs(i - (n - 1) / 2));
  if (from === "edges") return r.map((i) => Math.min(i, n - 1 - i));
  if (from === "random") for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j]!, r[i]!]; }
  return r;
}

/** Split, build one timeline, play it. The shared runner every animation uses. */
export function run(el: HTMLElement, o: TextOptions, d: Defaults, build: Build): TextAnimation {
  running.get(el)?.stop();
  const m = { ...d, ...o };
  const split = splitText(el, m.by ?? "char");
  const ranks = order(split.parts.length, m.from);
  const each = m.stagger ?? STAGGER[split.by];
  const out = !!m.out;
  const r: Resolved = {
    by: split.by, rank: ranks, duration: m.duration ?? (d.msPerPart ? d.msPerPart * split.parts.length : 600), easing: m.easing ?? "out", iterations: m.iterations ?? 1,
    direction: out ? (m.direction === "alternate" ? "alternate-reverse" : "reverse") : m.direction ?? "normal",
    keep: m.keep ?? out !== !!d.exit,
    at: (i) => (m.delay ?? 0) + (ranks[i] ?? i) * each,
  };
  if (d.origin) for (const p of split.parts) p.style.setProperty("transform-origin", d.origin);
  const tl = timeline({ essential: !!m.essential });
  const cleanup = build(split, tl, r);
  const a: TextAnimation = {
    playback: tl, split, finished: tl.finished,
    replay: () => run(el, o, d, build),
    stop() {
      if (running.get(el) === a) running.delete(el);
      tl.cancel();
      cleanup?.();
      split.revert();
    },
  };
  running.set(el, a);
  void tl.finished.then(() => { if (tl.state === "finished" && !r.keep) a.stop(); });
  tl.play();
  return a;
}

export type FrameFn = (i: number, n: number, part: HTMLElement) => Keyframe[] | PropertyIndexedKeyframes;

/** Per-part keyframes: frames(i, n, part) for every part, staggered. */
export function perPart(el: HTMLElement, o: TextOptions = {}, d: Defaults, frames: FrameFn): TextAnimation {
  return run(el, o, d, (s, tl, r) => {
    const n = s.parts.length;
    s.parts.forEach((p, i) => tl.add(p, frames(i, n, p) as never, {
      at: 0, delay: r.at(i), duration: r.duration, easing: r.easing, iterations: r.iterations, direction: r.direction, fill: "both",
    }));
  });
}

/** Whole-text effects driven by a 0..1 value on the engine clock: draw(p) writes the parts each frame. */
export function ticker(el: HTMLElement, o: TextOptions = {}, d: Defaults, setup: (s: SplitText, r: Resolved) => ((p: number) => void) | void): TextAnimation {
  return run(el, o, d, (s, tl, r) => {
    const draw = setup(s, r);
    const st = { p: 0 };
    tl.add(st, { p: [0, 1] }, { at: 0, delay: o.delay ?? 0, duration: r.duration, easing: r.easing, iterations: r.iterations, direction: r.direction });
    if (draw) { tl.onUpdate = () => draw(st.p); draw(r.direction.endsWith("reverse") ? 1 : 0); }
  });
}

/** Random number in [-a, a]. */
export const jitter = (a: number): number => (Math.random() * 2 - 1) * a;
/** The element's text color (for gradient text, which needs color: transparent). */
export function colorOf(el: Element): string {
  try { return globalThis.getComputedStyle?.(el)?.color || "currentColor"; } catch { return "currentColor"; }
}
