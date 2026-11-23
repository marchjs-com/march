// The moving part of OverflowText (bounce / loop / once), in its own chunk: loaded the first time a text overflows, so a
// list of titles that fit (most of them) does not ship it. WAAPI on a transform only; no inline style attribute.
import { h } from "../../../dom/h.ts";
import { animateEl } from "../../../motion/env.ts";
import type { MarqueeMode } from "./index.ts";

type Anim = { cancel(): void };
export interface MarqueeRun {
  root: HTMLElement; track: HTMLElement; item: HTMLElement;
  mode: MarqueeMode; rtl: boolean; dist: number;
  speed?: number | undefined; pause?: number | undefined; easing?: string | undefined;
  separator?: unknown; fade?: boolean | undefined;
  /** A `once` run reached its end. */
  done(): void;
}

/** Start the scroll; returns stop (cancels the animations, removes the loop's copies). */
export function runMarquee(o: MarqueeRun): () => void {
  let anim: Anim | null = null, fadeAnim: Anim | null = null, copies: Element[] = [];
  const stop = (): void => { anim?.cancel(); anim = null; fadeAnim?.cancel(); fadeAnim = null; for (const c of copies) c.remove(); copies = []; };
  const { root, track, item, mode } = o;
  const sign = o.rtl ? 1 : -1;
  const speed = Math.max(5, o.speed ?? 40), pause = Math.max(0, o.pause ?? 1000);
  // The fade follows the text: only the side that hides text fades. Before moving only the end fades (the first letter is
  // whole), while moving both, at the end of a bounce only the start (the last letter is whole). Two registered custom
  // properties (marquee.css @property) carry the widths; this animation runs on the root with the same timing.
  const F = "var(--m-marquee-fade, 14px)";
  const fadeFrames = (stops: Array<[number, boolean, boolean]>): Keyframe[] => stops.map(([offset, s, e]) => ({ offset, "--m-mq-fs": s ? F : "0px", "--m-mq-fe": e ? F : "0px" } as Keyframe));
  const fade = (frames: Keyframe[], opts: KeyframeAnimationOptions): void => {
    if (o.fade !== false && typeof root.animate === "function") { try { fadeAnim = animateEl(root, frames, opts); } catch { fadeAnim = null; } }
  };
  if (mode === "loop") {
    const sep = o.separator === false ? null : h("span", { class: "m-marquee-sep", "aria-hidden": "true" }, o.separator ?? "•");
    const copy = item.cloneNode(true) as HTMLElement;
    copy.setAttribute("aria-hidden", "true");
    copy.setAttribute("inert", "");
    copies = sep ? [sep, copy] : [copy];
    track.append(...copies);
    const span = copy.getBoundingClientRect().left - item.getBoundingClientRect().left;
    const travel = (Math.abs(span) / speed) * 1000, total = travel + pause;
    anim = animateEl(track, [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: pause / total },
      { transform: `translateX(${sign * Math.abs(span)}px)`, offset: 1 },
    ], { duration: total, iterations: Infinity, easing: "linear" });
    const p = pause / total, e = Math.min(0.03, (1 - p) / 4);
    fade(fadeFrames([[0, false, true], [p, false, true], [Math.min(1, p + e), true, true], [1, true, true]]), { duration: total, iterations: Infinity });
    return stop;
  }
  const d = o.dist, travel = (d / speed) * 1000, total = 2 * travel + 2 * pause;
  const end = `translateX(${sign * d}px)`, ease = o.easing ?? "ease-in-out";
  anim = animateEl(track, [
    { transform: "translateX(0)", offset: 0 },
    { transform: "translateX(0)", offset: pause / total, easing: ease },
    { transform: end, offset: (pause + travel) / total },
    { transform: end, offset: (2 * pause + travel) / total, easing: ease },
    { transform: "translateX(0)", offset: 1 },
  ], { duration: total, iterations: mode === "once" ? 1 : Infinity, fill: "none" });
  const a = pause / total, b = (pause + travel) / total, c = (2 * pause + travel) / total, e = Math.min(0.03, travel / total / 4);
  fade(fadeFrames([[0, false, true], [a, false, true], [a + e, true, true], [b - e, true, true], [b, true, false], [c, true, false], [c + e, true, true], [1 - e, true, true], [1, false, true]]),
    { duration: total, iterations: mode === "once" ? 1 : Infinity, fill: "none" });
  if (mode === "once" && anim) (anim as Anim & { onfinish?: () => void }).onfinish = () => { anim = null; o.done(); };
  return stop;
}
