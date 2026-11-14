// FollowButton (hadi-march/ui): Follow → Following (or Requested for a private account) with a morph: the pill's
// width springs from one label to the other, the filled Aktivite background turns into an outline, the + turns into a
// tick, and a small burst of the four HADİ colors marks a new follow (motion engine; reduced motion keeps only the
// state change). Hovering "Following" warns in red before you unfollow.
import { live } from "../../../forms/util.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { clock } from "../../../icons/glyphs/clock.ts";
import { animate } from "../../../motion/animate.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Button } from "../../actions/button/index.ts";
import { heartBurst } from "../like-button/index.ts";
import "./follow-button.css";

export type FollowState = "follow" | "following" | "requested";

export interface FollowButtonProps {
  state: MaybeFn<FollowState | undefined>;
  /** Called with the next state (follow → following, or requested when `private`; back to follow). */
  onChange: (next: FollowState) => void;
  /** A private account: following asks first. */
  private?: MaybeFn<boolean | undefined>;
  /** Whom (accessible name: "Follow HADİ"). */
  name?: MaybeFn<string | undefined>;
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** Stretch to the container. */
  block?: MaybeFn<boolean | undefined>;
  /** Your own button texts: `{ follow: "Join", following: "Member", requested: "Waiting" }` (any subset). */
  labels?: MaybeFn<Partial<Record<FollowState, string>> | undefined>;
  /** Your own accessible name: `(state, name) => "…"`. Default: "Follow HADİ", "Following HADİ, press to unfollow"… */
  ariaLabel?: ((state: FollowState, name: string | undefined) => string) | undefined;
  /** The + / tick / clock icon: true (default), false, or `(state) => node`. */
  icon?: boolean | ((state: FollowState) => unknown) | undefined;
  /** Fill color of "Follow". Default brand-blue. */
  color?: MaybeFn<ColorToken | undefined>;
  /** The burst of dots on a new follow. Default true. */
  burst?: MaybeFn<boolean | undefined>;
  /** The width spring and the icon turn between states. Default true. */
  morph?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** `<FollowButton state={$state} name={user.name} onChange={(s) => $state = s} />` */
export function FollowButton(props: FollowButtonProps): Element {
  let btn!: HTMLElement, ico: HTMLElement | null = null;
  const state = (): FollowState => val(props.state) ?? "follow";
  const label = (s: FollowState): string => val(props.labels)?.[s] ?? (s === "follow" ? t`Follow` : s === "following" ? t`Following` : t`Requested`);
  const icon = props.icon;
  const click = (): void => {
    const from = state(), next: FollowState = from === "follow" ? (val(props.private) ? "requested" : "following") : "follow";
    const w0 = btn.offsetWidth;
    props.onChange(next);
    // after the label changed: spring the width from the old one, turn the icon in
    queueMicrotask(() => {
      const w1 = btn.offsetWidth;
      if (val(props.morph) !== false) {
        if (w0 && w1 && w0 !== w1 && !val(props.block)) animate(btn, [{ width: `${w0}px` }, { width: `${w1}px` }], { duration: 380, easing: "easeOutBack" });
        if (ico) animate(ico, [{ transform: "rotate(-90deg) scale(.4)", opacity: 0 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }], { duration: 320, easing: "easeOutBack" });
      }
      if (next === "following" && val(props.burst) !== false) heartBurst(btn, { count: 8, radius: Math.max(28, w1 * 0.55), ring: false });
    });
  };
  // a Button with a pressed state: filled while "follow", outlined once following / requested
  return h(Button, {
    class: () => cx("hm-follow", `hm-follow-${val(props.size) ?? "md"}`, `is-${state()}`, val(props.class)),
    variant: () => (state() === "follow" ? "primary" : "secondary"), shape: "pill", size: () => val(props.size) ?? "md",
    block: live(() => !!val(props.block)), color: live(() => val(props.color)), pressed: () => state() !== "follow",
    "aria-label": () => { const n = val(props.name); const s = state(); return props.ariaLabel ? props.ariaLabel(s, n) : n ? (s === "follow" ? t`Follow ${n}` : s === "following" ? t`Following ${n}, press to unfollow` : t`Follow request sent to ${n}, press to cancel`) : label(s); },
    ref: (x: HTMLElement) => { btn = x; },
    onClick: click,
    icon: icon === false ? null : h("span", { class: "hm-follow-ico", "aria-hidden": "true", ref: (x: HTMLElement) => { ico = x; } },
      () => (typeof icon === "function" ? icon(state()) : glyph(state() === "follow" ? plus : state() === "following" ? check : clock))),
    children: h("span", { class: "hm-follow-text" }, () => label(state())),
  }) as Element;
}
