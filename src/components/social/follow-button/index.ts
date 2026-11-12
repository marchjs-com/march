// FollowButton (hadi-march/ui): Follow → Following (or Requested for a private account) with a morph: the pill's
// width springs from one label to the other, the filled Aktivite background turns into an outline, the + turns into a
// tick, and a small burst of the four HADİ colors marks a new follow (motion engine; reduced motion keeps only the
// state change). Hovering "Following" warns in red before you unfollow.
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { clock } from "../../../icons/glyphs/clock.ts";
import { animate } from "../../../motion/animate.ts";
import { heartBurst } from "../like-button/index.ts";
import "./follow-button.css";

export type FollowState = "follow" | "following" | "requested";

export interface FollowButtonProps {
  state: MaybeFn<FollowState | undefined>;
  /** Called with the next state (follow → following, or requested when `private`; back to follow). */
  onChange: (next: FollowState) => void;
  /** A private account: following asks first. */
  private?: MaybeFn<boolean | undefined>;
  /** Whom (accessible name: "Follow Acme"). */
  name?: MaybeFn<string | undefined>;
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** Stretch to the container. */
  block?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
}

/** `<FollowButton state={$state} name={user.name} onChange={(s) => $state = s} />` */
export function FollowButton(props: FollowButtonProps): Element {
  let btn!: HTMLElement, ico!: HTMLElement;
  const state = (): FollowState => val(props.state) ?? "follow";
  const label = (s: FollowState): string => (s === "follow" ? t`Follow` : s === "following" ? t`Following` : t`Requested`);
  const click = (): void => {
    const from = state(), next: FollowState = from === "follow" ? (val(props.private) ? "requested" : "following") : "follow";
    const w0 = btn.offsetWidth;
    props.onChange(next);
    // after the label changed: spring the width from the old one, turn the icon in
    queueMicrotask(() => {
      const w1 = btn.offsetWidth;
      if (w0 && w1 && w0 !== w1 && !val(props.block)) animate(btn, [{ width: `${w0}px` }, { width: `${w1}px` }], { duration: 380, easing: "easeOutBack" });
      animate(ico, [{ transform: "rotate(-90deg) scale(.4)", opacity: 0 }, { transform: "rotate(0deg) scale(1)", opacity: 1 }], { duration: 320, easing: "easeOutBack" });
      if (next === "following") heartBurst(btn, { count: 8, radius: Math.max(28, w1 * 0.55), ring: false });
    });
  };
  return h("button", {
    type: "button",
    class: () => cx("hm-follow", `hm-follow-${val(props.size) ?? "md"}`, `is-${state()}`, val(props.block) && "hm-follow-block", val(props.class)),
    "aria-pressed": () => String(state() !== "follow"),
    "aria-label": () => { const n = val(props.name); const s = state(); return n ? (s === "follow" ? t`Follow ${n}` : s === "following" ? t`Following ${n}, press to unfollow` : t`Follow request sent to ${n}, press to cancel`) : label(s); },
    ref: (x: HTMLElement) => { btn = x; },
    onClick: click,
  },
  h("span", { class: "hm-follow-ico", "aria-hidden": "true", ref: (x: HTMLElement) => { ico = x; } }, () => glyph(state() === "follow" ? plus : state() === "following" ? check : clock)),
  h("span", { class: "hm-follow-text" }, () => label(state())));
}
