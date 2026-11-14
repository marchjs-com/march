// Reveal (hadi-march/landing): children animate in when they scroll into view — fade, rise, fall, slide from the start
// or the end (mirrored in RTL), scale, blur or a 3D flip — one after another (stagger). `scrub` ties the effect to the
// scroll position instead of playing once. Motion engine only (transform / opacity / filter), reduced motion shows
// the content at once. Before it is revealed the content is hidden by CSS, so nothing flashes.
import "./reveal.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, onVisible, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { animate, stagger as staggerFn } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollTimeline } from "../../../motion/scroll-fx.ts";

export type RevealEffect = "fade" | "up" | "down" | "start" | "end" | "scale" | "blur" | "flip";

export interface RevealOptions {
  /** A ready effect, "none" (the content is simply there), or your own start and end state: `{ from: { opacity: 0, transform: "rotate(-8deg)" }, to: { opacity: 1, transform: "rotate(0deg)" } }`. */
  effect?: RevealEffect | "none" | { from: Record<string, string | number>; to: Record<string, string | number> } | undefined;
  /** Easing of the entrance (a motion engine easing name or a CSS easing; default "expo"). */
  easing?: string | undefined;
  /** Delay between children, ms (0 = the whole block at once). Default 70. */
  stagger?: number | undefined;
  delay?: number | undefined;
  duration?: number | undefined;
  /** Distance for up / down / start / end, px (default 28). */
  distance?: number | undefined;
  /** Follow the scroll (0 → 1 while the block enters the viewport) instead of playing once. */
  scrub?: boolean | undefined;
  /** Animate the element itself instead of its children. */
  self?: boolean | undefined;
  /** Animate the descendants matching this selector instead of the direct children (cards inside a grid). */
  select?: string | undefined;
}
export interface RevealProps extends RevealOptions {
  as?: string | undefined;
  class?: ClassProp | undefined;
  children?: unknown | undefined;
  [attr: string]: unknown;
}

const rtl = (el: Element): boolean => globalThis.getComputedStyle?.(el).direction === "rtl";

/** Start and end state of an effect (transform strings, opacity, filter). */
export function revealFrames(effect: RevealEffect, distance: number, isRtl: boolean): { from: Record<string, string | number>; to: Record<string, string | number> } {
  const d = distance, s = isRtl ? -1 : 1;
  const from: Record<RevealEffect, Record<string, string | number>> = {
    fade: { opacity: 0 },
    up: { opacity: 0, transform: `translate3d(0, ${d}px, 0)` },
    down: { opacity: 0, transform: `translate3d(0, ${-d}px, 0)` },
    start: { opacity: 0, transform: `translate3d(${-d * s}px, 0, 0)` },
    end: { opacity: 0, transform: `translate3d(${d * s}px, 0, 0)` },
    scale: { opacity: 0, transform: "scale(.92)" },
    blur: { opacity: 0, filter: "blur(14px)", transform: "scale(1.02)" },
    flip: { opacity: 0, transform: "perspective(900px) rotateX(-24deg) translate3d(0, 18px, 0)" },
  };
  const f = from[effect] ?? from.up;
  const to: Record<string, string | number> = { opacity: 1 };
  if ("transform" in f) to["transform"] = effect === "flip" ? "perspective(900px) rotateX(0deg) translate3d(0, 0, 0)" : effect === "scale" || effect === "blur" ? "scale(1)" : "translate3d(0, 0, 0)";
  if ("filter" in f) to["filter"] = "blur(0px)";
  return { from: f, to };
}

const targets = (el: Element, self?: boolean, select?: string): HTMLElement[] =>
  (self ? [el as HTMLElement] : select ? ([...el.querySelectorAll(select)] as HTMLElement[]) : ([...el.children] as HTMLElement[]));

/**
 * Reveal an element's children (or the element) when it enters the viewport. Works as an action:
 * `<ul use:reveal={{ effect: "up", stagger: 80 }}>`. Returns stop.
 */
export function revealOnScroll(el: Element, raw?: unknown): () => void {
  const o: RevealOptions = raw && typeof raw === "object" ? (raw as RevealOptions) : {};
  const effect = o.effect ?? "up", dist = o.distance ?? 28;
  el.classList.add("hm-reveal");
  // no effect: nothing is hidden, nothing moves
  if (effect === "none") { el.classList.add("is-revealed"); return () => {}; }
  const framesOf = (): ReturnType<typeof revealFrames> => (typeof effect === "object" ? effect : revealFrames(effect, dist, rtl(el)));
  if (o.scrub) {
    el.classList.add("is-scrub");
    // the motion core's scroll timeline: the entrance is seeked by the block's passage (fully in at 45 %), the children
    // a little after one another; reduced motion leaves the content as it is
    if (reducedMotion()) return () => {};
    const list = targets(el, o.self, o.select);
    const { from, to } = framesOf();
    const frames: Record<string, unknown[]> = {};
    for (const k of Object.keys(from)) frames[k] = [from[k], to[k]];
    return scrollTimeline(list, frames as never, { track: el, range: [0, 0.45], easing: "out", stagger: o.self ? 0 : 60 });
  }
  el.classList.add("is-pending");
  // descendants picked by a selector are hidden by their own class until the reveal
  if (o.select) for (const t of targets(el, false, o.select)) t.classList.add("hm-reveal-item");
  const go = (): void => {
    const list = targets(el, o.self, o.select);
    const { from, to } = framesOf();
    if (!reducedMotion() && list.length) {
      const frames: Record<string, unknown[]> = {};
      for (const k of Object.keys(from)) frames[k] = [from[k], to[k]];
      animate(list, frames as never, { duration: o.duration ?? 720, delay: o.delay ?? 0, easing: (o.easing ?? "expo") as never, fill: "backwards", stagger: o.self ? 0 : staggerFn(o.stagger ?? 70) });
    }
    el.classList.remove("is-pending");
    el.classList.add("is-revealed");
  };
  return onVisible(el, go, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
}

/** `<Reveal effect="up" stagger={80}><Card/><Card/><Card/></Reveal>` */
export function Reveal(props: RevealProps): Element {
  const { as, class: c, children, effect, easing, stagger, delay, duration, distance, scrub, self, select, ...attrs } = props;
  const el = h(as ?? "div", { ...attrs, class: cx("hm-reveal-box", val(c as MaybeFn<unknown>)) }, children) as HTMLElement;
  const opts: RevealOptions = { effect, easing, stagger, delay, duration, distance, scrub, self, select } as RevealOptions;
  const stop = revealOnScroll(el, opts);
  if (getOwner()) onCleanup(stop);
  return el;
}
