// Scroll-linked animation on the motion engine: an engine Playback (paused) is seeked by scroll progress, so keyframes,
// timelines, staggers and easings work the same as for time, and "pause all" / reduced motion still apply.
//   scrollTimeline(card, [{ opacity: 0, transform: "translateY(40px)" }, { opacity: 1, transform: "none" }])
//   parallaxLayers(hero, { strength: 80 })            children with data-depth="-1…1" move at their own speed
//   stickyReveal(section, { steps: ".step" })        a sticky stage steps through its children as the page scrolls
//   scrollIndicator(bar, { source: article })        a progress bar (scaleX from the inline start; RTL mirrored)
import { animate, timeline, type AnimateOptions, type KeyframesInput, type Playback } from "./engine/playback.ts";
import { measure } from "./engine/clock.ts";
import { pausedNow } from "./engine/config.ts";
import { reducedNow } from "./engine/prefs.ts";
import { clamp, listen } from "../core/util.ts";

export interface ScrollSource {
  /** The scrolling element (default: the page). */
  source?: Element | null;
  /** Element whose passage through the scrollport is measured (default: the target; for indicators: the whole scroll). */
  track?: Element | null;
  /** Progress window: [start, end] fractions of the passage (0 = entering at the bottom, 1 = leaving at the top). */
  range?: [number, number];
  /** Vertical (default) or horizontal scrolling. */
  axis?: "y" | "x";
}

/** Progress (0..1) of `track` through the scrollport of `source` (no track: the scroll position itself). */
export function scrollFraction(o: ScrollSource): number {
  const doc = globalThis.document?.documentElement;
  const src = o.source ?? null, y = o.axis !== "x";
  const port = src ? src.getBoundingClientRect() : { top: 0, left: 0, height: globalThis.innerHeight || 1, width: globalThis.innerWidth || 1 };
  let p: number;
  if (!o.track) {
    const el = (src ?? doc) as Element | undefined;
    const pos = src ? (y ? src.scrollTop : Math.abs(src.scrollLeft)) : (y ? globalThis.scrollY : Math.abs(globalThis.scrollX)) ?? 0;
    const max = el ? (y ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth) : 0;
    p = max > 0 ? pos / max : 0;
  } else {
    const r = o.track.getBoundingClientRect();
    const size = y ? port.height : port.width, start = y ? r.top - port.top : r.left - port.left, len = y ? r.height : r.width;
    p = (size - start) / (size + len || 1);
  }
  const [a, b] = o.range ?? [0, 1];
  return clamp((p - a) / ((b - a) || 1), 0, 1);
}

/** Call `fn(progress)` whenever the scroll (or the size) changes, once per frame in the read phase. */
export function onScrollProgress(o: ScrollSource, fn: (p: number) => void): () => void {
  let queued = false;
  const run = (): void => { queued = false; fn(scrollFraction(o)); };
  const on = (): void => { if (!queued) { queued = true; measure(run); } };
  const offA = listen(o.source ?? globalThis, { scroll: on }, { passive: true });
  const offB = listen(globalThis, { resize: on }, { passive: true });
  on();
  return () => { offA(); offB(); };
}

export interface ScrollTimelineOptions extends ScrollSource, Omit<AnimateOptions, "autoplay"> {}

/**
 * Bind a Playback to scroll: its progress follows the scroll position (a paused animation seeked each frame).
 * Pass keyframes (target + frames) or a ready Playback / timeline. Returns a stop function.
 */
export function scrollTimeline(target: unknown, frames?: KeyframesInput | null, o: ScrollTimelineOptions = {}): () => void {
  const pb: Playback = target && typeof (target as Playback).seek === "function" && !frames
    ? (target as Playback).pause()
    : animate(target, frames!, { duration: 1000, easing: "linear", fill: "both", ...o, autoplay: false });
  const src: ScrollSource = { ...o, track: o.track === undefined && target instanceof Element ? target : o.track ?? null };
  const stop = onScrollProgress(src, (p) => { if (!pausedNow()) pb.seek(p * pb.duration); });
  return () => { stop(); pb.cancel(); };
}

export interface ParallaxLayersOptions extends ScrollSource { /** Pixels a depth-1 layer travels over the passage. */ strength?: number; selector?: string }

/** Layers (`[data-depth]`, -1…1) move at their own speed while the container passes through view. */
export function parallaxLayers(container: Element, o: ParallaxLayersOptions = {}): () => void {
  const k = o.strength ?? 120;
  const layers = Array.from(container.querySelectorAll<HTMLElement>(o.selector ?? "[data-depth]"));
  const tl = timeline({ defaults: { duration: 1000, easing: "linear", fill: "both" } });
  for (const l of layers) {
    const d = Number(l.dataset.depth ?? 0.5) * k;
    tl.add(l, [{ transform: `translate3d(0, ${d / 2}px, 0)` }, { transform: `translate3d(0, ${-d / 2}px, 0)` }], { at: 0 });
  }
  // reduced motion: the layers stay in place (the middle of the passage is no offset)
  const stop = onScrollProgress({ ...o, track: o.track ?? container }, (p) => { if (!pausedNow()) tl.seek(reducedNow() ? 500 : p * 1000); });
  return () => { stop(); tl.cancel(); };
}

export interface StickyRevealOptions extends ScrollSource {
  /** The step elements inside the sticky stage (default "[data-step]"). */
  steps?: string;
  /** Called with the active step index. */
  onStep?: (i: number) => void;
}

/**
 * A tall section with a sticky stage: as the section scrolls by, the steps come in one after another (each fades and
 * rises in, then out). The section sets `--hm-scroll` (0..1) on itself for CSS extras. Returns a stop function.
 */
export function stickyReveal(section: HTMLElement, o: StickyRevealOptions = {}): () => void {
  const steps = Array.from(section.querySelectorAll<HTMLElement>(o.steps ?? "[data-step]"));
  const n = steps.length || 1, seg = 1000 / n;
  const tl = timeline({ defaults: { easing: "out", fill: "both" } });
  steps.forEach((s, i) => {
    if (i > 0) tl.add(s, [{ opacity: 0, transform: "translateY(24px) scale(.98)" }, { opacity: 1, transform: "none" }], { at: i * seg - seg * 0.15, duration: seg * 0.3 });
    else tl.add(s, [{ opacity: 1, transform: "none" }, { opacity: 1, transform: "none" }], { at: 0, duration: 1 });
    if (i < n - 1) tl.add(s, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-24px) scale(.98)" }], { at: (i + 1) * seg - seg * 0.15, duration: seg * 0.3 });
  });
  let last = -1;
  // the passage of a sticky section: from its top at the scrollport top to its bottom at the scrollport bottom
  const stop = onScrollProgress({ ...o, track: null }, () => {
    const r = section.getBoundingClientRect(), port = o.source?.getBoundingClientRect() ?? { top: 0, height: globalThis.innerHeight || 1 };
    const p = clamp((port.top - r.top) / ((r.height - port.height) || 1), 0, 1);
    section.style.setProperty("--hm-scroll", p.toFixed(4));
    if (!pausedNow()) tl.seek(reducedNow() ? Math.round(p * (n - 1)) * seg + seg * 0.5 : p * 1000);
    const i = Math.min(n - 1, Math.floor(p * n));
    if (i !== last) { last = i; o.onStep?.(i); }
  });
  return () => { stop(); tl.cancel(); };
}

export interface IndicatorOptions extends ScrollSource { /** Vertical bar (scaleY) instead of horizontal. */ vertical?: boolean }

/** A scroll progress bar: the element scales from the inline start (RTL: the right) to full. */
export function scrollIndicator(el: HTMLElement, o: IndicatorOptions = {}): () => void {
  const rtl = (el.closest?.("[dir]")?.getAttribute("dir") ?? globalThis.document?.documentElement?.getAttribute("dir")) === "rtl";
  el.style.transformOrigin = o.vertical ? "50% 0%" : rtl ? "100% 50%" : "0% 50%";
  const frames = o.vertical ? [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }] : [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }];
  // a progress indicator is information, not decoration: it keeps working with reduced motion
  const pb = animate(el, frames, { duration: 1000, easing: "linear", fill: "both", essential: true, autoplay: false });
  const stop = onScrollProgress(o, (p) => pb.seek(p * 1000));
  return () => { stop(); pb.cancel(); };
}
