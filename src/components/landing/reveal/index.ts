// Reveal (hadi-march/landing): children animate in when they scroll into view — fade, rise, fall, slide from the start
// or the end (mirrored in RTL), scale, blur or a 3D flip — one after another (stagger). `scrub` ties the effect to the
// scroll position instead of playing once. Motion engine only (transform / opacity / filter), reduced motion shows
// the content at once. Before it is revealed the content is hidden by CSS, so nothing flashes.
import "./reveal.css";
import { h } from "../../../dom/h.ts";
import { onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, onVisible, clamp, lerp, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { animate, stagger as staggerFn } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { scrollScene } from "../../../motion/scroll-scene.ts";
import { setStyle } from "../../../core/util.ts";

export type RevealEffect = "fade" | "up" | "down" | "start" | "end" | "scale" | "blur" | "flip";

export interface RevealOptions {
  effect?: RevealEffect | undefined;
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
  if (o.scrub) {
    el.classList.add("is-scrub");
    return scrollScene(el, (s) => {
      const list = targets(el, o.self, o.select);
      const { from } = revealFrames(effect, dist, rtl(el));
      list.forEach((t, i) => {
        if (reducedMotion()) { setStyle(t, { opacity: null, transform: null, filter: null }); return; }
        // each child starts a little later; fully in at 45 % of the block's pass through the viewport
        const p = clamp((s.progress - 0.04 * i) / 0.4, 0, 1), e = 1 - (1 - p) ** 3;
        const tf = typeof from["transform"] === "string" ? from["transform"] as string : "";
        setStyle(t, {
          opacity: String(lerp(0, 1, e)),
          transform: tf ? scaleTransform(tf, 1 - e) : null,
          filter: from["filter"] ? `blur(${(14 * (1 - e)).toFixed(1)}px)` : null,
        });
      });
    });
  }
  el.classList.add("is-pending");
  // descendants picked by a selector are hidden by their own class until the reveal
  if (o.select) for (const t of targets(el, false, o.select)) t.classList.add("hm-reveal-item");
  const go = (): void => {
    const list = targets(el, o.self, o.select);
    const { from, to } = revealFrames(effect, dist, rtl(el));
    if (!reducedMotion() && list.length) {
      const frames: Record<string, unknown[]> = {};
      for (const k of Object.keys(from)) frames[k] = [from[k], to[k]];
      animate(list, frames as never, { duration: o.duration ?? 720, delay: o.delay ?? 0, easing: "expo", fill: "backwards", stagger: o.self ? 0 : staggerFn(o.stagger ?? 70) });
    }
    el.classList.remove("is-pending");
    el.classList.add("is-revealed");
  };
  return onVisible(el, go, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
}

/** Multiply every number in a transform by `k` (translate / rotate toward 0, scale toward 1). */
function scaleTransform(tf: string, k: number): string {
  return tf.replace(/(scale\()([\d.]+)/g, (_, a: string, n: string) => `${a}${(1 - (1 - Number(n)) * k).toFixed(4)}`)
    .replace(/(translate3d\(|rotateX\()([^)]*)/g, (_, a: string, args: string) => a + args.replace(/-?[\d.]+(?=px|deg)/g, (n) => (Number(n) * k).toFixed(2)));
}

/** `<Reveal effect="up" stagger={80}><Card/><Card/><Card/></Reveal>` */
export function Reveal(props: RevealProps): Element {
  const { as, class: c, children, effect, stagger, delay, duration, distance, scrub, self, select, ...attrs } = props;
  const el = h(as ?? "div", { ...attrs, class: cx("hm-reveal-box", val(c as MaybeFn<unknown>)) }, children) as HTMLElement;
  const opts: RevealOptions = { effect, stagger, delay, duration, distance, scrub, self, select } as RevealOptions;
  const stop = revealOnScroll(el, opts);
  if (getOwner()) onCleanup(stop);
  return el;
}
