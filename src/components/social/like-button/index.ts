// LikeButton (hadi-march/ui): a heart toggle with a count. Liking pops the heart on a spring, rings it and throws a
// burst of particles in the four HADİ colors (motion engine: global speed, pause and reduced motion apply; with
// reduced motion only the fill changes). heartBurst() / heartPop() are the same effects for any element (a double-tap
// on a photo, a comment, a story).
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { CountRoll } from "../count-roll/index.ts";
import "./like-button.css";

export interface LikeButtonProps {
  liked: MaybeFn<boolean | null | undefined>;
  /** Called with the next state; the owner updates `liked` (and the count). */
  onToggle: (next: boolean) => void;
  count?: MaybeFn<number | null | undefined>;
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Heart color while liked. Default brand-pink. */
  color?: ColorToken | undefined;
  /** Particle burst on like. Default true. */
  burst?: MaybeFn<boolean | undefined>;
  /** brand: particles in the four HADİ colors · single: the heart color. Default brand. */
  colors?: MaybeFn<"brand" | "single" | undefined>;
  /** Accessible name. Default "Like". */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

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

/** `<LikeButton liked={$liked} count={$likes} onToggle={(on) => { $liked = on; $likes += on ? 1 : -1 }} />` */
export function LikeButton(props: LikeButtonProps): Element {
  let icon!: HTMLElement, hit!: HTMLElement;
  const toggle = (): void => {
    const next = !val(props.liked);
    props.onToggle(next);
    heartPop(icon, next);
    const size = val(props.size);
    if (next && val(props.burst) !== false) heartBurst(hit, { colors: val(props.colors) ?? "brand", radius: size === "lg" ? 34 : size === "sm" ? 20 : 26 });
  };
  return h("button", {
    type: "button",
    class: () => cx("hm-like", `hm-like-${val(props.size) ?? "md"}`, val(props.liked) && "is-liked", val(props.class)),
    "data-hm-color": colorAttr(props.color ?? "brand-pink"),
    "aria-pressed": () => String(!!val(props.liked)),
    "aria-label": () => val(props.label) ?? t`Like`,
    onClick: toggle,
  },
  h("span", { class: "hm-like-hit", ref: (x: HTMLElement) => { hit = x; } },
    h("span", { class: "hm-like-heart", ref: (x: HTMLElement) => { icon = x; } }, glyph(heart))),
  props.count !== undefined ? h(CountRoll, { value: () => val(props.count) ?? 0, hideZero: true, class: "hm-like-count" }) : null);
}
