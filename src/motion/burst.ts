// The like burst and pop (motion engine): a ring and particles in the four HADİ colours fly out from the centre of an
// element, and a heart squashes and overshoots. One home for both: LikeButton, PostCard (double-tap on a photo) and
// FollowButton use them; call them on any element of your own.
import "./burst.css";
import { h } from "../dom/h.ts";
import { cx } from "../core/util.ts";
import { animate } from "./animate.ts";
import { reducedMotion } from "./env.ts";

export interface BurstOptions {
  /** Particles. Default 10. */
  count?: number;
  /** Fly distance (px). Default 26. */
  radius?: number;
  colors?: "brand" | "single";
  /** Also a ring that grows and fades. Default true. */
  ring?: boolean;
}

/** Throws a particle burst (and a ring) from the center of `host` (give it position: relative). */
export function heartBurst(host: HTMLElement, o: BurstOptions = {}): void {
  if (reducedMotion()) return;
  const n = o.count ?? 10, r = o.radius ?? 26;
  const layer = h("span", { class: "hm-burst", "aria-hidden": "true" }) as HTMLElement;
  host.append(layer);
  const runs: Promise<void>[] = [];
  if (o.ring !== false) {
    const ring = h("span", { class: "hm-burst-ring" }) as HTMLElement;
    layer.append(ring);
    runs.push(animate(ring, [{ transform: "scale(.2)", opacity: 0.9 }, { transform: "scale(1.6)", opacity: 0 }], { duration: 520, easing: "easeOutCubic", fill: "forwards" }).finished);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (i % 2 ? 0.2 : 0), d = r * (i % 2 ? 0.75 : 1);
    const dot = h("span", { class: cx("hm-burst-dot", o.colors !== "single" && `hm-burst-c${(i % 4) + 1}`, i % 2 && "hm-burst-sm") }) as HTMLElement;
    layer.append(dot);
    const x = Math.round(Math.cos(a) * d), y = Math.round(Math.sin(a) * d);
    runs.push(animate(dot, [
      { transform: "translate(0px, 0px) scale(.3)", opacity: 0 },
      { transform: `translate(${Math.round(x * 0.6)}px, ${Math.round(y * 0.6)}px) scale(1.15)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${x}px, ${y}px) scale(0)`, opacity: 0.4 },
    ], { duration: 640, delay: 60, easing: "easeOutCubic", fill: "forwards" }).finished);
  }
  void Promise.all(runs).then(() => layer.remove());
}

/** Pops a heart: squash, overshoot, settle (on) or a small press (off). */
export function heartPop(el: Element, on: boolean): void {
  if (on) animate(el, [{ transform: "scale(1)" }, { transform: "scale(.62)", offset: 0.18 }, { transform: "scale(1.32)", offset: 0.55 }, { transform: "scale(.94)", offset: 0.8 }, { transform: "scale(1)" }], { duration: 560, easing: "linear" });
  else animate(el, [{ transform: "scale(1)" }, { transform: "scale(.8)" }, { transform: "scale(1)" }], { duration: 220, easing: "easeOutCubic" });
}
