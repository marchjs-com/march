// play(): the light way to animate one element. Same call as animate() (motion/animate.ts) and the same result on
// screen, without shipping the engine: it runs on WAAPI directly when the easing is one the engine itself maps to a
// fixed CSS curve (the table below). Anything else (a spring, a custom or registered easing, named keyframes,
// `essential`, `onUpdate`, several targets…) loads the engine in its own chunk and hands the call over, so a component
// that plays a two-keyframe pop does not download ~9 KB gzip of motion engine. Global speed, "pause all" and reduced
// motion apply as for every engine animation (startNative).
import { startNative } from "./engine/native.ts";
import { defaultTiming } from "./engine/config.ts";
import { reducedNow } from "./engine/prefs.ts";
import type { AnimateOptions as EngineOptions } from "./engine/playback.ts";
import type { AnimateOptions } from "./animate.ts";
import type { Frames as EngineFrames } from "./engine/tracks.ts";

export type PlayFrames = Keyframe[] | PropertyIndexedKeyframes | EngineFrames;
export type PlayOptions = AnimateOptions & Pick<EngineOptions, "onUpdate" | "onComplete" | "js" | "endDelay">;
/** What play() returns: the subset of a Playback that components use. */
export interface Played {
  readonly finished: Promise<void>;
  cancel(): void;
  finish(): void;
}

// the engine's own CSS for these names (engine/ease.ts cssOf); keep in step (test/motion-play.test.js checks it)
export const PLAY_EASE: Record<string, string> = {
  linear: "linear", in: "cubic-bezier(0.32,0,0.67,0)", out: "cubic-bezier(0.33,1,0.68,1)", "in-out": "cubic-bezier(0.65,0,0.35,1)",
  expo: "cubic-bezier(0.16,1,0.3,1)", back: "cubic-bezier(0.34,1.56,0.64,1)", easeOutBack: "cubic-bezier(0.34,1.56,0.64,1)",
  easeOutCubic: "cubic-bezier(0.33,1,0.68,1)", easeInCubic: "cubic-bezier(0.32,0,0.67,0)", easeInOutCubic: "cubic-bezier(0.65,0,0.35,1)",
  ease: "cubic-bezier(0.25,0.1,0.25,1)", "ease-out": "cubic-bezier(0,0,0.58,1)", "ease-in-out": "cubic-bezier(0.42,0,0.58,1)",
};
const css = (e: unknown): string | null => (typeof e !== "string" ? null : PLAY_EASE[e] ?? (/^(cubic-bezier|steps)\(/.test(e) ? e : null));

// the end state a finished effect keeps (fill forwards / both), written through the CSSOM (CSP safe)
function settle(el: Element, frames: PlayFrames, fill: FillMode): void {
  if (fill !== "forwards" && fill !== "both") return;
  const st = (el as HTMLElement).style;
  if (!st) return;
  const last: Record<string, unknown> = Array.isArray(frames) ? { ...(frames[frames.length - 1] as object) } : Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, Array.isArray(v) ? v[v.length - 1] : v]));
  for (const [k, v] of Object.entries(last)) {
    if (k === "offset" || k === "easing" || k === "composite" || v == null) continue;
    st.setProperty(k === "cssFloat" ? "float" : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), String(v));
  }
}

/** Animate one element: `play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "out" })`. */
export function play(el: Element, frames: PlayFrames, opts: PlayOptions = {}): Played {
  const d = defaultTiming();
  const easing = css(opts.easing ?? d.easing);
  const loop = opts.iterations === Infinity;
  if (easing == null || (opts.essential && !loop) || opts.onUpdate || opts.onComplete || opts.js) return later(el, frames, opts);
  const fill = opts.fill ?? "both";
  // reduced motion, or no WAAPI (no renderer): the end state at once, as the engine does
  if ((reducedNow() && !opts.essential) || typeof (el as HTMLElement).animate !== "function") {
    settle(el, frames, fill);
    return { finished: Promise.resolve(), cancel() {}, finish() {} };
  }
  const a = startNative(el, frames as Keyframe[], {
    duration: opts.duration ?? d.duration, delay: opts.delay ?? 0, endDelay: opts.endDelay ?? 0, easing, fill,
    iterations: opts.iterations ?? 1, direction: opts.direction ?? "normal",
  });
  if (!a) { settle(el, frames, fill); return { finished: Promise.resolve(), cancel() {}, finish() {} }; }
  // like a Playback: finished resolves when done or cancelled
  const finished = a.finished.then(() => {}, () => {});
  return { finished, cancel: () => a.cancel(), finish: () => { try { a.finish(); } catch { /* infinite */ } } };
}

// the engine, on demand: the call is handed over once it has loaded (cancel / finish before that are kept)
function later(el: Element, frames: PlayFrames, opts: PlayOptions): Played {
  let p: { cancel(): unknown; finish(): unknown } | null = null, cut: "cancel" | "finish" | null = null;
  const finished = import("./animate.ts").then(({ animate }) => {
    if (cut === "cancel") return;
    p = animate(el, frames as never, opts as never);
    if (cut === "finish") p.finish();
    return (p as unknown as { finished: Promise<void> }).finished;
  }).then(() => {}, () => {});
  return { finished, cancel: () => { if (p) p.cancel(); else cut = "cancel"; }, finish: () => { if (p) p.finish(); else cut = "finish"; } };
}
